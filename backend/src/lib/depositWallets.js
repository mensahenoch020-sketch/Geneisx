// Deposit wallet addresses, one per supported asset. Real addresses come
// from environment variables — never hardcoded here — so a wrong address
// pasted into source code can't silently misdirect a client's deposit.
// Any asset whose env var isn't set is simply left out of the client
// dashboard's Wallet page rather than shown blank or with a placeholder.
//
// Set these on the backend service (same place as SHARED_DEPOSIT_ADDRESS —
// see DEPLOYMENT.md):
//   SHARED_DEPOSIT_ADDRESS         → BTC (already existed)
//   SHARED_DEPOSIT_ADDRESS_USDT    → USDT, TRC20 (Tron network)
//   SHARED_DEPOSIT_ADDRESS_SOL     → SOL
//   SHARED_DEPOSIT_ADDRESS_ETH     → ETH
//   SHARED_DEPOSIT_ADDRESS_TRON    → TRX (Tron)
const WALLET_DEFS = [
  { asset: "BTC", name: "Bitcoin", network: "Bitcoin", envVar: "SHARED_DEPOSIT_ADDRESS" },
  { asset: "USDT", name: "Tether", network: "TRC20 (Tron)", envVar: "SHARED_DEPOSIT_ADDRESS_USDT" },
  { asset: "SOL", name: "Solana", network: "Solana", envVar: "SHARED_DEPOSIT_ADDRESS_SOL" },
  { asset: "ETH", name: "Ethereum", network: "Ethereum", envVar: "SHARED_DEPOSIT_ADDRESS_ETH" },
  { asset: "TRON", name: "Tron", network: "Tron", envVar: "SHARED_DEPOSIT_ADDRESS_TRON" },
];

function getDepositWallets() {
  return WALLET_DEFS.filter((w) => !!process.env[w.envVar]).map((w) => ({
    asset: w.asset,
    name: w.name,
    network: w.network,
    address: process.env[w.envVar],
  }));
}

module.exports = { getDepositWallets };
