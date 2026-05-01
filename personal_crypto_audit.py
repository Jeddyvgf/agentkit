#!/usr/bin/env python3
"""Generate a personal crypto activity and file summary report.

This script is intended for authorized, local use only. It pulls wallet and
contract data from Etherscan and scans local folders for crypto-related files.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
from collections import Counter
from datetime import datetime, timezone
from itertools import cycle
from pathlib import Path
from typing import Any

import requests

ETHERSCAN_BASE = "https://api.etherscan.io/api"
ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
CRYPTO_KEYWORDS = (
    "crypto",
    "bitcoin",
    "btc",
    "ethereum",
    "eth",
    "sol",
    "usdt",
    "usdc",
    "nft",
    "token",
    "wallet",
    "metamask",
    "ledger",
    "contract",
    "coinbase",
    "binance",
    "kraken",
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _csv_env(name: str) -> list[str]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


def _is_address(value: str) -> bool:
    return bool(ADDRESS_RE.match(value))


class EtherscanClient:
    def __init__(self, api_keys: list[str], sleep_seconds: float = 0.2):
        if not api_keys:
            raise ValueError("At least one Etherscan API key is required.")
        self.keys = cycle(api_keys)
        self.sleep_seconds = sleep_seconds

    def call(self, module: str, action: str, **params: Any) -> Any:
        """Call Etherscan with key rotation and simple rate-limit retry."""
        for attempt in range(6):
            api_key = next(self.keys)
            payload = {
                "module": module,
                "action": action,
                **params,
                "apikey": api_key,
            }
            response = requests.get(ETHERSCAN_BASE, params=payload, timeout=45)
            response.raise_for_status()
            data = response.json()
            result = data.get("result")

            if data.get("status") == "1":
                return result
            if isinstance(result, str) and "No transactions found" in result:
                return []

            joined = json.dumps(data).lower()
            if "rate limit" in joined or "max rate limit reached" in joined:
                time.sleep((attempt + 1) * 1.1)
                continue

            return result

        return []

    def call_account_paginated(
        self,
        action: str,
        address: str,
        page_size: int = 5000,
        max_pages: int = 200,
    ) -> list[dict[str, Any]]:
        output: list[dict[str, Any]] = []
        for page in range(1, max_pages + 1):
            rows = self.call(
                module="account",
                action=action,
                address=address,
                startblock=0,
                endblock=99999999,
                page=page,
                offset=page_size,
                sort="asc",
            )
            if not isinstance(rows, list) or not rows:
                break
            output.extend(rows)
            if len(rows) < page_size:
                break
            time.sleep(self.sleep_seconds)
        return output


def fetch_wallet_bundle(client: EtherscanClient, address: str) -> dict[str, Any]:
    balance_wei = client.call(module="account", action="balance", address=address, tag="latest")
    normal = client.call_account_paginated("txlist", address)
    internal = client.call_account_paginated("txlistinternal", address)
    erc20 = client.call_account_paginated("tokentx", address)
    erc721 = client.call_account_paginated("tokennfttx", address)
    erc1155 = client.call_account_paginated("token1155tx", address)

    contract_addresses = set()

    for tx in normal:
        target = tx.get("to", "")
        if _is_address(target) and tx.get("input", "0x") != "0x":
            contract_addresses.add(target.lower())
        created = tx.get("contractAddress", "")
        if _is_address(created):
            contract_addresses.add(created.lower())

    for stream in (erc20, erc721, erc1155):
        for tx in stream:
            contract = tx.get("contractAddress", "")
            if _is_address(contract):
                contract_addresses.add(contract.lower())

    return {
        "address": address,
        "balance_wei": balance_wei if isinstance(balance_wei, str) else "0",
        "normal_txs": normal,
        "internal_txs": internal,
        "erc20_txs": erc20,
        "erc721_txs": erc721,
        "erc1155_txs": erc1155,
        "contract_addresses": sorted(contract_addresses),
    }


def fetch_contract_metadata(
    client: EtherscanClient,
    contracts: list[str],
    max_contracts: int,
) -> dict[str, dict[str, Any]]:
    metadata: dict[str, dict[str, Any]] = {}
    for i, contract in enumerate(contracts):
        if i >= max_contracts:
            break
        rows = client.call(module="contract", action="getsourcecode", address=contract)
        row = rows[0] if isinstance(rows, list) and rows else {}
        metadata[contract] = {
            "contract_name": row.get("ContractName", ""),
            "compiler_version": row.get("CompilerVersion", ""),
            "optimization_used": row.get("OptimizationUsed", ""),
            "runs": row.get("Runs", ""),
            "license_type": row.get("LicenseType", ""),
            "proxy": row.get("Proxy", ""),
            "implementation": row.get("Implementation", ""),
            "verified": bool(row.get("SourceCode")),
        }
        time.sleep(client.sleep_seconds)
    return metadata


def summarize_wallet(
    wallet: dict[str, Any],
    contract_metadata: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    token_symbols = sorted(
        {
            tx.get("tokenSymbol")
            for tx in wallet["erc20_txs"]
            if isinstance(tx.get("tokenSymbol"), str) and tx["tokenSymbol"]
        }
    )
    nft_collections = sorted(
        {
            tx.get("tokenName")
            for tx in wallet["erc721_txs"]
            if isinstance(tx.get("tokenName"), str) and tx["tokenName"]
        }
    )
    counterparties = Counter(
        tx.get("to", "").lower()
        for tx in wallet["normal_txs"]
        if _is_address(tx.get("to", ""))
    )
    verified_count = sum(
        1
        for address in wallet["contract_addresses"]
        if contract_metadata.get(address, {}).get("verified", False)
    )

    return {
        "balance_wei": wallet["balance_wei"],
        "normal_tx_count": len(wallet["normal_txs"]),
        "internal_tx_count": len(wallet["internal_txs"]),
        "erc20_transfer_count": len(wallet["erc20_txs"]),
        "erc721_transfer_count": len(wallet["erc721_txs"]),
        "erc1155_transfer_count": len(wallet["erc1155_txs"]),
        "token_symbols": token_symbols,
        "nft_collections": nft_collections,
        "contract_address_count": len(wallet["contract_addresses"]),
        "verified_contract_count": verified_count,
        "top_counterparties": [
            {"address": address, "tx_count": count}
            for address, count in counterparties.most_common(20)
        ],
    }


def scan_local_paths(paths: list[str]) -> dict[str, Any]:
    matched_files: list[dict[str, Any]] = []

    for base in paths:
        root = Path(base).expanduser()
        if not root.exists():
            continue
        for item in root.rglob("*"):
            if not item.is_file():
                continue
            lowered = str(item).lower()
            if not any(keyword in lowered for keyword in CRYPTO_KEYWORDS):
                continue
            stat = item.stat()
            matched_files.append(
                {
                    "path": str(item),
                    "size_bytes": stat.st_size,
                    "modified_utc": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
                    "extension": item.suffix.lower(),
                }
            )

    by_extension = Counter(entry["extension"] for entry in matched_files)
    total_size = sum(entry["size_bytes"] for entry in matched_files)
    return {
        "summary": {
            "count": len(matched_files),
            "total_size_bytes": total_size,
            "by_extension": dict(by_extension),
        },
        "files": matched_files,
    }


def write_markdown_summary(report: dict[str, Any], output_path: Path) -> None:
    lines: list[str] = []
    lines.append("# Personal Crypto Audit Summary")
    lines.append(f"- Generated at: {report['generated_at']}")
    lines.append("")
    lines.append("## Etherscan Wallet Summary")
    lines.append(f"- Wallets analyzed: {len(report['etherscan']['wallets'])}")
    lines.append(f"- Unique contract addresses: {report['etherscan']['unique_contract_count']}")
    lines.append("")

    for wallet in report["etherscan"]["wallets"]:
        summary = wallet["summary"]
        lines.append(f"### {wallet['address']}")
        lines.append(f"- Balance (wei): {summary['balance_wei']}")
        lines.append(f"- Normal tx count: {summary['normal_tx_count']}")
        lines.append(f"- ERC20 transfers: {summary['erc20_transfer_count']}")
        lines.append(f"- ERC721 transfers: {summary['erc721_transfer_count']}")
        lines.append(f"- ERC1155 transfers: {summary['erc1155_transfer_count']}")
        lines.append(
            f"- Contracts touched: {summary['contract_address_count']} "
            f"(verified: {summary['verified_contract_count']})"
        )
        lines.append("")

    local_summary = report["local_files"]["summary"]
    lines.append("## Local Crypto-Related Files")
    lines.append(f"- Matched files: {local_summary['count']}")
    lines.append(f"- Total size (bytes): {local_summary['total_size_bytes']}")

    output_path.write_text("\n".join(lines), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Personal Etherscan + local crypto file audit")
    parser.add_argument("--max-contracts", type=int, default=500, help="Max contracts to query metadata for")
    parser.add_argument(
        "--report-json",
        default="crypto_audit_report.json",
        help="JSON report output path",
    )
    parser.add_argument(
        "--summary-md",
        default="crypto_audit_summary.md",
        help="Markdown summary output path",
    )
    return parser.parse_args()


def run(max_contracts: int, report_json_path: str, summary_md_path: str) -> tuple[Path, Path]:
    api_keys = _csv_env("ETHERSCAN_API_KEYS")
    wallet_addresses = [address for address in _csv_env("ETH_WALLET_ADDRESSES") if _is_address(address)]
    local_scan_paths = _csv_env("LOCAL_SCAN_PATHS")

    if not api_keys:
        raise RuntimeError("ETHERSCAN_API_KEYS is required (comma-separated keys).")
    if not wallet_addresses:
        raise RuntimeError("ETH_WALLET_ADDRESSES is required (comma-separated 0x addresses).")

    client = EtherscanClient(api_keys=api_keys)
    wallets_raw: list[dict[str, Any]] = []
    all_contracts: set[str] = set()

    for wallet in wallet_addresses:
        payload = fetch_wallet_bundle(client, wallet)
        wallets_raw.append(payload)
        all_contracts.update(payload["contract_addresses"])

    contract_metadata = fetch_contract_metadata(client, sorted(all_contracts), max_contracts=max_contracts)

    wallets = [
        {
            "address": wallet["address"],
            "summary": summarize_wallet(wallet, contract_metadata),
            "raw": wallet,
        }
        for wallet in wallets_raw
    ]

    local_files = scan_local_paths(local_scan_paths) if local_scan_paths else {
        "summary": {"count": 0, "total_size_bytes": 0, "by_extension": {}},
        "files": [],
    }

    report: dict[str, Any] = {
        "generated_at": _now_iso(),
        "etherscan": {
            "wallets": wallets,
            "unique_contract_count": len(all_contracts),
            "contract_metadata": contract_metadata,
        },
        "local_files": local_files,
    }

    report_json = Path(report_json_path)
    summary_md = Path(summary_md_path)
    report_json.write_text(json.dumps(report, indent=2), encoding="utf-8")
    write_markdown_summary(report, summary_md)
    return report_json, summary_md


def main() -> int:
    args = parse_args()
    try:
        report_json, summary_md = run(
            max_contracts=args.max_contracts,
            report_json_path=args.report_json,
            summary_md_path=args.summary_md,
        )
    except Exception as exc:  # pragma: no cover - user-facing entrypoint
        print(f"Error: {exc}")
        return 1

    print(f"Done: {report_json} and {summary_md}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
