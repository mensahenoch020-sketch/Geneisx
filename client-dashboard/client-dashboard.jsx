import React, { useState, useEffect, useMemo } from "react";
import QRCode from "react-qr-code";
import { TrendingUp, TrendingDown, Activity, ArrowDown, ArrowUp, Clock, ShieldCheck, Download, Lock } from "lucide-react";
import VerificationPanel from "./VerificationPanel.jsx";
import { fetchMe, downloadStatement, subscribe, ApiError } from "./api.js";

// Matches the marketing site's palette (theme.css) — merged into one visual
// identity now that the landing page and dashboard are one app.
const COLORS = {
  ink: "#070A08",
  panel: "#0E1510",
  panelBorder: "#1C2A20",
  bone: "#E7EFE9",
  boneDim: "#8CA294",
  gain: "#3FE28E",
  loss: "#e8604c",
  signal: "#E8B84C",
};

function useLivePrice(symbol = "bitcoin") {
  const [price, setPrice] = useState(null);
  const [change, setChange] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let mounted = true;
    async function fetchPrice() {
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd&include_24hr_change=true`
        );
        if (!res.ok) throw new Error("bad response");
        const data = await res.json();
        if (mounted && data[symbol]) {
          setPrice(data[symbol].usd);
          setChange(data[symbol].usd_24h_change);
          setStatus("live");
        }
      } catch (e) {
        if (mounted) setStatus("error");
      }
    }
    fetchPrice();
    const interval = setInterval(fetchPrice, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  return { price, change, status };
}

const fmtUSD = (n, opts = {}) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2, ...opts });

// ---------- Real account data ----------
// The API returns deposits/withdrawals/trades with lowercase enum-ish string
// fields already normalized server-side (see backend/src/lib/ledger.js), so
// the shape here matches what /api/me returns directly — no demo data, no
// client-side balance math duplicating the server's math.

function normalizeClient(apiClient) {
  return {
    name: apiClient.name,
    email: apiClient.email,
    depositReference: apiClient.depositReference,
    depositAddress: apiClient.depositAddress,
    subscriptionTiers: apiClient.subscriptionTiers || [],
    activeSubscription: apiClient.activeSubscription
      ? {
          tierMonths: apiClient.activeSubscription.tierMonths,
          priceUsd: Number(apiClient.activeSubscription.priceUsd),
          startDate: apiClient.activeSubscription.startDate,
          endDate: apiClient.activeSubscription.endDate,
        }
      : null,
    deposits: apiClient.deposits.map((d) => ({
      id: d.id,
      amount: Number(d.amountUsd),
      date: d.date,
    })),
    withdrawals: apiClient.withdrawals.map((w) => ({
      id: w.id,
      amount: Number(w.amountUsd),
      status: w.status.toLowerCase(),
      destination: w.destination,
      date: w.processedAt || w.requestedAt,
    })),
    trades: apiClient.trades
      .filter((t) => t.status === "CLOSED" && t.exit != null)
      .map((t) => ({
        id: t.id,
        asset: t.asset,
        side: t.side.toLowerCase(),
        size: Number(t.size),
        entry: Number(t.entry),
        exit: Number(t.exit),
        date: t.closedAt || t.date,
      })),
  };
}

function tradePnL(t) {
  const diff = t.side === "long" ? t.exit - t.entry : t.entry - t.exit;
  return diff * t.size;
}

function totalDeposited(client) {
  return client.deposits.reduce((s, d) => s + d.amount, 0);
}
function totalWithdrawn(client) {
  return client.withdrawals.filter((w) => w.status === "processed").reduce((s, w) => s + w.amount, 0);
}
function totalPnL(client) {
  return client.trades.reduce((s, t) => s + tradePnL(t), 0);
}
function balance(client) {
  return totalDeposited(client) - totalWithdrawn(client) + totalPnL(client);
}

// P&L realized within the last N days
function pnlSince(client, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return client.trades.filter((t) => new Date(t.date).getTime() >= cutoff).reduce((s, t) => s + tradePnL(t), 0);
}

const RANGES = [
  { key: "7d", label: "1W", days: 7 },
  { key: "30d", label: "1M", days: 30 },
  { key: "90d", label: "3M", days: 90 },
  { key: "180d", label: "6M", days: 180 },
  { key: "365d", label: "1Y", days: 365 },
];

// App.jsx now owns the authed/not-authed decision and renders either
// LoginScreen or this component directly — this file used to have its own
// top-level wrapper doing that same check, which is now redundant since the
// whole site (marketing + dashboard) shares one auth gate at the App level.
export default function ClientDashboard({ onLoggedOut }) {
  const { price: btcPrice, change: btcChange, status: priceStatus } = useLivePrice("bitcoin");
  const [range, setRange] = useState("30d");
  const [client, setClient] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [subscribeError, setSubscribeError] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  async function reload() {
    const data = await fetchMe();
    setClient(normalizeClient(data));
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await fetchMe();
        if (mounted) setClient(normalizeClient(data));
      } catch (err) {
        if (!mounted) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          onLoggedOut();
          return;
        }
        setLoadError(err.message || "Could not load your account");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [onLoggedOut]);

  async function handleDownload(format) {
    setDownloadError("");
    setDownloading(true);
    try {
      await downloadStatement(format);
    } catch (err) {
      setDownloadError(err.message || "Could not download statement");
    } finally {
      setDownloading(false);
    }
  }

  async function handleSubscribe(tierMonths) {
    setSubscribeError("");
    setSubscribing(true);
    try {
      await subscribe(tierMonths);
      await reload();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        onLoggedOut();
        return;
      }
      setSubscribeError(err.message || "Could not start subscription");
    } finally {
      setSubscribing(false);
    }
  }

  const rangeDays = RANGES.find((r) => r.key === range).days;

  // This useMemo must run unconditionally on every render — including while
  // `client` is still null during initial load — or React throws "Rendered
  // fewer hooks than expected" on the render where client first populates.
  const chartData = useMemo(() => (client ? buildEquityCurve(client, rangeDays) : []), [client, rangeDays]);

  if (loadError) {
    return (
      <div
        style={{
          background: COLORS.ink,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: COLORS.loss,
          fontFamily: "'Inter', -apple-system, sans-serif",
          padding: 20,
          textAlign: "center",
        }}
      >
        {loadError}
      </div>
    );
  }

  if (!client) {
    return (
      <div
        style={{
          background: COLORS.ink,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: COLORS.boneDim,
          fontFamily: "'Inter', -apple-system, sans-serif",
        }}
      >
        Loading your account…
      </div>
    );
  }

  const bal = balance(client);
  const deposited = totalDeposited(client);
  const withdrawn = totalWithdrawn(client);
  const pnl = totalPnL(client);
  const rangePnl = pnlSince(client, rangeDays);
  const rangePnlPct = deposited ? (rangePnl / deposited) * 100 : 0;

  const recentTrades = [...client.trades].filter((t) => new Date(t.date).getTime() >= Date.now() - rangeDays * 86400000).reverse();

  // Drives which section leads the page. A first-time client with nothing
  // deposited yet has no use for empty charts and stats — showing those first
  // just makes the page look broken and buries the one thing they actually
  // need to do. Once they've deposited, the normal account-first layout makes
  // more sense, whether or not they've subscribed yet.
  const isNewAccount = client.deposits.length === 0 && client.trades.length === 0;
  const hasSubscription = !!client.activeSubscription;

  const depositSection = (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
        Deposit instructions
      </div>
      <div
        style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 10,
          padding: 18,
        }}
      >
        <div style={{ fontSize: 12.5, color: COLORS.boneDim, lineHeight: 1.6, marginBottom: 14 }}>
          Send BTC to the address below, then message us with the amount and your
          reference code so we can match it to your account. Deposits are logged
          manually once confirmed on-chain — this usually takes a few hours.
        </div>
        <DepositQRCode address={client.depositAddress} />
        <DepositField label="Deposit address" value={client.depositAddress} />
        <DepositField label="Your reference code" value={client.depositReference} mono />
      </div>
    </div>
  );

  const performanceSection = (
    <>
      {/* Balance hero */}
      <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
        <div style={{ fontSize: 12, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
          Account balance
        </div>
        <div className="mono" style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1 }}>
          {fmtUSD(bal)}
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            marginTop: 10,
            fontSize: 13.5,
            color: pnl >= 0 ? COLORS.gain : COLORS.loss,
          }}
          className="mono"
        >
          {pnl >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {pnl >= 0 ? "+" : ""}
          {fmtUSD(pnl)} all-time P&amp;L
        </div>
      </div>

      {/* Range selector */}
      <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 28, marginBottom: 18 }}>
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            style={{
              background: range === r.key ? COLORS.panel : "transparent",
              border: `1px solid ${range === r.key ? COLORS.panelBorder : "transparent"}`,
              color: range === r.key ? COLORS.bone : COLORS.boneDim,
              borderRadius: 7,
              padding: "6px 14px",
              fontSize: 12.5,
              fontWeight: 500,
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <EquityChart data={chartData} />

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {RANGES.find((r) => r.key === range).label} P&amp;L
          </div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: rangePnl >= 0 ? COLORS.gain : COLORS.loss }}>
            {rangePnl >= 0 ? "+" : ""}
            {fmtUSD(rangePnl)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Return on deposits
          </div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: rangePnl >= 0 ? COLORS.gain : COLORS.loss }}>
            {rangePnl >= 0 ? "+" : ""}
            {rangePnlPct.toFixed(2)}%
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 10,
          padding: 14,
          marginBottom: 32,
          fontSize: 12,
          color: COLORS.boneDim,
          lineHeight: 1.6,
        }}
      >
        <ShieldCheck size={15} color={COLORS.boneDim} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          This reflects actual trade performance on your account, not a projected or guaranteed rate. Past results don't
          predict future performance — your balance can go down as well as up.
        </div>
      </div>

      {/* Account summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 32 }}>
        <SummaryCard label="Total deposited" value={fmtUSD(deposited)} />
        <SummaryCard label="Total withdrawn" value={fmtUSD(withdrawn)} />
      </div>

      {/* Recent activity */}
      <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
        Activity — {RANGES.find((r) => r.key === range).label}
      </div>
      {recentTrades.length === 0 ? (
        <div style={{ color: COLORS.boneDim, fontSize: 13.5, padding: "16px 0" }}>No closed trades in this period.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {recentTrades.map((t) => {
            const p = tradePnL(t);
            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: COLORS.panel,
                  border: `1px solid ${COLORS.panelBorder}`,
                  borderRadius: 8,
                  padding: "10px 14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      background: p >= 0 ? "rgba(61,220,151,0.12)" : "rgba(232,96,76,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {p >= 0 ? <TrendingUp size={13} color={COLORS.gain} /> : <TrendingDown size={13} color={COLORS.loss} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      {t.asset} · {t.side}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.boneDim }}>{new Date(t.date).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="mono" style={{ fontSize: 13.5, color: p >= 0 ? COLORS.gain : COLORS.loss }}>
                  {p >= 0 ? "+" : ""}
                  {fmtUSD(p)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  const subscriptionSection = (
    <div style={{ marginTop: 40, paddingTop: 24, borderTop: `1px solid ${COLORS.panelBorder}` }}>
      <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
        Trading subscription
      </div>
      <div
        style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 10,
          padding: 18,
        }}
      >
        {client.activeSubscription ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Lock size={14} color={COLORS.gain} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                Active — {client.activeSubscription.tierMonths} month{client.activeSubscription.tierMonths > 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: COLORS.boneDim, lineHeight: 1.6 }}>
              Runs until {new Date(client.activeSubscription.endDate).toLocaleDateString()}. Withdrawals are
              locked while this is active, since your BTC is being actively traded. You can pick a new tier
              once this one ends.
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12.5, color: COLORS.boneDim, lineHeight: 1.6, marginBottom: 14 }}>
              {isNewAccount
                ? "Once you've deposited, choose a plan below to start trading — the fee comes out of your balance, no separate BTC payment needed."
                : "No active subscription — your funds aren't currently locked, but new trades won't be opened for your account until you choose a plan. The fee is deducted from your account balance immediately, no separate BTC payment needed."}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {client.subscriptionTiers.map((tier) => (
                <button
                  key={tier.tierMonths}
                  onClick={() => handleSubscribe(tier.tierMonths)}
                  disabled={subscribing || isNewAccount}
                  style={{
                    background: COLORS.ink,
                    border: `1px solid ${COLORS.panelBorder}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    color: COLORS.bone,
                    fontSize: 13,
                    textAlign: "left",
                    opacity: subscribing || isNewAccount ? 0.5 : 1,
                    minWidth: 100,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {tier.tierMonths} mo{tier.tierMonths > 1 ? "s" : ""}
                  </div>
                  <div className="mono" style={{ fontSize: 12.5, color: COLORS.boneDim, marginTop: 2 }}>
                    ${tier.priceUsd}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {subscribeError && (
          <div style={{ color: COLORS.loss, fontSize: 12, marginTop: 12 }}>{subscribeError}</div>
        )}
      </div>
    </div>
  );

  const statementsSection = (
    <div style={{ marginTop: 28, paddingTop: 24, borderTop: `1px solid ${COLORS.panelBorder}` }}>
      <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
        Statements
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => handleDownload("pdf")}
          disabled={downloading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: COLORS.panel,
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 8,
            padding: "9px 14px",
            color: COLORS.bone,
            fontSize: 13,
            opacity: downloading ? 0.6 : 1,
          }}
        >
          <Download size={13} /> PDF statement
        </button>
        <button
          onClick={() => handleDownload("csv")}
          disabled={downloading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: COLORS.panel,
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 8,
            padding: "9px 14px",
            color: COLORS.bone,
            fontSize: 13,
            opacity: downloading ? 0.6 : 1,
          }}
        >
          <Download size={13} /> CSV export
        </button>
      </div>
      {downloadError && (
        <div style={{ color: COLORS.loss, fontSize: 12, marginTop: 10 }}>{downloadError}</div>
      )}
    </div>
  );

  return (
    <div style={{ background: COLORS.ink, minHeight: "100vh", color: COLORS.bone, fontFamily: "'Space Grotesk', -apple-system, sans-serif" }}>
      <style>{`
        .mono { font-family: 'IBM Plex Mono', monospace; }
        button { font-family: inherit; cursor: pointer; }
      `}</style>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "120px 18px 60px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <PriceTicker price={btcPrice} change={btcChange} status={priceStatus} />
        </div>

        {isNewAccount && (
          <div
            style={{
              background: "rgba(61,220,151,0.06)",
              border: `1px solid rgba(61,220,151,0.25)`,
              borderRadius: 12,
              padding: 18,
              marginBottom: 28,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Welcome — one step to get started</div>
            <div style={{ fontSize: 13, color: COLORS.boneDim, lineHeight: 1.6 }}>
              Your account is ready, but there's nothing in it yet. Send BTC to the deposit address below, then
              let us know so we can match it to your account. Once that's confirmed, your balance and trade
              history will show up here.
            </div>
          </div>
        )}

        {depositSection}

        <VerificationPanel />

        {!isNewAccount && !hasSubscription && subscriptionSection}

        {!isNewAccount && performanceSection}

        {!isNewAccount && hasSubscription && subscriptionSection}

        {!isNewAccount && statementsSection}
      </main>
    </div>
  );
}

function DepositQRCode({ address }) {
  if (!address) return null;

  // Renders the exact same address string shown as text below it — this is
  // purely a visual re-encoding for scanning convenience, not a separate
  // source of truth. If SHARED_DEPOSIT_ADDRESS is ever wrong, this QR code
  // would just as faithfully encode the wrong address, which is exactly why
  // the raw address is always shown directly underneath for cross-checking.
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        marginBottom: 14,
        background: COLORS.bone,
        borderRadius: 10,
        padding: 16,
        border: `1px solid ${COLORS.panelBorder}`,
      }}
    >
      <QRCode value={address} size={160} bgColor={COLORS.bone} fgColor={COLORS.ink} />
    </div>
  );
}

