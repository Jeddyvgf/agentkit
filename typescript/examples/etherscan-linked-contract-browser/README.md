# Etherscan Linked Contract Browser dApp

This example is a static web app that you can open in a web3 browser (MetaMask browser, Brave, Coinbase Wallet browser, etc.).

It lets you:
- Connect your wallet in-browser
- Pull linked contract data from Etherscan API v2
- Pull ERC-20 token contracts linked to the target address
- Download the full JSON report

## Files

- `index.html` - UI and browser entrypoint
- `app.js` - Etherscan fetch + data aggregation logic
- `styles.css` - basic styling

## Quick run (local)

From the repository root:

```bash
python3 -m http.server 8080
```

Then open:

- `http://localhost:8080/typescript/examples/etherscan-linked-contract-browser/`

## Use in a web3 browser

1. Open the app URL in your web3 browser.
2. Click **Connect Wallet** (optional, used to auto-fill address).
3. Enter:
   - Etherscan API key
   - Chain ID (default `1`)
   - Target address
4. Click **Fetch Linked Data**.
5. Click **Download JSON** if you want to save results.

## Deploy options

Because this is static HTML/CSS/JS, you can deploy it with:
- IPFS (Pinata/web3.storage + IPFS gateway URL)
- GitHub Pages
- Netlify / Vercel static hosting
- Any static file host

## Security notes

- The API key is used client-side and can be inspected by the browser user.
- Use a dedicated key with limits/restrictions.
- Do not hardcode private keys or wallet secrets in frontend code.
