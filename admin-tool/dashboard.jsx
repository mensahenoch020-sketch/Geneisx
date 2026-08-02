import React, { useState, useEffect, useMemo } from "react";
import { Plus, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, X, ChevronRight, Activity, Clock, Check, ArrowDown, ArrowUp, Scale, AlertTriangle, ShieldCheck } from "lucide-react";

// ---------- Design tokens ----------
// Palette: ledger-inspired. Deep ink background, bone paper cards, single signal color (amber for gains, not the default green — feels like a trading tape, not a generic finance app).
// Type: mono for numbers (tabular, ledger feel), a plain sans for everything else.

const COLORS = {
  ink: "#0E1114",
  panel: "#161A1F",
  panelBorder: "#262B32",
  bone: "#E8E4DA",
  boneDim: "#9A9689",
  gain: "#3DDC97",
  loss: "#E8604C",
  signal: "#F2B84B",
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
  n == null
    ? "—"
    : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2, ...opts });

const fmtBTC = (n) => (n == null ? "—" : `${n.toFixed(6)} BTC`);

const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- Seed data (empty — this is a real admin tool, not a demo with fake clients) ----------
const initialClients = [];

export default function AdminDashboard() {
  const { price: btcPrice, change: btcChange, status: priceStatus } = useLivePrice("bitcoin");
  const [clients, setClients] = useState(initialClients);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("clients"); // "clients" | "reconciliation"
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [showAddDeposit, setShowAddDeposit] = useState(false);
  const [showAddWithdrawal, setShowAddWithdrawal] = useState(false);
  const [reconciliations, setReconciliations] = useState([]);

  const selected = clients.find((c) => c.id === selectedId) || null;

  const totals = useMemo(() => {
    const deposited = clients.reduce((s, c) => s + totalDeposited(c), 0);
    const withdrawn = clients.reduce((s, c) => s + totalProcessedWithdrawn(c), 0);
    const pnl = clients.reduce((s, c) => s + clientPnL(c), 0);
    const expectedHoldings = clients.reduce((s, c) => s + clientBalance(c), 0);
    return { deposited, withdrawn, pnl, clientCount: clients.length, expectedHoldings };
  }, [clients]);

  function addReconciliation(actualHoldingsUSD, note) {
    const record = {
      id: uid(),
      date: new Date().toISOString(),
      expected: totals.expectedHoldings,
      actual: parseFloat(actualHoldingsUSD),
      diff: parseFloat(actualHoldingsUSD) - totals.expectedHoldings,
      note: note || "",
    };
    setReconciliations((prev) => [record, ...prev]);
  }

  function addClient(data) {
    const client = {
      id: uid(),
      name: data.name,
      contact: data.contact,
      walletRef: data.walletRef,
      createdAt: new Date().toISOString(),
      deposits: data.initialDeposit ? [{ id: uid(), amount: parseFloat(data.initialDeposit), date: new Date().toISOString() }] : [],
      withdrawals: [],
      trades: [],
    };
    setClients((prev) => [...prev, client]);
    setSelectedId(client.id);
    setView("clients");
    setShowAddClient(false);
  }

  function addDeposit(clientId, data) {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? {
              ...c,
              deposits: [
                ...c.deposits,
                { id: uid(), amount: parseFloat(data.amount), txHash: data.txHash, date: new Date().toISOString() },
              ],
            }
          : c
      )
    );
    setShowAddDeposit(false);
  }

  function addWithdrawal(clientId, data) {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? {
              ...c,
              withdrawals: [
                ...c.withdrawals,
                {
                  id: uid(),
                  amount: parseFloat(data.amount),
                  destination: data.destination,
                  requestedAt: new Date().toISOString(),
                  status: "pending",
                  processedAt: null,
                  txHash: null,
                },
              ],
            }
          : c
      )
    );
    setShowAddWithdrawal(false);
  }

  function markWithdrawalProcessed(clientId, withdrawalId, txHash) {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? {
              ...c,
              withdrawals: c.withdrawals.map((w) =>
                w.id === withdrawalId ? { ...w, status: "processed", processedAt: new Date().toISOString(), txHash } : w
              ),
            }
          : c
      )
    );
  }

  function addTrade(clientId, trade) {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? {
              ...c,
              trades: [
                ...c.trades,
                {
                  id: uid(),
                  asset: trade.asset,
                  side: trade.side,
                  entry: parseFloat(trade.entry),
                  exit: trade.exit ? parseFloat(trade.exit) : null,
                  size: parseFloat(trade.size),
                  date: trade.date || new Date().toISOString(),
                  status: trade.exit ? "closed" : "open",
                },
              ],
            }
          : c
      )
    );
    setShowAddTrade(false);
  }

  return (
    <div style={{ background: COLORS.ink, minHeight: "100vh", color: COLORS.bone, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: ${COLORS.panelBorder}; border-radius: 3px; }
        button { font-family: inherit; cursor: pointer; }
        input, select { font-family: inherit; }
      `}</style>

      {/* Header */}
      <header
        style={{
          borderBottom: `1px solid ${COLORS.panelBorder}`,
          padding: "18px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          background: COLORS.ink,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 30,
              height: 30,
              border: `1.5px solid ${COLORS.signal}`,
              borderRadius: 7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              color: COLORS.signal,
            }}
            className="mono"
          >
            ₿
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.2 }}>Ledger</div>
            <div style={{ fontSize: 11, color: COLORS.boneDim }}>Client &amp; trade management</div>
          </div>
        </div>

        <nav style={{ display: "flex", gap: 4, background: COLORS.panel, borderRadius: 8, padding: 3 }}>
          <button
            onClick={() => setView("clients")}
            style={{
              background: view === "clients" ? COLORS.panelBorder : "transparent",
              color: view === "clients" ? COLORS.bone : COLORS.boneDim,
              border: "none",
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: 12.5,
              fontWeight: 500,
            }}
          >
            Clients
          </button>
          <button
            onClick={() => {
              setView("reconciliation");
              setSelectedId(null);
            }}
            style={{
              background: view === "reconciliation" ? COLORS.panelBorder : "transparent",
              color: view === "reconciliation" ? COLORS.bone : COLORS.boneDim,
              border: "none",
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: 12.5,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Scale size={12} /> Reconciliation
          </button>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <PriceTicker price={btcPrice} change={btcChange} status={priceStatus} />
        </div>
      </header>

      <div style={{ display: "flex", minHeight: "calc(100vh - 68px)" }}>
        {/* Client list */}
        <aside
          style={{
            width: 300,
            borderRight: `1px solid ${COLORS.panelBorder}`,
            padding: "20px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
            <span style={{ fontSize: 11, letterSpacing: 1, color: COLORS.boneDim, textTransform: "uppercase" }}>
              Clients · {clients.length}
            </span>
            <button
              onClick={() => setShowAddClient(true)}
              style={{
                background: "transparent",
                border: `1px solid ${COLORS.panelBorder}`,
                borderRadius: 6,
                color: COLORS.bone,
                width: 26,
                height: 26,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Add client"
            >
              <Plus size={14} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }} className="scrollbar-thin">
            {clients.length === 0 && (
              <div style={{ padding: "24px 12px", textAlign: "center", color: COLORS.boneDim, fontSize: 13, lineHeight: 1.6 }}>
                No clients yet. Add your first client to start tracking their account.
              </div>
            )}
            {clients.map((c) => {
              const pnl = clientPnL(c);
              const isSelected = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    background: isSelected ? COLORS.panel : "transparent",
                    border: `1px solid ${isSelected ? COLORS.panelBorder : "transparent"}`,
                    borderRadius: 8,
                    padding: "10px 12px",
                    textAlign: "left",
                    color: COLORS.bone,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>{c.name}</span>
                    <ChevronRight size={14} color={COLORS.boneDim} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="mono" style={{ fontSize: 11.5, color: COLORS.boneDim }}>
                      {fmtUSD(clientBalance(c))}
                    </span>
                    <span className="mono" style={{ fontSize: 11.5, color: pnl >= 0 ? COLORS.gain : COLORS.loss }}>
                      {pnl >= 0 ? "+" : ""}
                      {fmtUSD(pnl)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main panel */}
        <main style={{ flex: 1, padding: "24px 32px" }}>
          {view === "reconciliation" ? (
            <ReconciliationPanel totals={totals} records={reconciliations} onSubmit={addReconciliation} btcPrice={btcPrice} />
          ) : !selected ? (
            <OverviewPanel clients={clients} totals={totals} onAddClient={() => setShowAddClient(true)} />
          ) : (
            <ClientPanel
              client={selected}
              onAddTrade={() => setShowAddTrade(true)}
              onAddDeposit={() => setShowAddDeposit(true)}
              onAddWithdrawal={() => setShowAddWithdrawal(true)}
              onMarkProcessed={(withdrawalId, txHash) => markWithdrawalProcessed(selected.id, withdrawalId, txHash)}
              btcPrice={btcPrice}
            />
          )}
        </main>
      </div>

      {showAddClient && <AddClientModal onClose={() => setShowAddClient(false)} onSubmit={addClient} />}
      {showAddTrade && selected && (
        <AddTradeModal onClose={() => setShowAddTrade(false)} onSubmit={(t) => addTrade(selected.id, t)} />
      )}
      {showAddDeposit && selected && (
        <AddDepositModal onClose={() => setShowAddDeposit(false)} onSubmit={(d) => addDeposit(selected.id, d)} />
      )}
      {showAddWithdrawal && selected && (
        <AddWithdrawalModal onClose={() => setShowAddWithdrawal(false)} onSubmit={(w) => addWithdrawal(selected.id, w)} />
      )}
    </div>
  );
}

function PriceTicker({ price, change, status }) {
  const up = change != null && change >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Activity size={13} color={status === "live" ? COLORS.gain : COLORS.boneDim} />
      <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>
        {status === "loading" ? "loading…" : status === "error" ? "price unavailable" : fmtUSD(price, { maximumFractionDigits: 0 })}
      </div>
      {status === "live" && change != null && (
        <div
          className="mono"
          style={{
            fontSize: 12,
            color: up ? COLORS.gain : COLORS.loss,
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(change).toFixed(2)}%
        </div>
      )}
    </div>
  );
}

function OverviewPanel({ clients, totals, onAddClient }) {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: -0.3 }}>Overview</h1>
        <p style={{ color: COLORS.boneDim, fontSize: 13.5, marginTop: 4 }}>Across all client accounts</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 32 }}>
        <StatCard label="Total deposited" value={fmtUSD(totals.deposited)} />
        <StatCard
          label="Total P&L"
          value={`${totals.pnl >= 0 ? "+" : ""}${fmtUSD(totals.pnl)}`}
          color={totals.pnl >= 0 ? COLORS.gain : COLORS.loss}
        />
        <StatCard label="Active clients" value={totals.clientCount} />
      </div>

      {clients.length === 0 ? (
        <EmptyState onAddClient={onAddClient} />
      ) : (
        <div style={{ color: COLORS.boneDim, fontSize: 13.5 }}>Select a client on the left to view their account.</div>
      )}
    </div>
  );
}

function EmptyState({ onAddClient }) {
  return (
    <div
      style={{
        border: `1px dashed ${COLORS.panelBorder}`,
        borderRadius: 12,
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <Wallet size={22} color={COLORS.boneDim} style={{ marginBottom: 12 }} />
      <div style={{ fontSize: 14.5, fontWeight: 500, marginBottom: 4 }}>No client accounts yet</div>
      <div style={{ fontSize: 13, color: COLORS.boneDim, marginBottom: 18, maxWidth: 360, marginInline: "auto", lineHeight: 1.6 }}>
        Add a client to start tracking their deposits and trades. Each client's account is fully separate — their balance and P&L are theirs alone.
      </div>
      <button
        onClick={onAddClient}
        style={{
          background: COLORS.signal,
          color: COLORS.ink,
          border: "none",
          borderRadius: 8,
          padding: "9px 18px",
          fontSize: 13.5,
          fontWeight: 600,
        }}
      >
        Add first client
      </button>
    </div>
  );
}

function ReconciliationPanel({ totals, records, onSubmit, btcPrice }) {
  const [actual, setActual] = useState("");
  const [note, setNote] = useState("");
  const latest = records[0];
  const expectedBTC = btcPrice ? totals.expectedHoldings / btcPrice : null;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: -0.3, display: "flex", alignItems: "center", gap: 8 }}>
          <Scale size={19} /> Reconciliation
        </h1>
        <p style={{ color: COLORS.boneDim, fontSize: 13.5, marginTop: 4, maxWidth: 560, lineHeight: 1.6 }}>
          Compares what the ledger says clients are owed against what you actually hold in the wallet. Run this regularly —
          it's how a custody gap gets caught early instead of after a client asks.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 24 }}>
        <StatCard label="Expected holdings (ledger)" value={fmtUSD(totals.expectedHoldings)} />
        <StatCard
          label="≈ BTC at current price"
          value={expectedBTC != null ? fmtBTC(expectedBTC) : "—"}
        />
      </div>

      <div
        style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 10,
          padding: 20,
          marginBottom: 28,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Run a new check</div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={labelStyle}>Actual wallet balance (USD equivalent)</label>
            <input
              style={{ ...inputStyle, marginBottom: 0 }}
              type="number"
              step="0.01"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              placeholder="What the wallet/exchange shows right now"
            />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={labelStyle}>Note (optional)</label>
            <input style={{ ...inputStyle, marginBottom: 0 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. checked via block explorer" />
          </div>
          <button
            onClick={() => {
              if (!actual) return;
              onSubmit(actual, note);
              setActual("");
              setNote("");
            }}
            style={{ ...primaryBtnStyle, height: 37 }}
            disabled={!actual}
          >
            Run check
          </button>
        </div>
      </div>

      {latest && (
        <ReconciliationResult record={latest} />
      )}

      {records.length > 1 && (
        <>
          <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, margin: "24px 0 10px" }}>
            History
          </div>
          <div style={{ border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: COLORS.panel }}>
                  {["Date", "Expected", "Actual", "Difference", "Note"].map((h) => (
                    <th key={h} style={theadCellStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.slice(1).map((r) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${COLORS.panelBorder}` }}>
                    <td style={{ ...cellStyle, color: COLORS.boneDim, fontSize: 12 }}>{new Date(r.date).toLocaleString()}</td>
                    <td style={cellStyle} className="mono">{fmtUSD(r.expected)}</td>
                    <td style={cellStyle} className="mono">{fmtUSD(r.actual)}</td>
                    <td style={{ ...cellStyle, color: Math.abs(r.diff) < 0.01 ? COLORS.gain : COLORS.loss }} className="mono">
                      {r.diff >= 0 ? "+" : ""}
                      {fmtUSD(r.diff)}
                    </td>
                    <td style={{ ...cellStyle, color: COLORS.boneDim }}>{r.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {records.length === 0 && (
        <div style={{ color: COLORS.boneDim, fontSize: 13.5, padding: "12px 0" }}>
          No reconciliation checks run yet. Enter your actual wallet balance above to run the first one.
        </div>
      )}
    </div>
  );
}

