require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
const accounts = privateKey ? [privateKey] : [];
const etherscanApiKey = process.env.ETHERSCAN_API_KEY || "";

function getNetworkConfig(envVar, chainId) {
  const url = process.env[envVar];
  if (!url) {
    return undefined;
  }

  return {
    url,
    chainId,
    accounts,
  };
}

const networks = {
  hardhat: {},
};

const ethereum = getNetworkConfig("ETHEREUM_RPC_URL", 1);
const base = getNetworkConfig("BASE_RPC_URL", 8453);
const bsc = getNetworkConfig("BSC_RPC_URL", 56);
const polygon = getNetworkConfig("POLYGON_RPC_URL", 137);
const arbitrum = getNetworkConfig("ARBITRUM_RPC_URL", 42161);

if (ethereum) networks.ethereum = ethereum;
if (base) networks.base = base;
if (bsc) networks.bsc = bsc;
if (polygon) networks.polygon = polygon;
if (arbitrum) networks.arbitrum = arbitrum;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks,
  etherscan: {
    apiKey: {
      ethereum: etherscanApiKey,
      base: process.env.BASESCAN_API_KEY || etherscanApiKey,
      bsc: process.env.BSCSCAN_API_KEY || etherscanApiKey,
      polygon: process.env.POLYGONSCAN_API_KEY || etherscanApiKey,
      arbitrum: process.env.ARBISCAN_API_KEY || etherscanApiKey,
    },
    customChains: [
      {
        network: "ethereum",
        chainId: 1,
        urls: {
          apiURL: "https://api.etherscan.io/api",
          browserURL: "https://etherscan.io",
        },
      },
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "bsc",
        chainId: 56,
        urls: {
          apiURL: "https://api.bscscan.com/api",
          browserURL: "https://bscscan.com",
        },
      },
      {
        network: "polygon",
        chainId: 137,
        urls: {
          apiURL: "https://api.polygonscan.com/api",
          browserURL: "https://polygonscan.com",
        },
      },
      {
        network: "arbitrum",
        chainId: 42161,
        urls: {
          apiURL: "https://api.arbiscan.io/api",
          browserURL: "https://arbiscan.io",
        },
      },
    ],
  },
  mocha: {
    timeout: 120000,
  },
};
