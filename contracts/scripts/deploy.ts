/**
 * Deploy OMR + RewardDistributor to Ronin (Saigon or mainnet).
 * Run:  NETWORK=saigon npx hardhat run scripts/deploy.ts
 *       NETWORK=ronin  npx hardhat run scripts/deploy.ts
 *
 * Required env:
 *   DEPLOYER_PRIVATE_KEY   0x...
 *   BACKEND_SIGNER         0x... (EIP-712 signer)
 *   RONIN_TESTNET_RPC_URL  https://saigon-testnet.roninchain.com/rpc  (if NETWORK=saigon)
 *   RONIN_MAINNET_RPC_URL  https://api.roninchain.com/rpc            (if NETWORK=ronin)
 */
import { ethers, network } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  const backend = process.env.BACKEND_SIGNER;
  if (!backend) throw new Error('Set BACKEND_SIGNER env');

  console.log(`[deploy] network=${network.name} deployer=${deployer.address}`);

  const OMR = await ethers.getContractFactory('OMR');
  const omr = await OMR.deploy();
  await omr.waitForDeployment();
  const omrAddr = await omr.getAddress();
  console.log(`[deploy] OMR -> ${omrAddr}`);

  const Dist = await ethers.getContractFactory('RewardDistributor');
  const dist = await Dist.deploy(deployer.address, backend, omrAddr);
  await dist.waitForDeployment();
  const distAddr = await dist.getAddress();
  console.log(`[deploy] RewardDistributor -> ${distAddr}`);

  await (await omr.setMinter(distAddr)).wait();
  console.log(`[deploy] OMR minter set to RewardDistributor`);

  console.log('\nSet these in your .env:');
  console.log(`OMR_TOKEN_ADDRESS=${omrAddr}`);
  console.log(`REWARD_DISTRIBUTOR_ADDRESS=${distAddr}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
