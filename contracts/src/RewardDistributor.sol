// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RewardDistributor
 * @notice Holds a pool of OMR and pays out server-signed EIP-712 claims.
 *
 * Security model:
 *   - The server signs a Claim(player, runId, amount, nonce, expiry).
 *   - claim() verifies the signature against the active SIGNER, the
 *     chainId, the verifyingContract (this), the recipient, and the
 *     expiry.
 *   - Each runId is single-use: `claimed[runId]` prevents replay.
 *   - The contract is Pausable; the owner can rotate SIGNER and update
 *     the reward token address without redeploying.
 *
 * IMPORTANT: this contract was written for a prototype. It MUST undergo
 * independent security review/audit before mainnet deployment with any
 * real economic value.
 */
contract RewardDistributor is AccessControl, Pausable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

    /// @notice EIP-712 typehash for Claim. Matches the off-chain CLAIM_TYPES.
    bytes32 private constant CLAIM_TYPEHASH =
        keccak256("Claim(bytes32 runId,address player,uint256 amount,uint256 nonce,uint256 expiry)");

    /// @notice Active reward token (defaults to the OMR test token).
    IERC20 public rewardToken;

    /// @notice One entry per runId. true = already claimed.
    mapping(bytes32 => bool) public claimed;

    /// @notice The most recently rotated signer (used for event logging).
    address public currentSigner;

    event RewardClaimed(address indexed player, bytes32 indexed runId, uint256 amount);
    event SignerRotated(address indexed previous, address indexed current);
    event RewardTokenUpdated(address indexed previous, address indexed current);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);

    constructor(address admin, address signer, address tokenAddr)
        EIP712("OneMoreRun", "1")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(SIGNER_ROLE, signer);
        currentSigner = signer;
        rewardToken = IERC20(tokenAddr);
    }

    // -------------------------------------------------------------------------
    // CLAIM
    // -------------------------------------------------------------------------

    /**
     * @notice Claim a server-signed reward. Each runId may only be used once.
     * @param runId     Server-issued bytes32 identifier for the run.
     * @param player    Recipient (must match signed `player`).
     * @param amount    Reward in OMR base units (1e18 = 1 OMR).
     * @param nonce     Server nonce (folded into the digest).
     * @param expiry    Unix seconds after which the claim is invalid.
     * @param signature 65-byte EIP-712 signature.
     */
    function claim(
        bytes32 runId,
        address player,
        uint256 amount,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    ) external whenNotPaused nonReentrant {
        require(block.timestamp <= expiry, "Claim expired");
        require(!claimed[runId], "Already claimed");
        require(player == msg.sender, "Wrong recipient");
        require(amount > 0, "Zero amount");

        // Rebuild the EIP-712 digest and recover the signer.
        bytes32 structHash = keccak256(
            abi.encode(CLAIM_TYPEHASH, runId, player, amount, nonce, expiry)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = digest.recover(signature);
        require(hasRole(SIGNER_ROLE, recovered), "Bad signer");

        // Mark consumed BEFORE the external transfer (CEI).
        claimed[runId] = true;

        rewardToken.safeTransfer(player, amount);
        emit RewardClaimed(player, runId, amount);
    }

    // -------------------------------------------------------------------------
    // ADMIN
    // -------------------------------------------------------------------------

    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    function rotateSigner(address newSigner) external onlyRole(ADMIN_ROLE) {
        address previous = currentSigner;
        if (previous != address(0)) {
            _revokeRole(SIGNER_ROLE, previous);
        }
        _grantRole(SIGNER_ROLE, newSigner);
        currentSigner = newSigner;
        emit SignerRotated(previous, newSigner);
    }

    function setRewardToken(address newToken) external onlyRole(ADMIN_ROLE) {
        emit RewardTokenUpdated(address(rewardToken), newToken);
        rewardToken = IERC20(newToken);
    }

    /// @notice Top up the pool. Anyone can fund the contract.
    function fund(uint256 amount) external {
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Withdraw stuck tokens in an emergency.
    function emergencyWithdraw(IERC20 token, address to, uint256 amount) external onlyRole(ADMIN_ROLE) {
        token.safeTransfer(to, amount);
        emit EmergencyWithdraw(address(token), to, amount);
    }
}
