import os
from pathlib import Path

from coinbase_agentkit import (
    CdpEvmWalletProvider,
    CdpEvmWalletProviderConfig,
    wow_action_provider,
)

ENV_FILE = Path(__file__).with_name(".env.local")
SUPPORTED_NETWORKS = {"base-mainnet", "base-sepolia"}
DEFAULT_TOKEN_NAME = "Mabdy"
DEFAULT_TOKEN_SYMBOL = "MABDY"


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, _, value = line.partition("=")
        if not key:
            continue
        os.environ.setdefault(key, value)


def require_env(key: str) -> str:
    value = os.getenv(key)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {key}")
    return value


def get_optional_env(key: str) -> str | None:
    value = os.getenv(key)
    return value if value else None


def main() -> None:
    load_env_file(ENV_FILE)

    network_id = os.getenv("NETWORK_ID", "base-sepolia")
    if network_id not in SUPPORTED_NETWORKS:
        raise RuntimeError(
            "NETWORK_ID must be base-mainnet or base-sepolia for WOW token deployments."
        )

    wallet_address = get_optional_env("ADDRESS")
    idempotency_key = get_optional_env("IDEMPOTENCY_KEY") if not wallet_address else None

    config = CdpEvmWalletProviderConfig(
        api_key_id=require_env("CDP_API_KEY_ID"),
        api_key_secret=require_env("CDP_API_KEY_SECRET"),
        wallet_secret=require_env("CDP_WALLET_SECRET"),
        network_id=network_id,
        address=wallet_address,
        idempotency_key=idempotency_key,
    )

    token_name = os.getenv("TOKEN_NAME", DEFAULT_TOKEN_NAME)
    token_symbol = os.getenv("TOKEN_SYMBOL", DEFAULT_TOKEN_SYMBOL)
    token_uri = get_optional_env("TOKEN_URI")

    args = {"name": token_name, "symbol": token_symbol}
    if token_uri:
        args["token_uri"] = token_uri

    wallet_provider = CdpEvmWalletProvider(config)
    provider = wow_action_provider()
    result = provider.create_token(wallet_provider, args)
    print(result)


if __name__ == "__main__":
    main()