function ReconciliationResult({ record }) {
  const isMatch = Math.abs(record.diff) < 0.01;
  const isShort = record.diff < 0; // wallet holds less than ledger says it should
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        background: isMatch ? "rgba(61,220,151,0.08)" : "rgba(232,96,76,0.08)",
        border: `1px solid ${isMatch ? "rgba(61,220,151,0.3)" : "rgba(232,96,76,0.3)"}`,
        borderRadius: 10,
        padding: 16,
      }}
    >
      {isMatch ? <ShieldCheck size={18} color={COLORS.gain} /> : <AlertTriangle size={18} color={COLORS.loss} />}
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: isMatch ? COLORS.gain : COLORS.loss, marginBottom: 4 }}>
          {isMatch ? "Balances match" : isShort ? "Wallet holds less than the ledger expects" : "Wallet holds more than the ledger expects"}
        </div>
        <div style={{ fontSize: 12.5, color: COLORS.boneDim, lineHeight: 1.6 }}>
          {isMatch
            ? "Actual wallet balance matches what clients are owed according to the ledger."
            : isShort
            ? `The wallet is short by ${fmtUSD(Math.abs(record.diff))} relative to what clients are collectively owed. Investigate before this compounds — check for unrecorded withdrawals, fees, or a logging error.`
            : `The wallet holds ${fmtUSD(Math.abs(record.diff))} more than the ledger accounts for. Check for unrecorded deposits or trades before assuming it's a safe surplus.`}
        </div>
        <div style={{ fontSize: 11, color: COLORS.boneDim, marginTop: 6 }}>
          Checked {new Date(record.date).toLocaleString()}
        </div>
      </div>
    </div>
  );
}


  return (
    <div
      style={{
        border: `1px dashed ${COLORS.panelBorder}`,
        borderRadius: 12,
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <Wallet size={22} color={COLORS.boneDim} style={{ marginBottom: 12 }} />
      <div style={{ fontSize: 14.5, fontWeight: 500, marginBottom: 4 }}>No client accounts yet</div>
      <div style={{ fontSize: 13, color: COLORS.boneDim, marginBottom: 18, maxWidth: 360, marginInline: "auto", lineHeight: 1.6 }}>
        Add a client to start tracking their deposits and trades. Each client's account is fully separate — their balance and P&L are theirs alone.
      </div>
      <button
        onClick={onAddClient}
        style={{
          background: COLORS.signal,
          color: COLORS.ink,
          border: "none",
          borderRadius: 8,
          padding: "9px 18px",
          fontSize: 13.5,
          fontWeight: 600,
        }}
      >
        Add first client
      </button>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: color || COLORS.bone }}>
        {value}
      </div>
    </div>
  );
}

