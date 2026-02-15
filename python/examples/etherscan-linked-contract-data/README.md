# Etherscan Linked Contract Data Example

This example pulls a report for a target EVM address using an Etherscan-compatible API.

The report includes:
- Contract metadata (`getsourcecode`, `getabi`, `getcontractcreation`)
- Linked contract addresses from:
  - creator/proxy implementation metadata
  - normal transaction counterparties
  - internal transaction counterparties
- ERC-20 token contracts linked by transfer history (`account/tokentx`)

The script automatically retries short-lived API rate-limit responses.

## Requirements

- Python 3.10+
- An Etherscan API key

## Run

From this directory:

```bash
python fetch_linked_contract_data.py \
  --address 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \
  --api-key "$ETHERSCAN_API_KEY"
```

Or set the API key once:

```bash
export ETHERSCAN_API_KEY="your-key-here"
python fetch_linked_contract_data.py --address 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
```

## Optional flags

- `--api-url`: Override API URL (defaults to Etherscan V2: `https://api.etherscan.io/v2/api`)
- `--chain-id`: Set target EVM chain ID (default: `1`)
  - Example for Sepolia: `11155111`
- `--max-transactions`: Limit normal/internal transactions inspected (default: `200`)
- `--max-token-transfers`: Limit ERC-20 transfer events inspected (default: `400`)
- `--timeout-seconds`: HTTP timeout per request (default: `20`)
- `--output`: Write JSON report to file

## Example with file output

```bash
python fetch_linked_contract_data.py \
  --address 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \
  --output ./usdc-linked-data.json
```
