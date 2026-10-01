const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const DEFAULT_RETRIES = 4;

const dom = {
  apiKey: document.getElementById("apiKey"),
  chainId: document.getElementById("chainId"),
  apiUrl: document.getElementById("apiUrl"),
  targetAddress: document.getElementById("targetAddress"),
  maxTransactions: document.getElementById("maxTransactions"),
  maxTokenTransfers: document.getElementById("maxTokenTransfers"),
  connectWalletBtn: document.getElementById("connectWalletBtn"),
  useWalletAddressBtn: document.getElementById("useWalletAddressBtn"),
  fetchBtn: document.getElementById("fetchBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  walletState: document.getElementById("walletState"),
  status: document.getElementById("status"),
  summary: document.getElementById("summary"),
  linkedContractsBody: document.getElementById("linkedContractsBody"),
  tokensBody: document.getElementById("tokensBody"),
  jsonOutput: document.getElementById("jsonOutput"),
};

let connectedAddress = "";
let latestReport = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAddress(value) {
  return String(value).toLowerCase();
}

function isValidAddress(value) {
  return typeof value === "string" && ADDRESS_REGEX.test(value);
}

function parseSafeInt(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAbi(abiRaw) {
  if (typeof abiRaw !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(abiRaw);
    if (Array.isArray(parsed)) {
      return parsed.filter((entry) => entry && typeof entry === "object");
    }
  } catch (_error) {
    return [];
  }

  return [];
}

function detectTokenStandards(abi) {
  const functionNames = new Set(
    abi
      .filter((entry) => entry.type === "function" && typeof entry.name === "string")
      .map((entry) => entry.name),
  );

  const standards = [];
  const erc20 = ["name", "symbol", "decimals", "totalSupply", "balanceOf", "transfer"];
  const erc721 = ["balanceOf", "ownerOf", "safeTransferFrom", "transferFrom"];
  const erc1155 = ["balanceOf", "safeTransferFrom", "safeBatchTransferFrom", "setApprovalForAll"];

  if (erc20.every((method) => functionNames.has(method))) {
    standards.push("ERC20");
  }
  if (erc721.every((method) => functionNames.has(method))) {
    standards.push("ERC721");
  }
  if (erc1155.every((method) => functionNames.has(method))) {
    standards.push("ERC1155");
  }

  return standards;
}

function isVerifiedSource(sourceRow) {
  const source = String(sourceRow?.SourceCode || "").trim().toLowerCase();
  return Boolean(source && source !== "contract source code not verified");
}

function setStatus(message, kind = "neutral") {
  dom.status.textContent = message;
  dom.status.className = `status ${kind}`;
}

function setWalletStatus(message, kind = "neutral") {
  dom.walletState.textContent = message;
  dom.walletState.className = `status ${kind}`;
}

function setBusy(isBusy) {
  dom.connectWalletBtn.disabled = isBusy;
  dom.useWalletAddressBtn.disabled = isBusy || !connectedAddress;
  dom.fetchBtn.disabled = isBusy;
  dom.downloadBtn.disabled = isBusy || !latestReport;
}

function clearTable(tbody, colSpan, emptyText) {
  tbody.innerHTML = "";
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = colSpan;
  cell.textContent = emptyText;
  row.appendChild(cell);
  tbody.appendChild(row);
}

function buildRequestUrl(apiUrl, chainId, module, action, params, apiKey) {
  const url = new URL(apiUrl);
  url.searchParams.set("chainid", String(chainId));
  url.searchParams.set("module", module);
  url.searchParams.set("action", action);
  url.searchParams.set("apikey", apiKey);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function etherscanCall({
  apiUrl,
  apiKey,
  chainId,
  module,
  action,
  params = {},
  emptyResultMarkers = [],
}) {
  let lastError = null;

  for (let attempt = 0; attempt <= DEFAULT_RETRIES; attempt += 1) {
    const url = buildRequestUrl(apiUrl, chainId, module, action, params, apiKey);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const status = String(payload?.status || "");
      const message = String(payload?.message || "");
      const result = payload?.result;
      const resultLower = String(result || "").toLowerCase();

      if (status === "1") {
        return result;
      }

      if (
        typeof result === "string" &&
        emptyResultMarkers.some((marker) => resultLower.includes(marker.toLowerCase()))
      ) {
        return [];
      }

      if (resultLower.includes("rate limit") && attempt < DEFAULT_RETRIES) {
        await sleep(400 * 2 ** attempt);
        continue;
      }

      throw new Error(
        `${module}.${action} returned status=${status}, message=${message}, result=${result}`,
      );
    } catch (error) {
      lastError = error;
      if (attempt < DEFAULT_RETRIES) {
        await sleep(400 * 2 ** attempt);
        continue;
      }
    }
  }

  throw lastError || new Error(`Failed calling ${module}.${action}`);
}

async function safeCall({ label, fn, fallback, warnings }) {
  try {
    return await fn();
  } catch (error) {
    warnings.push(`${label}: ${error?.message || String(error)}`);
    return fallback;
  }
}

function addLinkedAddress(linkedMap, targetAddress, candidate, relationType) {
  if (!isValidAddress(candidate)) {
    return;
  }
  const normalizedTarget = normalizeAddress(targetAddress);
  const normalizedCandidate = normalizeAddress(candidate);
  if (normalizedCandidate === normalizedTarget) {
    return;
  }

  if (!linkedMap.has(normalizedCandidate)) {
    linkedMap.set(normalizedCandidate, {
      address: normalizedCandidate,
      relationTypes: new Set(),
      relationCounts: {},
    });
  }

  const entry = linkedMap.get(normalizedCandidate);
  entry.relationTypes.add(relationType);
  entry.relationCounts[relationType] = (entry.relationCounts[relationType] || 0) + 1;
}

function enrichWithNormalTransactions(transactions, targetAddress, linkedMap) {
  transactions.forEach((tx) => {
    addLinkedAddress(linkedMap, targetAddress, tx.from, "normal_tx_from");
    addLinkedAddress(linkedMap, targetAddress, tx.to, "normal_tx_to");
    addLinkedAddress(linkedMap, targetAddress, tx.contractAddress, "contract_created");
  });
}

function enrichWithInternalTransactions(transactions, targetAddress, linkedMap) {
  transactions.forEach((tx) => {
    addLinkedAddress(linkedMap, targetAddress, tx.from, "internal_tx_from");
    addLinkedAddress(linkedMap, targetAddress, tx.to, "internal_tx_to");
    addLinkedAddress(linkedMap, targetAddress, tx.contractAddress, "internal_contract_created");
  });
}

function extractErc20Transfers(transfers, targetAddress, linkedMap) {
  const tokenMap = new Map();
  const normalizedTarget = normalizeAddress(targetAddress);

  transfers.forEach((transfer) => {
    const tokenAddress = transfer.contractAddress;
    if (!isValidAddress(tokenAddress)) {
      return;
    }

    const normalizedTokenAddress = normalizeAddress(tokenAddress);
    if (!tokenMap.has(normalizedTokenAddress)) {
      tokenMap.set(normalizedTokenAddress, {
        token_address: normalizedTokenAddress,
        token_name: transfer.tokenName || null,
        token_symbol: transfer.tokenSymbol || null,
        token_decimals: parseSafeInt(transfer.tokenDecimal),
        transfer_count: 0,
        incoming_transfers: 0,
        outgoing_transfers: 0,
      });
    }

    const tokenEntry = tokenMap.get(normalizedTokenAddress);
    tokenEntry.transfer_count += 1;

    if (isValidAddress(transfer.from) && normalizeAddress(transfer.from) === normalizedTarget) {
      tokenEntry.outgoing_transfers += 1;
    }
    if (isValidAddress(transfer.to) && normalizeAddress(transfer.to) === normalizedTarget) {
      tokenEntry.incoming_transfers += 1;
    }

    addLinkedAddress(linkedMap, targetAddress, tokenAddress, "erc20_token_contract");
  });

  return [...tokenMap.values()].sort((a, b) => a.token_address.localeCompare(b.token_address));
}

async function buildReport({ apiUrl, apiKey, chainId, address, maxTransactions, maxTokenTransfers }) {
  if (!isValidAddress(address)) {
    throw new Error("Target address must be a valid EVM address (0x + 40 hex chars).");
  }
  if (!apiKey) {
    throw new Error("API key is required.");
  }

  const warnings = [];

  const sourceRows = await safeCall({
    label: "getsourcecode",
    fallback: [],
    warnings,
    fn: async () =>
      etherscanCall({
        apiUrl,
        apiKey,
        chainId,
        module: "contract",
        action: "getsourcecode",
        params: { address },
      }),
  });
  const sourceRow = Array.isArray(sourceRows) && sourceRows[0] ? sourceRows[0] : {};

  const abiRaw = await safeCall({
    label: "getabi",
    fallback: "",
    warnings,
    fn: async () =>
      etherscanCall({
        apiUrl,
        apiKey,
        chainId,
        module: "contract",
        action: "getabi",
        params: { address },
      }),
  });
  let abi = parseAbi(abiRaw);
  if (!abi.length) {
    abi = parseAbi(sourceRow.ABI);
  }

  const creationRows = await safeCall({
    label: "getcontractcreation",
    fallback: [],
    warnings,
    fn: async () =>
      etherscanCall({
        apiUrl,
        apiKey,
        chainId,
        module: "contract",
        action: "getcontractcreation",
        params: { contractaddresses: address },
      }),
  });
  const creationRow = Array.isArray(creationRows) && creationRows[0] ? creationRows[0] : {};

  const normalTxsRaw = await safeCall({
    label: "txlist",
    fallback: [],
    warnings,
    fn: async () =>
      etherscanCall({
        apiUrl,
        apiKey,
        chainId,
        module: "account",
        action: "txlist",
        params: {
          address,
          startblock: 0,
          endblock: 99999999,
          page: 1,
          offset: maxTransactions,
          sort: "desc",
        },
        emptyResultMarkers: ["no transactions found"],
      }),
  });
  const normalTxs = Array.isArray(normalTxsRaw) ? normalTxsRaw : [];

  const internalTxsRaw = await safeCall({
    label: "txlistinternal",
    fallback: [],
    warnings,
    fn: async () =>
      etherscanCall({
        apiUrl,
        apiKey,
        chainId,
        module: "account",
        action: "txlistinternal",
        params: {
          address,
          startblock: 0,
          endblock: 99999999,
          page: 1,
          offset: maxTransactions,
          sort: "desc",
        },
        emptyResultMarkers: ["no transactions found", "no internal transactions found"],
      }),
  });
  const internalTxs = Array.isArray(internalTxsRaw) ? internalTxsRaw : [];

  const tokenTxsRaw = await safeCall({
    label: "tokentx",
    fallback: [],
    warnings,
    fn: async () =>
      etherscanCall({
        apiUrl,
        apiKey,
        chainId,
        module: "account",
        action: "tokentx",
        params: {
          address,
          startblock: 0,
          endblock: 99999999,
          page: 1,
          offset: maxTokenTransfers,
          sort: "desc",
        },
        emptyResultMarkers: ["no transactions found"],
      }),
  });
  const tokenTxs = Array.isArray(tokenTxsRaw) ? tokenTxsRaw : [];

  const linkedMap = new Map();
  const creator = creationRow.contractCreator;
  const implementation = sourceRow.Implementation;

  addLinkedAddress(linkedMap, address, creator, "contract_creator");
  addLinkedAddress(linkedMap, address, implementation, "proxy_implementation");
  enrichWithNormalTransactions(normalTxs, address, linkedMap);
  enrichWithInternalTransactions(internalTxs, address, linkedMap);
  const erc20Tokens = extractErc20Transfers(tokenTxs, address, linkedMap);

  const linkedContracts = [...linkedMap.values()]
    .map((entry) => {
      const relationCounts = {};
      Object.keys(entry.relationCounts)
        .sort()
        .forEach((key) => {
          relationCounts[key] = entry.relationCounts[key];
        });
      return {
        address: entry.address,
        relation_types: [...entry.relationTypes].sort(),
        relation_counts: relationCounts,
      };
    })
    .sort((a, b) => a.address.localeCompare(b.address));

  const functionCount = abi.filter((entry) => entry.type === "function").length;
  const eventCount = abi.filter((entry) => entry.type === "event").length;
  const isProxy = String(sourceRow.Proxy || "0").trim() === "1";

  return {
    queried_at_utc: new Date().toISOString(),
    api_url: apiUrl,
    chain_id: chainId,
    target_address: normalizeAddress(address),
    contract: {
      contract_name: sourceRow.ContractName || null,
      compiler_version: sourceRow.CompilerVersion || null,
      license_type: sourceRow.LicenseType || null,
      verified_source: isVerifiedSource(sourceRow),
      is_proxy: isProxy,
      implementation_address: isValidAddress(implementation) ? normalizeAddress(implementation) : null,
      creator_address: isValidAddress(creator) ? normalizeAddress(creator) : null,
      creation_tx_hash: creationRow.txHash || null,
      abi_available: abi.length > 0,
      abi_function_count: functionCount,
      abi_event_count: eventCount,
      detected_token_standards: detectTokenStandards(abi),
    },
    linked_contracts: linkedContracts,
    erc20_tokens: erc20Tokens,
    counts: {
      normal_transactions_processed: normalTxs.length,
      internal_transactions_processed: internalTxs.length,
      erc20_transfer_events_processed: tokenTxs.length,
      linked_contracts_found: linkedContracts.length,
      erc20_token_contracts_found: erc20Tokens.length,
    },
    warnings,
  };
}

function renderSummary(report) {
  const summary = {
    queried_at_utc: report.queried_at_utc,
    chain_id: report.chain_id,
    target_address: report.target_address,
    contract_name: report.contract.contract_name,
    is_proxy: report.contract.is_proxy,
    implementation_address: report.contract.implementation_address,
    detected_token_standards: report.contract.detected_token_standards,
    linked_contracts_found: report.counts.linked_contracts_found,
    erc20_token_contracts_found: report.counts.erc20_token_contracts_found,
    warnings_count: report.warnings.length,
  };
  dom.summary.textContent = JSON.stringify(summary, null, 2);
}

function renderLinkedContracts(linkedContracts) {
  if (!linkedContracts.length) {
    clearTable(dom.linkedContractsBody, 3, "No linked contracts found.");
    return;
  }

  dom.linkedContractsBody.innerHTML = "";
  linkedContracts.forEach((item) => {
    const row = document.createElement("tr");

    const addressCell = document.createElement("td");
    addressCell.textContent = item.address;

    const relationTypesCell = document.createElement("td");
    relationTypesCell.textContent = item.relation_types.join(", ");

    const relationCountsCell = document.createElement("td");
    relationCountsCell.textContent = JSON.stringify(item.relation_counts);

    row.append(addressCell, relationTypesCell, relationCountsCell);
    dom.linkedContractsBody.appendChild(row);
  });
}

function renderTokens(tokens) {
  if (!tokens.length) {
    clearTable(dom.tokensBody, 7, "No ERC-20 token links found.");
    return;
  }

  dom.tokensBody.innerHTML = "";
  tokens.forEach((token) => {
    const row = document.createElement("tr");
    const cells = [
      token.token_address,
      token.token_name || "-",
      token.token_symbol || "-",
      token.token_decimals ?? "-",
      token.transfer_count,
      token.incoming_transfers,
      token.outgoing_transfers,
    ];
    cells.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.appendChild(cell);
    });
    dom.tokensBody.appendChild(row);
  });
}

