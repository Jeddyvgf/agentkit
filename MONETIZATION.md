# Monetization with AgentKit

This guide shows practical, code-first ways to charge users with stablecoin
payments when using AgentKit. It focuses on three common patterns:

1. Pay-per-request (x402 micropayments)
2. One-time payments (ERC20 transfer)
3. Subscriptions (Superfluid streams)

Pick the model that matches your product and start with the sample below.

## Pay-per-request with x402 (usage-based pricing)

Use x402 when you want to charge per API call. Your service should expose an
endpoint that responds with `402 Payment Required` and x402 payment details.
The agent can then pay and retry the request.

### Python example

```python
import json
import os

from coinbase_agentkit import (
    CdpEvmWalletProvider,
    CdpEvmWalletProviderConfig,
    x402_action_provider,
)

API_URL = "https://api.example.com/protected"

config = CdpEvmWalletProviderConfig(
    api_key_id=os.environ["CDP_API_KEY_ID"],
    api_key_secret=os.environ["CDP_API_KEY_SECRET"],
    wallet_secret=os.environ["CDP_WALLET_SECRET"],
    network_id=os.environ.get("NETWORK_ID", "base-sepolia"),
)

wallet_provider = CdpEvmWalletProvider(config)
provider = x402_action_provider()

initial = provider.make_http_request(wallet_provider, {"url": API_URL, "method": "GET"})
payload = json.loads(initial)

if payload.get("status") == "error_402_payment_required":
    option = payload["acceptablePaymentOptions"][0]
    paid = provider.retry_with_x402(
        wallet_provider,
        {
            "url": API_URL,
            "method": "GET",
            "scheme": option.get("scheme"),
            "network": option.get("network"),
            "max_amount_required": option.get("max_amount_required")
            or option.get("maxAmountRequired"),
            "resource": option.get("resource"),
            "pay_to": option.get("pay_to") or option.get("payTo"),
            "max_timeout_seconds": option.get("max_timeout_seconds")
            or option.get("maxTimeoutSeconds"),
            "asset": option.get("asset"),
        },
    )
    print(paid)
else:
    print(initial)
```

### TypeScript example

```typescript
import { CdpEvmWalletProvider } from "@coinbase/agentkit";
import { x402ActionProvider } from "@coinbase/agentkit";

const API_URL = "https://api.example.com/protected";

const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
  walletSecret: process.env.CDP_WALLET_SECRET,
  networkId: process.env.NETWORK_ID ?? "base-sepolia",
});

const provider = x402ActionProvider();

const initial = await provider.makeHttpRequest(walletProvider, {
  url: API_URL,
  method: "GET",
});

const payload = JSON.parse(initial);

if (payload.status === "error_402_payment_required") {
  const option = payload.acceptablePaymentOptions[0];
  const paid = await provider.retryWithX402(walletProvider, {
    url: API_URL,
    method: "GET",
    selectedPaymentOption: option,
  });
  console.log(paid);
} else {
  console.log(initial);
}
```

## One-time stablecoin payment (ERC20 transfer)

Use a direct ERC20 transfer when you want to charge a fixed price before
performing work. The agent sends the stablecoin to your service wallet.

### Python example

```python
import os

from coinbase_agentkit import (
    CdpEvmWalletProvider,
    CdpEvmWalletProviderConfig,
    erc20_action_provider,
)

config = CdpEvmWalletProviderConfig(
    api_key_id=os.environ["CDP_API_KEY_ID"],
    api_key_secret=os.environ["CDP_API_KEY_SECRET"],
    wallet_secret=os.environ["CDP_WALLET_SECRET"],
    network_id=os.environ.get("NETWORK_ID", "base-sepolia"),
)

wallet_provider = CdpEvmWalletProvider(config)
erc20 = erc20_action_provider()

# Example: 1 USDC with 6 decimals -> 1_000_000 base units
result = erc20.transfer(
    wallet_provider,
    {
        "amount": "1000000",
        "contract_address": os.environ["USDC_CONTRACT_ADDRESS"],
        "destination": os.environ["SERVICE_WALLET_ADDRESS"],
    },
)

print(result)
```

### TypeScript example

```typescript
import { CdpEvmWalletProvider } from "@coinbase/agentkit";
import { erc20ActionProvider } from "@coinbase/agentkit";

const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
  walletSecret: process.env.CDP_WALLET_SECRET,
  networkId: process.env.NETWORK_ID ?? "base-sepolia",
});

const erc20 = erc20ActionProvider();

const result = await erc20.transfer(walletProvider, {
  amount: "1000000",
  contractAddress: process.env.USDC_CONTRACT_ADDRESS!,
  destination: process.env.SERVICE_WALLET_ADDRESS!,
});

console.log(result);
```

## Subscriptions (streaming payments)

For recurring payments, you can use the Superfluid action provider to create a
payment stream to your service wallet. See the Superfluid action provider
README for supported actions and flow creation.
