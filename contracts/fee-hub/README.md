# KleanKut Fee Hub (EVM)

Unified Solidity contract that supports six fee-capture flows and routes all fees to one collector wallet:

1. Subscription payments
2. Escrow milestone release
3. Relayer/service fees
4. Merchant checkout
5. MEV rebate settlement
6. Invoice settlement

This setup includes:
- `KleanKutFeeHub.sol` production contract
- tests
- standard deployment scripts
- CREATE2 deterministic deployment scripts for multi-chain address parity

## Important constraints

- You must deploy per chain (Ethereum/Base/BSC/Polygon/Arbitrum/etc.).
- You can target the same collector address on every chain.
- CREATE2 can produce the same contract address across chains **only if**:
  - the deterministic deployer exists on those chains,
  - constructor args are identical,
  - bytecode is identical,
  - `CREATE2_SALT` is identical.
- No onchain setup can make code impossible to copy. The BUSL license gives legal protection, not technical impossibility.

## Quick start

```bash
cd contracts/fee-hub
npm install
cp .env.example .env
```

Set `.env` values:

- `DEPLOYER_PRIVATE_KEY=...`
- `ETHERSCAN_API_KEY=...`
- `FEE_COLLECTOR_ADDRESS=0x74bC275D4bfde7902D74f282d4e087F62d384D12` (default already set in scripts)
- `OWNER_ADDRESS=0x...` (recommended: multisig)
- `CREATE2_SALT=KLEANKUT_FEE_HUB_V1` (or a 32-byte hex salt)
- chain RPC URLs you plan to deploy to

## Build and test

```bash
npm run build
npm test
```

## Standard deploy (per chain)

```bash
npm run deploy:ethereum
npm run deploy:base
npm run deploy:bsc
npm run deploy:polygon
npm run deploy:arbitrum
```

## Deterministic CREATE2 deploy (per chain)

Predict address:

```bash
npm run predict:create2
```

Deploy:

```bash
npm run deploy:create2:ethereum
npm run deploy:create2:base
npm run deploy:create2:bsc
npm run deploy:create2:polygon
npm run deploy:create2:arbitrum
```

## Fetch ABI from Etherscan

You can fetch any verified contract ABI from Etherscan-compatible chains and save it locally:

```bash
npm run abi:fetch -- --network ethereum --address 0xYourContract
```

Optional flags:

- `--chain-id <id>` to override network mapping
- `--out <path>` to customize output file
- `--apikey <key>` to pass key inline (prefer `.env`)

Example output path:

- `abis/ethereum-0xyourcontract.json`

## Verify deployment on explorer

After deploy, verify with constructor args:

```bash
npm run verify:base -- <DEPLOYED_ADDRESS> "<OWNER_ADDRESS>" "<FEE_COLLECTOR_ADDRESS>"
```

Available verify scripts: `verify:ethereum`, `verify:base`, `verify:bsc`, `verify:polygon`, `verify:arbitrum`

## Security checklist before production

- Put `OWNER_ADDRESS` behind a Safe multisig.
- Set fee values and collector wallet.
- Call `freezeConfigForever()` after final settings.
- Keep pause authority in multisig.
- Run independent security audit and bug bounty.
