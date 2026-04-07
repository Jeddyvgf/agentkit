#!/usr/bin/env python3
"""Streamlit UI for the personal crypto audit script."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import streamlit as st


def _default_paths() -> str:
    home = Path.home()
    paths = [home / "Downloads", home / "Documents", home / "Desktop"]
    return ",".join(str(path) for path in paths)


def _run_audit(keys: str, wallets: str, paths: str, max_contracts: int) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["ETHERSCAN_API_KEYS"] = keys.strip()
    env["ETH_WALLET_ADDRESSES"] = wallets.strip()
    env["LOCAL_SCAN_PATHS"] = paths.strip()
    command = [
        sys.executable,
        "personal_crypto_audit.py",
        "--max-contracts",
        str(max_contracts),
    ]
    return subprocess.run(command, env=env, capture_output=True, text=True)


def main() -> None:
    st.set_page_config(page_title="Personal Crypto Audit", page_icon="🔎", layout="centered")
    st.title("Personal Crypto Audit")
    st.caption("Run Etherscan + local crypto file scan and download reports.")

    keys = st.text_input("Etherscan API keys (comma-separated)", type="password")
    wallets = st.text_area("Wallet addresses (comma-separated, 0x...)")
    paths = st.text_input("Local scan paths (comma-separated)", value=_default_paths())
    max_contracts = st.number_input(
        "Max contracts to fetch metadata for",
        min_value=1,
        max_value=5000,
        value=500,
        step=50,
    )

    if st.button("Run Audit", type="primary"):
        if not keys.strip():
            st.error("Add at least one Etherscan API key.")
            return
        if not wallets.strip():
            st.error("Add at least one wallet address.")
            return

        with st.spinner("Running audit... this can take a while for active wallets."):
            result = _run_audit(keys, wallets, paths, int(max_contracts))

        st.subheader("Execution Log")
        combined_output = (result.stdout or "") + ("\n" if result.stdout and result.stderr else "") + (result.stderr or "")
        st.code(combined_output or "No output produced.", language="bash")

        if result.returncode != 0:
            st.error("Audit failed. Check the log above.")
            return

        st.success("Audit completed.")

        report_json = Path("crypto_audit_report.json")
        summary_md = Path("crypto_audit_summary.md")

        if summary_md.exists():
            summary_text = summary_md.read_text(encoding="utf-8")
            st.subheader("Summary Preview")
            st.markdown(summary_text)
            st.download_button(
                "Download Summary (Markdown)",
                data=summary_text,
                file_name=summary_md.name,
                mime="text/markdown",
            )

        if report_json.exists():
            report_text = report_json.read_text(encoding="utf-8")
            st.download_button(
                "Download Full Report (JSON)",
                data=report_text,
                file_name=report_json.name,
                mime="application/json",
            )


if __name__ == "__main__":
    main()
