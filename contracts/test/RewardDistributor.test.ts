import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';

const EIP712_NAME = 'OneMoreRun';
const EIP712_VERSION = '1';

function buildClaimDigest(
  domain: { name: string; version: string; chainId: number; verifyingContract: string },
  runId: string,
  player: string,
  amount: bigint,
  nonce: bigint,
  expiry: bigint,
) {
  return ethers.TypedDataEncoder.hashStruct(
    'Claim',
    {
      Claim: [
        { name: 'runId',  type: 'bytes32' },
        { name: 'player', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'nonce',  type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
      ],
    },
    { runId, player, amount, nonce, expiry },
  );
}

describe('RewardDistributor', () => {
  async function deploy() {
    const [admin, signer, player, other] = await ethers.getSigners();
    const OMR = await ethers.getContractFactory('OMR');
    const omr = await OMR.deploy();
    await omr.waitForDeployment();
    const Dist = await ethers.getContractFactory('RewardDistributor');
    const dist = await Dist.deploy(admin.address, signer.address, await omr.getAddress());
    await dist.waitForDeployment();
    // mint a pool
    await omr.setMinter(await dist.getAddress());
    await omr.mint(await dist.getAddress(), ethers.parseEther('1000'));
    return { admin, signer, player, other, omr, dist };
  }

  async function signClaim(
    signer: any,
    chainId: number,
    contract: string,
    runId: string,
    player: string,
    amount: bigint,
    nonce: bigint,
    expiry: bigint,
  ) {
    const domain = { name: EIP712_NAME, version: EIP712_VERSION, chainId, verifyingContract: contract };
    return await signer.signTypedData(domain, {
      Claim: [
        { name: 'runId',  type: 'bytes32' },
        { name: 'player', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'nonce',  type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
      ],
    }, { runId, player, amount, nonce, expiry });
  }

  it('happy path: claim once, pay once', async () => {
    const { dist, signer, player, omr } = await deploy();
    const runId = ethers.hexlify(ethers.randomBytes(32));
    const amount = ethers.parseEther('1.5');
    const nonce = 1n;
    const expiry = BigInt(await time.latest()) + 3600n;
    const sig = await signClaim(signer, 31337, await dist.getAddress(), runId, player.address, amount, nonce, expiry);
    await expect(dist.connect(player).claim(runId, player.address, amount, nonce, expiry, sig))
      .to.emit(dist, 'RewardClaimed')
      .withArgs(player.address, runId, amount);
    expect(await omr.balanceOf(player.address)).to.equal(amount);
  });

  it('rejects replay (same runId twice)', async () => {
    const { dist, signer, player } = await deploy();
    const runId = ethers.hexlify(ethers.randomBytes(32));
    const amount = ethers.parseEther('1');
    const expiry = BigInt(await time.latest()) + 3600n;
    const sig = await signClaim(signer, 31337, await dist.getAddress(), runId, player.address, amount, 1n, expiry);
    await dist.connect(player).claim(runId, player.address, amount, 1n, expiry, sig);
    await expect(dist.connect(player).claim(runId, player.address, amount, 1n, expiry, sig))
      .to.be.revertedWith('Already claimed');
  });

  it('rejects bad signer', async () => {
    const { dist, player, other } = await deploy();
    const runId = ethers.hexlify(ethers.randomBytes(32));
    const amount = ethers.parseEther('1');
    const expiry = BigInt(await time.latest()) + 3600n;
    const sig = await signClaim(other, 31337, await dist.getAddress(), runId, player.address, amount, 1n, expiry);
    await expect(dist.connect(player).claim(runId, player.address, amount, 1n, expiry, sig))
      .to.be.revertedWith('Bad signer');
  });

  it('rejects wrong recipient (player != msg.sender)', async () => {
    const { dist, signer, player, other } = await deploy();
    const runId = ethers.hexlify(ethers.randomBytes(32));
    const amount = ethers.parseEther('1');
    const expiry = BigInt(await time.latest()) + 3600n;
    const sig = await signClaim(signer, 31337, await dist.getAddress(), runId, player.address, amount, 1n, expiry);
    await expect(dist.connect(other).claim(runId, player.address, amount, 1n, expiry, sig))
      .to.be.revertedWith('Wrong recipient');
  });

  it('rejects expired claim', async () => {
    const { dist, signer, player } = await deploy();
    const runId = ethers.hexlify(ethers.randomBytes(32));
    const amount = ethers.parseEther('1');
    const expiry = BigInt(await time.latest()) + 60n;
    const sig = await signClaim(signer, 31337, await dist.getAddress(), runId, player.address, amount, 1n, expiry);
    await time.increase(120);
    await expect(dist.connect(player).claim(runId, player.address, amount, 1n, expiry, sig))
      .to.be.revertedWith('Claim expired');
  });

  it('rejects when paused', async () => {
    const { dist, signer, player, admin } = await deploy();
    await dist.connect(admin).pause();
    const runId = ethers.hexlify(ethers.randomBytes(32));
    const amount = ethers.parseEther('1');
    const expiry = BigInt(await time.latest()) + 3600n;
    const sig = await signClaim(signer, 31337, await dist.getAddress(), runId, player.address, amount, 1n, expiry);
    await expect(dist.connect(player).claim(runId, player.address, amount, 1n, expiry, sig))
      .to.be.reverted;
  });

  it('admin can rotate signer', async () => {
    const { dist, signer, player, admin, other } = await deploy();
    await dist.connect(admin).rotateSigner(other.address);
    const runId = ethers.hexlify(ethers.randomBytes(32));
    const amount = ethers.parseEther('1');
    const expiry = BigInt(await time.latest()) + 3600n;
    const sigOld = await signClaim(signer, 31337, await dist.getAddress(), runId, player.address, amount, 1n, expiry);
    await expect(dist.connect(player).claim(runId, player.address, amount, 1n, expiry, sigOld))
      .to.be.revertedWith('Bad signer');
    const sigNew = await signClaim(other, 31337, await dist.getAddress(), runId, player.address, amount, 1n, expiry);
    await expect(dist.connect(player).claim(runId, player.address, amount, 1n, expiry, sigNew))
      .to.emit(dist, 'RewardClaimed');
  });

  it('rejects tampered amount', async () => {
    const { dist, signer, player } = await deploy();
    const runId = ethers.hexlify(ethers.randomBytes(32));
    const amount = ethers.parseEther('1');
    const tampered = ethers.parseEther('1000');
    const expiry = BigInt(await time.latest()) + 3600n;
    // signature is over the original amount; the contract checks amount in the digest
    // so passing tampered but original signature must fail.
    const sig = await signClaim(signer, 31337, await dist.getAddress(), runId, player.address, amount, 1n, expiry);
    await expect(dist.connect(player).claim(runId, player.address, tampered, 1n, expiry, sig))
      .to.be.revertedWith('Bad signer');
  });
});
