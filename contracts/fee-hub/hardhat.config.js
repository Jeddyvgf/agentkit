require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
const accounts = privateKey ? [privateKey] : [];

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
  mocha: {
    timeout: 120000,
  },
};
