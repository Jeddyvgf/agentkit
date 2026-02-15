require("dotenv").config();
const hre = require("hardhat");

// Deterministic Deployment Proxy (widely available on EVM networks).
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

  const factoryCode = await hre.ethers.provider.getCode(DETERMINISTIC_DEPLOYER);
  if (factoryCode === "0x") {
    throw new Error(
      `Deterministic deployer ${DETERMINISTIC_DEPLOYER} not found on ${hre.network.name}.`,
    );
  }

  const FeeHub = await hre.ethers.getContractFactory("KleanKutFeeHub");
  const deploymentTx = await FeeHub.getDeployTransaction(owner, collector);
  const initCode = deploymentTx.data;

  if (!initCode) {
    throw new Error("Failed to build init code.");
  }

  const predicted = hre.ethers.getCreate2Address(
    DETERMINISTIC_DEPLOYER,
    salt,
    hre.ethers.keccak256(initCode),
  );

  const existingCode = await hre.ethers.provider.getCode(predicted);
  if (existingCode !== "0x") {
    console.log(
      JSON.stringify(
        {
          network: hre.network.name,
          deployer: deployer.address,
          owner,
          collector,
          salt,
          predicted,
          status: "already_deployed",
        },
        null,
        2,
      ),
    );
    return;
  }

  const calldata = `${salt}${initCode.slice(2)}`;
  const tx = await deployer.sendTransaction({
    to: DETERMINISTIC_DEPLOYER,
    data: calldata,
    gasLimit: 6_000_000,
  });
  await tx.wait();

  const deployedCode = await hre.ethers.provider.getCode(predicted);
  if (deployedCode === "0x") {
    throw new Error("CREATE2 deployment failed.");
  }

  console.log(
    JSON.stringify(
      {
        network: hre.network.name,
        deployer: deployer.address,
        owner,
        collector,
        salt,
        deterministicDeployer: DETERMINISTIC_DEPLOYER,
        feeHub: predicted,
        txHash: tx.hash,
        status: "deployed",
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
