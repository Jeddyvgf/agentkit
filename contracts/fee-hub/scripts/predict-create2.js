require("dotenv").config();
const hre = require("hardhat");

const DETERMINISTIC_DEPLOYER = "0x4e59B44847B379578588920cA78FbF26c0B4956C";
const DEFAULT_FEE_COLLECTOR_ADDRESS = "0x74bC275D4bfde7902D74f282d4e087F62d384D12";

function resolveSalt(rawSalt) {
  if (!rawSalt) {
    return hre.ethers.id("KLEANKUT_FEE_HUB_V1");
  }

  if (hre.ethers.isHexString(rawSalt, 32)) {
    return rawSalt;
  }

  return hre.ethers.id(rawSalt);
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const owner = process.env.OWNER_ADDRESS || deployer.address;
  const collector = process.env.FEE_COLLECTOR_ADDRESS || DEFAULT_FEE_COLLECTOR_ADDRESS;
  const salt = resolveSalt(process.env.CREATE2_SALT);

  if (!hre.ethers.isAddress(owner) || !hre.ethers.isAddress(collector)) {
    throw new Error("OWNER_ADDRESS and FEE_COLLECTOR_ADDRESS must be valid EVM addresses.");
  }

  const FeeHub = await hre.ethers.getContractFactory("KleanKutFeeHub");
  const deploymentTx = await FeeHub.getDeployTransaction(owner, collector);
  const initCode = deploymentTx.data;
  const initCodeHash = hre.ethers.keccak256(initCode);

  const predicted = hre.ethers.getCreate2Address(DETERMINISTIC_DEPLOYER, salt, initCodeHash);

  console.log(
    JSON.stringify(
      {
        network: hre.network.name,
        deployer: deployer.address,
        owner,
        collector,
        deterministicDeployer: DETERMINISTIC_DEPLOYER,
        salt,
        initCodeHash,
        predictedFeeHubAddress: predicted,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
