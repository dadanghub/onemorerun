import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const SAIGON = {
  url: process.env.RONIN_TESTNET_RPC_URL || 'https://saigon-testnet.roninchain.com/rpc',
  chainId: 2021,
  accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
};
const RONIN = {
  url: process.env.RONIN_MAINNET_RPC_URL || 'https://api.roninchain.com/rpc',
  chainId: 2020,
  accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
};

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: 'cancun',
    },
  },
  networks: {
    hardhat: { chainId: 31337 },
    saigon: SAIGON,
    ronin: RONIN,
  },
  paths: {
    sources: './src',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
};

export default config;
