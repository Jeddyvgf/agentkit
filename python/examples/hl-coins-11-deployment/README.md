# h.l.coins 11 Token Deployment Example

This example deploys a Zora Wow ERC20 memecoin named `h.l.coins 11` using AgentKit and the WOW action provider.

## Requirements
- Python 3.10+
- CDP API key and secret
- CDP wallet secret
- Base mainnet or Base sepolia wallet with enough ETH for gas

## Configure
1. Fill out `.env.local` with your credentials and preferences.
2. Optional overrides:
   - `TOKEN_NAME` (defaults to `h.l.coins 11`)
   - `TOKEN_SYMBOL` (defaults to `HLC11`)
   - `TOKEN_URI` (custom metadata URI)

The script reads `.env.local` if present and does not override any environment variables you already set.

## Run
From this directory:

`PYTHONPATH=../../coinbase-agentkit python deploy_token.py`