function DepositField({ label, value, mono }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — user can still select and copy manually
    }
  }
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: COLORS.ink,
          border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 8,
          padding: "10px 12px",
        }}
      >
        <span className={mono ? "mono" : undefined} style={{ fontSize: 13.5, wordBreak: "break-all", paddingRight: 10 }}>
          {value || "—"}
        </span>
        <button
          onClick={copy}
          style={{
            flexShrink: 0,
            background: "transparent",
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 6,
            color: COLORS.bone,
            padding: "5px 10px",
            fontSize: 11.5,
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function PriceTicker({ price, change, status }) {
  const up = change != null && change >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Activity size={12} color={status === "live" ? COLORS.gain : COLORS.boneDim} />
      <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
        {status === "loading" ? "…" : status === "error" ? "—" : fmtUSD(price, { maximumFractionDigits: 0 })}
      </div>
      {status === "live" && change != null && (
        <div className="mono" style={{ fontSize: 11, color: up ? COLORS.gain : COLORS.loss }}>
          {up ? "+" : ""}
          {change.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 10.5, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}

// Builds a running balance curve over the selected range from deposits/withdrawals/trades.
function buildEquityCurve(client, days) {
  const now = Date.now();
  const start = now - days * 86400000;
  const events = [
    ...client.deposits.map((d) => ({ date: d.date, delta: d.amount })),
    ...client.withdrawals.filter((w) => w.status === "processed").map((w) => ({ date: w.date, delta: -w.amount })),
    ...client.trades.map((t) => ({ date: t.date, delta: tradePnL(t) })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  // running balance at `start`
  let runningBalance = 0;
  for (const e of events) {
    if (new Date(e.date).getTime() < start) runningBalance += e.delta;
  }

  const points = [{ t: start, v: runningBalance }];
  for (const e of events) {
    const t = new Date(e.date).getTime();
    if (t >= start) {
      runningBalance += e.delta;
      points.push({ t, v: runningBalance });
    }
  }
  points.push({ t: now, v: runningBalance });
  return points;
}

function EquityChart({ data }) {
  const width = 680;
  const height = 200;
  const padding = 12;

  if (data.length < 2) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: COLORS.boneDim,
          fontSize: 13,
          border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 10,
        }}
      >
        Not enough activity yet to chart this period.
      </div>
    );
  }

  const values = data.map((d) => d.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const tMin = data[0].t;
  const tMax = data[data.length - 1].t;
  const tRange = tMax - tMin || 1;

  const points = data.map((d) => {
    const x = padding + ((d.t - tMin) / tRange) * (width - padding * 2);
    const y = padding + (1 - (d.v - min) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const isUp = values[values.length - 1] >= values[0];
  const lineColor = isUp ? COLORS.gain : COLORS.loss;
  const areaPoints = `${padding},${height - padding} ${points.join(" ")} ${width - padding},${height - padding}`;

  return (
    <div style={{ border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10, background: COLORS.panel, padding: "16px 8px" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#areaFill)" />
        <polyline points={points.join(" ")} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}
