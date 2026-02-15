#!/usr/bin/env python3
"""Fetch contract, linked-contract, and ERC-20 token data from Etherscan-like APIs."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

DEFAULT_API_URL = "https://api.etherscan.io/api"
ADDRESS_PATTERN = re.compile(r"^0x[a-fA-F0-9]{40}$")


class EtherscanError(RuntimeError):
    """Raised when an Etherscan request fails."""


class EtherscanClient:
    """Minimal Etherscan API client."""

    def __init__(self, api_key: str, api_url: str = DEFAULT_API_URL, timeout_seconds: int = 20):
        self.api_key = api_key
        self.api_url = api_url
        self.timeout_seconds = timeout_seconds

    def call(
        self,
        module: str,
        action: str,
        empty_result_markers: tuple[str, ...] = (),
        **params: Any,
    ) -> Any:
        """Call an Etherscan API endpoint and return its `result` field."""
        query = {
            "module": module,
            "action": action,
            "apikey": self.api_key,
            **params,
        }
        request_url = f"{self.api_url}?{urlencode(query)}"

        try:
            with urlopen(request_url, timeout=self.timeout_seconds) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError) as exc:
            raise EtherscanError(f"Request failed for {module}.{action}: {exc}") from exc
        except json.JSONDecodeError as exc:
            raise EtherscanError(f"Invalid JSON from {module}.{action}: {exc}") from exc

        status = str(payload.get("status", ""))
        message = str(payload.get("message", ""))
        result = payload.get("result")

        if status == "1":
            return result

        if isinstance(result, str):
            result_lower = result.lower()
            if any(marker.lower() in result_lower for marker in empty_result_markers):
                return []

        raise EtherscanError(
            f"{module}.{action} returned status={status}, message={message}, result={result}"
        )


def normalize_address(address: str) -> str:
    """Normalize an address for stable matching and output."""
    return address.lower()


def is_valid_address(value: Any) -> bool:
    """Validate EVM address format."""
    return isinstance(value, str) and bool(ADDRESS_PATTERN.match(value))


def parse_abi(abi_raw: Any) -> list[dict[str, Any]]:
    """Parse ABI JSON text into a list."""
    if not isinstance(abi_raw, str):
        return []

    try:
        parsed = json.loads(abi_raw)
        if isinstance(parsed, list):
            return [entry for entry in parsed if isinstance(entry, dict)]
    except json.JSONDecodeError:
        return []

    return []


def detect_token_standards(abi: list[dict[str, Any]]) -> list[str]:
    """Infer common token standards from ABI method names."""
    function_names = {
        entry.get("name")
        for entry in abi
        if entry.get("type") == "function" and isinstance(entry.get("name"), str)
    }

    standards: list[str] = []
    erc20_methods = {"name", "symbol", "decimals", "totalSupply", "balanceOf", "transfer"}
    erc721_methods = {"balanceOf", "ownerOf", "safeTransferFrom", "transferFrom"}
    erc1155_methods = {"balanceOf", "safeTransferFrom", "safeBatchTransferFrom", "setApprovalForAll"}

    if erc20_methods.issubset(function_names):
        standards.append("ERC20")
    if erc721_methods.issubset(function_names):
        standards.append("ERC721")
    if erc1155_methods.issubset(function_names):
        standards.append("ERC1155")

    return standards


def is_verified_source(source_row: dict[str, Any]) -> bool:
    """Best-effort check for verified source presence."""
    source_code = str(source_row.get("SourceCode", "")).strip()
    return bool(source_code and source_code.lower() != "contract source code not verified")


def parse_int(value: Any) -> int | None:
    """Safely parse integer-ish values."""
    if value is None:
        return None

    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def add_linked_address(
    linked: dict[str, dict[str, Any]],
    target_address: str,
    candidate_address: Any,
    relation: str,
) -> None:
    """Merge a linked address into the output structure."""
    if not is_valid_address(candidate_address):
        return

    normalized_target = normalize_address(target_address)
    normalized_candidate = normalize_address(candidate_address)
    if normalized_candidate == normalized_target:
        return

    entry = linked.setdefault(
        normalized_candidate,
        {
            "address": normalized_candidate,
            "relation_types": set(),
            "relation_counts": defaultdict(int),
        },
    )
    entry["relation_types"].add(relation)
    entry["relation_counts"][relation] += 1


def enrich_with_normal_transactions(
    transactions: list[dict[str, Any]],
    target_address: str,
    linked: dict[str, dict[str, Any]],
) -> None:
    """Add links discovered from normal transactions."""
    for tx in transactions:
        add_linked_address(linked, target_address, tx.get("from"), "normal_tx_from")
        add_linked_address(linked, target_address, tx.get("to"), "normal_tx_to")
        add_linked_address(linked, target_address, tx.get("contractAddress"), "contract_created")


def enrich_with_internal_transactions(
    transactions: list[dict[str, Any]],
    target_address: str,
    linked: dict[str, dict[str, Any]],
) -> None:
    """Add links discovered from internal transactions."""
    for tx in transactions:
        add_linked_address(linked, target_address, tx.get("from"), "internal_tx_from")
        add_linked_address(linked, target_address, tx.get("to"), "internal_tx_to")
        add_linked_address(linked, target_address, tx.get("contractAddress"), "internal_contract_created")


def extract_erc20_transfers(
    token_transfers: list[dict[str, Any]],
    target_address: str,
    linked: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """Build ERC-20 token summaries from transfer history."""
    token_map: dict[str, dict[str, Any]] = {}
    normalized_target = normalize_address(target_address)

    for transfer in token_transfers:
        token_address = transfer.get("contractAddress")
        if not is_valid_address(token_address):
            continue

        normalized_token_address = normalize_address(token_address)
        token_entry = token_map.setdefault(
            normalized_token_address,
            {
                "token_address": normalized_token_address,
                "token_name": transfer.get("tokenName") or None,
                "token_symbol": transfer.get("tokenSymbol") or None,
                "token_decimals": parse_int(transfer.get("tokenDecimal")),
                "transfer_count": 0,
                "incoming_transfers": 0,
                "outgoing_transfers": 0,
            },
        )

        token_entry["transfer_count"] += 1

        from_address = transfer.get("from")
        to_address = transfer.get("to")
        if is_valid_address(from_address) and normalize_address(from_address) == normalized_target:
            token_entry["outgoing_transfers"] += 1
        if is_valid_address(to_address) and normalize_address(to_address) == normalized_target:
            token_entry["incoming_transfers"] += 1

        add_linked_address(linked, target_address, token_address, "erc20_token_contract")

    return sorted(token_map.values(), key=lambda x: x["token_address"])


def safe_call(
    warnings: list[str],
    label: str,
    fn: Any,
    fallback: Any,
) -> Any:
    """Call a function and downgrade failures into report warnings."""
    try:
        return fn()
    except EtherscanError as exc:
        warnings.append(f"{label}: {exc}")
        return fallback


def build_report(
    api_key: str,
    address: str,
    api_url: str,
    max_transactions: int,
    max_token_transfers: int,
    timeout_seconds: int,
) -> dict[str, Any]:
    """Fetch and assemble a linked contract and ERC-20 report."""
    if not is_valid_address(address):
        raise ValueError("Address must be a valid EVM address (0x + 40 hex characters).")

    client = EtherscanClient(api_key=api_key, api_url=api_url, timeout_seconds=timeout_seconds)
    warnings: list[str] = []

    source_rows = safe_call(
        warnings,
        "getsourcecode",
        lambda: client.call("contract", "getsourcecode", address=address),
        [],
    )
    source_row = source_rows[0] if isinstance(source_rows, list) and source_rows else {}
    if not isinstance(source_row, dict):
        source_row = {}

    abi_raw = safe_call(
        warnings,
        "getabi",
        lambda: client.call("contract", "getabi", address=address),
        "",
    )
    abi = parse_abi(abi_raw)
    if not abi:
        abi = parse_abi(source_row.get("ABI"))

    creation_rows = safe_call(
        warnings,
        "getcontractcreation",
        lambda: client.call("contract", "getcontractcreation", contractaddresses=address),
        [],
    )
    creation_row = creation_rows[0] if isinstance(creation_rows, list) and creation_rows else {}
    if not isinstance(creation_row, dict):
        creation_row = {}

    normal_txs = safe_call(
        warnings,
        "txlist",
        lambda: client.call(
            "account",
            "txlist",
            empty_result_markers=("no transactions found",),
            address=address,
            startblock=0,
            endblock=99999999,
            page=1,
            offset=max_transactions,
            sort="desc",
        ),
        [],
    )
    if not isinstance(normal_txs, list):
        normal_txs = []

    internal_txs = safe_call(
        warnings,
        "txlistinternal",
        lambda: client.call(
            "account",
            "txlistinternal",
            empty_result_markers=("no transactions found", "no internal transactions found"),
            address=address,
            startblock=0,
            endblock=99999999,
            page=1,
            offset=max_transactions,
            sort="desc",
        ),
        [],
    )
    if not isinstance(internal_txs, list):
        internal_txs = []

    token_txs = safe_call(
        warnings,
        "tokentx",
        lambda: client.call(
            "account",
            "tokentx",
            empty_result_markers=("no transactions found",),
            address=address,
            startblock=0,
            endblock=99999999,
            page=1,
            offset=max_token_transfers,
            sort="desc",
        ),
        [],
    )
    if not isinstance(token_txs, list):
        token_txs = []

    linked: dict[str, dict[str, Any]] = {}
    creator = creation_row.get("contractCreator")
    creation_tx_hash = creation_row.get("txHash")
    implementation = source_row.get("Implementation")
    is_proxy = str(source_row.get("Proxy", "0")).strip() == "1"

    add_linked_address(linked, address, creator, "contract_creator")
    add_linked_address(linked, address, implementation, "proxy_implementation")
    enrich_with_normal_transactions(normal_txs, address, linked)
    enrich_with_internal_transactions(internal_txs, address, linked)
    erc20_tokens = extract_erc20_transfers(token_txs, address, linked)

    linked_contracts = [
        {
            "address": entry["address"],
            "relation_types": sorted(entry["relation_types"]),
            "relation_counts": dict(sorted(entry["relation_counts"].items())),
        }
        for entry in linked.values()
    ]
    linked_contracts.sort(key=lambda item: item["address"])

    function_count = sum(1 for entry in abi if entry.get("type") == "function")
    event_count = sum(1 for entry in abi if entry.get("type") == "event")

    report = {
        "queried_at_utc": datetime.now(timezone.utc).isoformat(),
        "api_url": api_url,
        "target_address": normalize_address(address),
        "contract": {
            "contract_name": source_row.get("ContractName") or None,
            "compiler_version": source_row.get("CompilerVersion") or None,
            "license_type": source_row.get("LicenseType") or None,
            "verified_source": is_verified_source(source_row),
            "is_proxy": is_proxy,
            "implementation_address": normalize_address(implementation)
            if is_valid_address(implementation)
            else None,
            "creator_address": normalize_address(creator) if is_valid_address(creator) else None,
            "creation_tx_hash": creation_tx_hash or None,
            "abi_available": bool(abi),
            "abi_function_count": function_count,
            "abi_event_count": event_count,
            "detected_token_standards": detect_token_standards(abi),
        },
        "linked_contracts": linked_contracts,
        "erc20_tokens": erc20_tokens,
        "counts": {
            "normal_transactions_processed": len(normal_txs),
            "internal_transactions_processed": len(internal_txs),
            "erc20_transfer_events_processed": len(token_txs),
            "linked_contracts_found": len(linked_contracts),
            "erc20_token_contracts_found": len(erc20_tokens),
        },
        "warnings": warnings,
    }

    return report


def parse_args() -> argparse.Namespace:
    """Parse CLI args."""
    parser = argparse.ArgumentParser(
        description=(
            "Fetch contract metadata, linked contracts, and ERC-20 token activity "
            "from Etherscan-compatible APIs."
        )
    )
    parser.add_argument(
        "--address",
        required=True,
        help="Target contract or wallet address (0x...).",
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("ETHERSCAN_API_KEY"),
        help="Etherscan API key. Defaults to ETHERSCAN_API_KEY env var.",
    )
    parser.add_argument(
        "--api-url",
        default=os.getenv("ETHERSCAN_API_URL", DEFAULT_API_URL),
        help=f"Etherscan-compatible API URL. Defaults to {DEFAULT_API_URL}.",
    )
    parser.add_argument(
        "--max-transactions",
        type=int,
        default=200,
        help="Max normal/internal transactions to inspect (default: 200).",
    )
    parser.add_argument(
        "--max-token-transfers",
        type=int,
        default=400,
        help="Max ERC-20 transfer events to inspect (default: 400).",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=20,
        help="HTTP timeout in seconds for each API request (default: 20).",
    )
    parser.add_argument(
        "--output",
        help="Optional path to write JSON output.",
    )

    return parser.parse_args()


def main() -> int:
    """CLI entrypoint."""
    args = parse_args()

    if not args.api_key:
        print(
            "Missing API key. Pass --api-key or set ETHERSCAN_API_KEY.",
            file=sys.stderr,
        )
        return 2

    try:
        report = build_report(
            api_key=args.api_key,
            address=args.address,
            api_url=args.api_url,
            max_transactions=args.max_transactions,
            max_token_transfers=args.max_token_transfers,
            timeout_seconds=args.timeout_seconds,
        )
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    except EtherscanError as exc:
        print(f"Etherscan error: {exc}", file=sys.stderr)
        return 1

    output_text = json.dumps(report, indent=2)

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(output_text + "\n", encoding="utf-8")

    print(output_text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
