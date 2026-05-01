# Mandy Coin (Base) Deployment Example

This example deploys a Zora WOW ERC20 memecoin named Mandy Coin using AgentKit and the WOW action provider on Base.

## Requirements
- Python 3.10+
- CDP API key and secret
- CDP wallet secret
- Base mainnet or Base sepolia wallet with enough ETH for gas

## Configure
1. Fill out `.env.local` with your credentials and preferences.
2. Optional overrides:
   - `TOKEN_NAME` (defaults to `Mandy Coin`)
   - `TOKEN_SYMBOL` (defaults to `MANDY`)
   - `TOKEN_URI` (custom metadata URI)

The script reads `.env.local` if present and does not override any environment variables you already set.

## Run
From this directory:

`PYTHONPATH=../../coinbase-agentkit python deploy_token.py`
