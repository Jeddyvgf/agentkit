require("dotenv").config();
const fs = require("fs");
const path = require("path");

const CHAIN_IDS = {
  ethereum: 1,
  base: 8453,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
};

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = value;
    i++;
  }

  return args;
}

function assertValidAddress(address) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`Invalid EVM contract address: ${address}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const network = String(args.network || "ethereum").toLowerCase();
  const chainId = Number(args["chain-id"] || CHAIN_IDS[network]);
  const address = args.address;
  const apiKey = args.apikey || process.env.ETHERSCAN_API_KEY;

  if (!address) {
    throw new Error("Missing --address. Example: npm run abi:fetch -- --network base --address 0x...");
  }

  assertValidAddress(address);

  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error(`Unsupported network "${network}". Provide --chain-id explicitly.`);
  }

  if (!apiKey) {
    throw new Error("Missing Etherscan API key. Set ETHERSCAN_API_KEY or pass --apikey.");
  }

  const requestUrl = new URL("https://api.etherscan.io/v2/api");
  requestUrl.searchParams.set("chainid", String(chainId));
  requestUrl.searchParams.set("module", "contract");
  requestUrl.searchParams.set("action", "getabi");
  requestUrl.searchParams.set("address", address);
  requestUrl.searchParams.set("apikey", apiKey);

  const response = await fetch(requestUrl);
  if (!response.ok) {
    throw new Error(`Etherscan request failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (payload.status !== "1" || typeof payload.result !== "string") {
    throw new Error(`Etherscan getabi error: ${payload.result || payload.message || "unknown error"}`);
  }

  let abi;
  try {
    abi = JSON.parse(payload.result);
  } catch (error) {
    throw new Error(`Unable to parse ABI payload: ${error.message}`);
  }

  const defaultOut = path.join("abis", `${network}-${address.toLowerCase()}.json`);
  const outPath = args.out || defaultOut;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(abi, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        network,
        chainId,
        address,
        output: outPath,
        abiEntries: abi.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