function renderReport(report) {
  renderSummary(report);
  renderLinkedContracts(report.linked_contracts);
  renderTokens(report.erc20_tokens);
  dom.jsonOutput.textContent = JSON.stringify(report, null, 2);
}

function sanitizeNumber(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

async function connectWallet() {
  if (!window.ethereum || typeof window.ethereum.request !== "function") {
    setWalletStatus("No injected web3 wallet found in this browser.", "error");
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const chainHex = await window.ethereum.request({ method: "eth_chainId" });
    const chainId = Number.parseInt(String(chainHex), 16);

    connectedAddress = accounts && accounts[0] ? accounts[0] : "";
    dom.useWalletAddressBtn.disabled = !connectedAddress;

    if (Number.isFinite(chainId) && chainId > 0) {
      dom.chainId.value = String(chainId);
    }

    if (connectedAddress) {
      setWalletStatus(`Connected wallet: ${connectedAddress}`, "success");
    } else {
      setWalletStatus("Wallet connected, but no account selected.", "error");
    }
  } catch (error) {
    setWalletStatus(`Wallet connection failed: ${error?.message || String(error)}`, "error");
  }
}

function downloadReport() {
  if (!latestReport) {
    return;
  }
  const blob = new Blob([`${JSON.stringify(latestReport, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `linked-contract-data-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function fetchLinkedData() {
  const apiKey = dom.apiKey.value.trim();
  const address = dom.targetAddress.value.trim();
  const apiUrl = dom.apiUrl.value.trim();
  const chainId = sanitizeNumber(dom.chainId.value, 1);
  const maxTransactions = sanitizeNumber(dom.maxTransactions.value, 200);
  const maxTokenTransfers = sanitizeNumber(dom.maxTokenTransfers.value, 400);

  if (!apiUrl) {
    setStatus("API URL is required.", "error");
    return;
  }
  if (!apiKey) {
    setStatus("Etherscan API key is required.", "error");
    return;
  }
  if (!isValidAddress(address)) {
    setStatus("Please enter a valid EVM address (0x + 40 hex chars).", "error");
    return;
  }

  setBusy(true);
  setStatus("Fetching data from Etherscan API...", "neutral");

  try {
    const report = await buildReport({
      apiUrl,
      apiKey,
      chainId,
      address,
      maxTransactions,
      maxTokenTransfers,
    });
    latestReport = report;
    renderReport(report);

    const warningText = report.warnings.length ? ` with ${report.warnings.length} warning(s)` : "";
    setStatus(
      `Done. Found ${report.counts.linked_contracts_found} linked contract(s) and ${report.counts.erc20_token_contracts_found} ERC-20 token contract(s)${warningText}.`,
      report.warnings.length ? "neutral" : "success",
    );
  } catch (error) {
    setStatus(`Fetch failed: ${error?.message || String(error)}`, "error");
  } finally {
    setBusy(false);
    dom.downloadBtn.disabled = !latestReport;
  }
}

async function initWalletState() {
  if (!window.ethereum || typeof window.ethereum.request !== "function") {
    setWalletStatus("No injected web3 wallet detected.", "neutral");
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts && accounts[0]) {
      connectedAddress = accounts[0];
      dom.useWalletAddressBtn.disabled = false;
      setWalletStatus(`Wallet available: ${connectedAddress}`, "success");
    }
  } catch (_error) {
    setWalletStatus("Wallet available, but account access is locked.", "neutral");
  }
}

dom.connectWalletBtn.addEventListener("click", connectWallet);
dom.useWalletAddressBtn.addEventListener("click", () => {
  if (!connectedAddress) {
    return;
  }
  dom.targetAddress.value = connectedAddress;
  setStatus("Filled target address from connected wallet.", "success");
});
dom.fetchBtn.addEventListener("click", fetchLinkedData);
dom.downloadBtn.addEventListener("click", downloadReport);

initWalletState();