function ClientPanel({ client, onAddTrade, onAddDeposit, onAddWithdrawal, onMarkProcessed, btcPrice }) {
  const deposited = totalDeposited(client);
  const pnl = clientPnL(client);
  const withdrawn = totalProcessedWithdrawn(client);
  const pending = totalPendingWithdrawal(client);
  const balance = clientBalance(client);

  // Combined, time-sorted history of deposits, withdrawals, and closed trades
  const history = useMemo(() => {
    const items = [
      ...client.deposits.map((d) => ({ type: "deposit", date: d.date, ...d })),
      ...client.withdrawals.map((w) => ({ type: "withdrawal", date: w.requestedAt, ...w })),
      ...client.trades
        .filter((t) => t.status === "closed")
        .map((t) => ({ type: "trade", date: t.date, ...t })),
    ];
    return items.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [client]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: -0.3 }}>{client.name}</h1>
          <p style={{ color: COLORS.boneDim, fontSize: 13, marginTop: 4 }}>
            {client.contact} {client.walletRef ? `· ${client.walletRef}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onAddDeposit} style={secondaryBtnStyle}>
            <ArrowDown size={14} /> Deposit
          </button>
          <button onClick={onAddWithdrawal} style={secondaryBtnStyle}>
            <ArrowUp size={14} /> Withdraw
          </button>
          <button onClick={onAddTrade} style={primaryBtnStyle}>
            <Plus size={14} /> Log trade
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 14 }}>
        <StatCard label="Deposited" value={fmtUSD(deposited)} />
        <StatCard label="Withdrawn" value={fmtUSD(withdrawn)} />
        <StatCard label="Balance" value={fmtUSD(balance)} />
        <StatCard label="P&L" value={`${pnl >= 0 ? "+" : ""}${fmtUSD(pnl)}`} color={pnl >= 0 ? COLORS.gain : COLORS.loss} />
      </div>

      {pending > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(242,184,75,0.08)",
            border: `1px solid rgba(242,184,75,0.25)`,
            borderRadius: 8,
            padding: "9px 14px",
            fontSize: 12.5,
            color: COLORS.signal,
            marginBottom: 24,
          }}
        >
          <Clock size={13} />
          {fmtUSD(pending)} pending withdrawal — not yet deducted from balance above until processed
        </div>
      )}
      {pending === 0 && <div style={{ marginBottom: 24 }} />}

      {/* Pending withdrawals needing action */}
      {client.withdrawals.some((w) => w.status === "pending") && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
            Pending withdrawals
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {client.withdrawals
              .filter((w) => w.status === "pending")
              .map((w) => (
                <PendingWithdrawalRow key={w.id} withdrawal={w} onMarkProcessed={onMarkProcessed} />
              ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
        Transaction history
      </div>

      {history.length === 0 ? (
        <div style={{ color: COLORS.boneDim, fontSize: 13.5, padding: "24px 0" }}>No activity logged for this client yet.</div>
      ) : (
        <div style={{ border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: COLORS.panel }}>
                {["Type", "Detail", "Amount", "Tx hash", "Date"].map((h) => (
                  <th key={h} style={theadCellStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <HistoryRow key={`${item.type}-${item.id}`} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HistoryRow({ item }) {
  if (item.type === "deposit") {
    return (
      <tr style={{ borderBottom: `1px solid ${COLORS.panelBorder}` }}>
        <td style={cellStyle}>
          <TypeBadge label="Deposit" color={COLORS.gain} />
        </td>
        <td style={{ ...cellStyle, color: COLORS.boneDim }}>Received</td>
        <td style={{ ...cellStyle, color: COLORS.gain }} className="mono">
          +{fmtUSD(item.amount)}
        </td>
        <td style={{ ...cellStyle, color: COLORS.boneDim, fontSize: 11.5 }} className="mono">
          {truncateHash(item.txHash)}
        </td>
        <td style={{ ...cellStyle, color: COLORS.boneDim, fontSize: 12 }}>{new Date(item.date).toLocaleDateString()}</td>
      </tr>
    );
  }
  if (item.type === "withdrawal") {
    return (
      <tr style={{ borderBottom: `1px solid ${COLORS.panelBorder}` }}>
        <td style={cellStyle}>
          <TypeBadge label="Withdrawal" color={COLORS.loss} />
        </td>
        <td style={{ ...cellStyle, color: COLORS.boneDim }}>
          {item.status === "processed" ? "Sent" : "Pending"} {item.destination ? `→ ${truncateHash(item.destination)}` : ""}
        </td>
        <td style={{ ...cellStyle, color: COLORS.loss }} className="mono">
          −{fmtUSD(item.amount)}
        </td>
        <td style={{ ...cellStyle, color: COLORS.boneDim, fontSize: 11.5 }} className="mono">
          {truncateHash(item.txHash)}
        </td>
        <td style={{ ...cellStyle, color: COLORS.boneDim, fontSize: 12 }}>{new Date(item.date).toLocaleDateString()}</td>
      </tr>
    );
  }
  // trade
  const p = tradePnL(item);
  return (
    <tr style={{ borderBottom: `1px solid ${COLORS.panelBorder}` }}>
      <td style={cellStyle}>
        <TypeBadge label="Trade" color={COLORS.signal} />
      </td>
      <td style={{ ...cellStyle, color: COLORS.boneDim }} className="mono">
        {item.asset} · {item.side} · {item.size}
      </td>
      <td style={{ ...cellStyle, color: p >= 0 ? COLORS.gain : COLORS.loss }} className="mono">
        {p >= 0 ? "+" : ""}
        {fmtUSD(p)}
      </td>
      <td style={{ ...cellStyle, color: COLORS.boneDim, fontSize: 11.5 }}>—</td>
      <td style={{ ...cellStyle, color: COLORS.boneDim, fontSize: 12 }}>{new Date(item.date).toLocaleDateString()}</td>
    </tr>
  );
}

function TypeBadge({ label, color }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 20,
        background: `${color}18`,
        color,
        fontWeight: 500,
      }}
    >
      {label}
    </span>
  );
}

function PendingWithdrawalRow({ withdrawal, onMarkProcessed }) {
  const [txHash, setTxHash] = useState("");
  const [showInput, setShowInput] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: COLORS.panel,
        border: `1px solid ${COLORS.panelBorder}`,
        borderRadius: 8,
        padding: "10px 14px",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 200 }}>
        <Clock size={14} color={COLORS.signal} />
        <div>
          <div className="mono" style={{ fontSize: 13.5, fontWeight: 500 }}>
            {fmtUSD(withdrawal.amount)}
          </div>
          <div style={{ fontSize: 11.5, color: COLORS.boneDim }}>
            Requested {new Date(withdrawal.requestedAt).toLocaleDateString()}
            {withdrawal.destination ? ` · → ${truncateHash(withdrawal.destination)}` : ""}
          </div>
        </div>
      </div>

      {!showInput ? (
        <button onClick={() => setShowInput(true)} style={{ ...secondaryBtnStyle, padding: "6px 12px" }}>
          <Check size={13} /> Mark processed
        </button>
      ) : (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            placeholder="Tx hash"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            style={{ ...inputStyle, width: 180, marginBottom: 0, padding: "6px 10px", fontSize: 12.5 }}
          />
          <button
            onClick={() => txHash.trim() && onMarkProcessed(withdrawal.id, txHash.trim())}
            style={{ ...primaryBtnStyle, padding: "7px 12px" }}
            disabled={!txHash.trim()}
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}

function truncateHash(hash) {
  if (!hash) return "—";
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

const cellStyle = { padding: "10px 14px", fontSize: 13 };
const theadCellStyle = {
  textAlign: "left",
  padding: "10px 14px",
  fontSize: 11,
  color: COLORS.boneDim,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  fontWeight: 500,
  borderBottom: `1px solid ${COLORS.panelBorder}`,
};

const primaryBtnStyle = {
  background: COLORS.signal,
  color: COLORS.ink,
  border: "none",
  borderRadius: 8,
  padding: "9px 16px",
  fontSize: 13.5,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const secondaryBtnStyle = {
  background: "transparent",
  color: COLORS.bone,
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 8,
  padding: "9px 14px",
  fontSize: 13.5,
  fontWeight: 500,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

function tradePnL(t) {
  if (t.exit == null) return null;
  const diff = t.side === "long" ? t.exit - t.entry : t.entry - t.exit;
  return diff * t.size;
}

function clientPnL(client) {
  return client.trades.reduce((sum, t) => {
    const p = tradePnL(t);
    return sum + (p || 0);
  }, 0);
}

function totalDeposited(client) {
  return client.deposits.reduce((s, d) => s + d.amount, 0);
}

function totalProcessedWithdrawn(client) {
  return client.withdrawals.filter((w) => w.status === "processed").reduce((s, w) => s + w.amount, 0);
}

function totalPendingWithdrawal(client) {
  return client.withdrawals.filter((w) => w.status === "pending").reduce((s, w) => s + w.amount, 0);
}

function clientBalance(client) {
  return totalDeposited(client) - totalProcessedWithdrawn(client) + clientPnL(client);
}

// ---------- Modals ----------

function ModalShell({ title, onClose, children }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 12,
          width: 420,
          maxWidth: "100%",
          padding: 22,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: COLORS.boneDim, padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: COLORS.ink,
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 7,
  padding: "9px 11px",
  color: COLORS.bone,
  fontSize: 13.5,
  marginBottom: 14,
  outline: "none",
};

const labelStyle = { fontSize: 12, color: COLORS.boneDim, marginBottom: 6, display: "block" };

function AddClientModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ name: "", contact: "", walletRef: "", initialDeposit: "" });
  return (
    <ModalShell title="Add client" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim()) return;
          onSubmit(form);
        }}
      >
        <label style={labelStyle}>Full name</label>
        <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

        <label style={labelStyle}>Contact (email or phone)</label>
        <input style={inputStyle} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />

        <label style={labelStyle}>Wallet / account reference</label>
        <input style={inputStyle} value={form.walletRef} onChange={(e) => setForm({ ...form, walletRef: e.target.value })} />

        <label style={labelStyle}>Initial deposit (USD)</label>
        <input
          style={inputStyle}
          type="number"
          step="0.01"
          value={form.initialDeposit}
          onChange={(e) => setForm({ ...form, initialDeposit: e.target.value })}
        />

        <button
          type="submit"
          style={{
            width: "100%",
            background: COLORS.signal,
            color: COLORS.ink,
            border: "none",
            borderRadius: 8,
            padding: "10px",
            fontSize: 13.5,
            fontWeight: 600,
            marginTop: 4,
          }}
        >
          Add client
        </button>
      </form>
    </ModalShell>
  );
}

function AddDepositModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ amount: "", txHash: "" });
  const valid = form.amount && form.txHash.trim();
  return (
    <ModalShell title="Log deposit" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onSubmit(form);
        }}
      >
        <label style={labelStyle}>Amount (USD equivalent)</label>
        <input
          style={inputStyle}
          type="number"
          step="0.01"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          required
        />

        <label style={labelStyle}>On-chain transaction hash</label>
        <input
          style={inputStyle}
          value={form.txHash}
          onChange={(e) => setForm({ ...form, txHash: e.target.value })}
          placeholder="Required — proof the BTC arrived"
          required
        />
        <div style={{ fontSize: 11.5, color: COLORS.boneDim, marginTop: -8, marginBottom: 14 }}>
          Confirm the transaction on-chain before logging it — this record is the client's proof of deposit.
        </div>

        <button type="submit" style={{ ...primaryBtnStyle, width: "100%", justifyContent: "center" }} disabled={!valid}>
          Log deposit
        </button>
      </form>
    </ModalShell>
  );
}

function AddWithdrawalModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ amount: "", destination: "" });
  const valid = form.amount && form.destination.trim();
  return (
    <ModalShell title="Request withdrawal" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onSubmit(form);
        }}
      >
        <label style={labelStyle}>Amount (USD equivalent)</label>
        <input
          style={inputStyle}
          type="number"
          step="0.01"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          required
        />

        <label style={labelStyle}>Destination wallet address</label>
        <input
          style={inputStyle}
          value={form.destination}
          onChange={(e) => setForm({ ...form, destination: e.target.value })}
          placeholder="Where the BTC will be sent"
          required
        />
        <div style={{ fontSize: 11.5, color: COLORS.boneDim, marginTop: -8, marginBottom: 14 }}>
          This creates a pending request. Mark it processed — with the outgoing tx hash — once you've actually sent the funds.
        </div>

        <button type="submit" style={{ ...primaryBtnStyle, width: "100%", justifyContent: "center" }} disabled={!valid}>
          Create pending withdrawal
        </button>
      </form>
    </ModalShell>
  );
}

function AddTradeModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ asset: "BTC", side: "long", size: "", entry: "", exit: "" });
  return (
    <ModalShell title="Log trade" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.size || !form.entry) return;
          onSubmit(form);
        }}
      >
        <label style={labelStyle}>Asset</label>
        <input style={inputStyle} value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value })} />

        <label style={labelStyle}>Side</label>
        <select
          style={inputStyle}
          value={form.side}
          onChange={(e) => setForm({ ...form, side: e.target.value })}
        >
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>

        <label style={labelStyle}>Size</label>
        <input style={inputStyle} type="number" step="any" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} required />

        <label style={labelStyle}>Entry price (USD)</label>
        <input style={inputStyle} type="number" step="any" value={form.entry} onChange={(e) => setForm({ ...form, entry: e.target.value })} required />

        <label style={labelStyle}>Exit price (USD) — leave blank if still open</label>
        <input style={inputStyle} type="number" step="any" value={form.exit} onChange={(e) => setForm({ ...form, exit: e.target.value })} />

        <button
          type="submit"
          style={{
            width: "100%",
            background: COLORS.signal,
            color: COLORS.ink,
            border: "none",
            borderRadius: 8,
            padding: "10px",
            fontSize: 13.5,
            fontWeight: 600,
            marginTop: 4,
          }}
        >
          Log trade
        </button>
      </form>
    </ModalShell>
  );
}
