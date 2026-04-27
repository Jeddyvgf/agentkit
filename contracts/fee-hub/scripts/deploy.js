require("dotenv").config();
const hre = require("hardhat");

const DEFAULT_FEE_COLLECTOR_ADDRESS = "0x74bC275D4bfde7902D74f282d4e087F62d384D12";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const owner = process.env.OWNER_ADDRESS || deployer.address;
  const collector = process.env.FEE_COLLECTOR_ADDRESS || DEFAULT_FEE_COLLECTOR_ADDRESS;

  if (!hre.ethers.isAddress(owner) || !hre.ethers.isAddress(collector)) {
    throw new Error("OWNER_ADDRESS and FEE_COLLECTOR_ADDRESS must be valid EVM addresses.");
  }

  const FeeHub = await hre.ethers.getContractFactory("KleanKutFeeHub");
  const feeHub = await FeeHub.deploy(owner, collector);
  await feeHub.waitForDeployment();

  const address = await feeHub.getAddress();

  console.log(
    JSON.stringify(
      {
        network: hre.network.name,
        deployer: deployer.address,
        owner,
        collector,
        feeHub: address,
        txHash: feeHub.deploymentTransaction().hash,
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
