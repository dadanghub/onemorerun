// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title OMR
 * @notice Test reward token for One More Run. ERC-20 with mint restricted
 * to the RewardDistributor contract.
 *
 * In production, OMR can be replaced with any approved Ronin ecosystem
 * asset by pointing RewardDistributor.rewardToken() at the new address.
 */
contract OMR is ERC20, Ownable {
    address public minter;

    event MinterUpdated(address indexed previous, address indexed current);

    constructor() ERC20("One More Run", "OMR") Ownable(msg.sender) {}

    function setMinter(address newMinter) external onlyOwner {
        emit MinterUpdated(minter, newMinter);
        minter = newMinter;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == minter || msg.sender == owner(), "OMR: not minter");
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
