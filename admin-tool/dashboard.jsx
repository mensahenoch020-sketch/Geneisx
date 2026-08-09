import React, { useState, useEffect, useMemo } from "react";
import { Plus, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, X, ChevronRight, Activity, Clock, Check, ArrowDown, ArrowUp, Scale, AlertTriangle, ShieldCheck, ShieldAlert, Trash2, Pencil, Download, LogOut, MessageCircle, Send } from "lucide-react";
import StaffLoginScreen from "./StaffLoginScreen.jsx";
import {
  getToken,
  clearToken,
  listClients,
  getClient,
  createClient,
  createDeposit,
  editDeposit,
  deleteDeposit,
  createWithdrawal,
  processWithdrawal,
  editWithdrawal,
  deleteWithdrawal,
  createTrade,
  closeTrade,
  editTrade,
  deleteTrade,
  blockClient,
  deleteClient,
  getExpectedHoldings,
  getRevenue,
  getVerificationQueue,
  reviewVerification,
  viewVerificationDocument,
  runReconciliationCheck,
  getReconciliationHistory,
  downloadClientStatement,
  getConversations,
  getConversationThread,
  sendStaffMessage,
  getTierReturnEstimates,
  setTierReturnEstimate,
  ApiError,
} from "./api.js";

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

// Normalizes API shapes (Decimal-as-string amounts, UPPERCASE enums) into the
// lowercase/number shape this component's existing UI code already expects,
// so the JSX below didn't need to be rewritten from scratch.
function normalizeClientSummary(c) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    contact: c.contact,
    walletRef: c.walletRef,
    depositReference: c.depositReference,
    createdAt: c.createdAt,
    blocked: !!c.blocked,
    activeSubscription: c.activeSubscription || null,
    // full detail (deposits/withdrawals/trades) is loaded lazily per-client via getClient()
    deposits: [],
    withdrawals: [],
    trades: [],
    _balance: c.balance,
    _pnl: c.pnl,
  };
}

function normalizeClientDetail(c) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    contact: c.contact,
    walletRef: c.walletRef,
    depositReference: c.depositReference,
    createdAt: c.createdAt,
    blocked: !!c.blocked,
    activeSubscription: c.activeSubscription || null,
    deposits: c.deposits.map((d) => ({ id: d.id, amount: Number(d.amountUsd), txHash: d.txHash, date: d.date })),
    withdrawals: c.withdrawals.map((w) => ({
      id: w.id,
      amount: Number(w.amountUsd),
      destination: w.destination,
      status: w.status.toLowerCase(),
      requestedAt: w.requestedAt,
      processedAt: w.processedAt,
      txHash: w.txHash,
    })),
    trades: c.trades.map((t) => ({
      id: t.id,
      asset: t.asset,
      side: t.side.toLowerCase(),
      size: Number(t.size),
      entry: Number(t.entry),
      exit: t.exit != null ? Number(t.exit) : null,
      date: t.date,
      status: t.status.toLowerCase(),
    })),
  };
}

function normalizeReconciliationRecord(r) {
  return {
    id: r.id,
    date: r.createdAt,
    expected: Number(r.expectedUsd),
    actual: Number(r.actualUsd),
    diff: Number(r.diffUsd),
    note: r.note || "",
  };
}

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(() => !!getToken());

  if (!authed) {
    return <StaffLoginScreen onAuthenticated={() => setAuthed(true)} />;
  }

  return <AdminDashboardAuthed onLoggedOut={() => setAuthed(false)} />;
}

function AdminDashboardAuthed({ onLoggedOut }) {
  const { price: btcPrice, change: btcChange, status: priceStatus } = useLivePrice("bitcoin");
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("clients"); // "clients" | "reconciliation"
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [showAddDeposit, setShowAddDeposit] = useState(false);
  const [showAddWithdrawal, setShowAddWithdrawal] = useState(false);
  const [reconciliations, setReconciliations] = useState([]);
  const [expectedHoldings, setExpectedHoldings] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [loadingClients, setLoadingClients] = useState(true);
  const [newlyCreatedClient, setNewlyCreatedClient] = useState(null); // shows the one-time temp password
  const [clientFilter, setClientFilter] = useState("");
  const [revenue, setRevenue] = useState(null);
  const [verificationQueue, setVerificationQueue] = useState([]);
  const [verificationQueueCount, setVerificationQueueCount] = useState(0);
  const [conversations, setConversations] = useState([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  const selected = clients.find((c) => c.id === selectedId) || null;

  function handleAuthError(err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      onLoggedOut();
      return true;
    }
    return false;
  }

  async function reloadClientList() {
    try {
      const data = await listClients();
      setClients((prev) => {
        // Preserve any already-loaded detail (deposits/withdrawals/trades) for
        // the currently selected client rather than wiping it back to empty.
        const byId = Object.fromEntries(prev.map((c) => [c.id, c]));
        return data.map((c) => {
          const existing = byId[c.id];
          const summary = normalizeClientSummary(c);
          return existing && existing.deposits.length + existing.withdrawals.length + existing.trades.length > 0
            ? { ...summary, deposits: existing.deposits, withdrawals: existing.withdrawals, trades: existing.trades }
            : summary;
        });
      });
    } catch (err) {
      if (!handleAuthError(err)) setLoadError(err.message || "Could not load clients");
    }
  }

  async function reloadReconciliation() {
    try {
      const [expected, history] = await Promise.all([getExpectedHoldings(), getReconciliationHistory()]);
      setExpectedHoldings(expected.expectedHoldingsUsd);
      setReconciliations(history.map(normalizeReconciliationRecord));
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not load reconciliation data");
    }
  }

  async function reloadRevenue() {
    try {
      const data = await getRevenue();
      setRevenue(data);
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not load revenue summary");
    }
  }

  async function reloadVerificationQueue() {
    try {
      const data = await getVerificationQueue();
      setVerificationQueue(data);
      setVerificationQueueCount(data.length);
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not load verification queue");
    }
  }

  async function reloadConversations() {
    try {
      const data = await getConversations();
      setConversations(data.conversations);
      setUnreadMessagesCount(data.conversations.reduce((sum, c) => sum + c.unreadCount, 0));
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not load messages");
    }
  }

  useEffect(() => {
    let mounted = true;
    async function init() {
      setLoadingClients(true);
      await reloadClientList();
      await reloadRevenue();
      await reloadVerificationQueue(); // loaded up front so the nav badge count shows before switching tabs
      await reloadConversations(); // same reasoning — badge count needs to be ready before switching tabs
      if (mounted) setLoadingClients(false);
    }
    init();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view === "reconciliation") reloadReconciliation();
    if (view === "verification") reloadVerificationQueue();
    if (view === "messages") reloadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Keeps the unread-messages nav badge current even while staff are on a
  // different tab, so a new client message doesn't sit unnoticed.
  useEffect(() => {
    const interval = setInterval(() => {
      reloadConversations();
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectClient(id) {
    setSelectedId(id);
    setActionError("");
    try {
      const detail = await getClient(id);
      const normalized = normalizeClientDetail(detail);
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...normalized } : c)));
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not load client detail");
    }
  }

  const totals = useMemo(() => {
    const deposited = clients.reduce((s, c) => s + (c.deposits.length ? totalDeposited(c) : 0), 0);
    const withdrawn = clients.reduce((s, c) => s + (c.withdrawals.length ? totalProcessedWithdrawn(c) : 0), 0);
    const pnl = clients.reduce((s, c) => s + (c._pnl ?? clientPnL(c)), 0);
    const summedBalance = clients.reduce((s, c) => s + (c._balance ?? clientBalance(c)), 0);
    return { deposited, withdrawn, pnl, clientCount: clients.length, expectedHoldings: summedBalance };
  }, [clients]);

  const filteredClients = useMemo(() => {
    const q = clientFilter.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      return (
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.depositReference?.toLowerCase().includes(q)
      );
    });
  }, [clients, clientFilter]);

  async function addReconciliation(actualHoldingsUSD, note) {
    setActionError("");
    try {
      await runReconciliationCheck(parseFloat(actualHoldingsUSD), note || undefined);
      await reloadReconciliation();
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not run reconciliation check");
    }
  }

  async function addClient(data) {
    setActionError("");
    try {
      const created = await createClient({
        name: data.name,
        email: data.email,
        contact: data.contact || undefined,
        walletRef: data.walletRef || undefined,
      });
      if (data.initialDeposit && parseFloat(data.initialDeposit) > 0) {
        setActionError(
          "Client created. Note: log the initial deposit separately with its on-chain transaction hash — deposits require proof and can't be created without one."
        );
      }
      setNewlyCreatedClient(created); // { id, name, email, tempPassword } — shown once
      await reloadClientList();
      setSelectedId(created.id);
      await selectClient(created.id);
      setView("clients");
      setShowAddClient(false);
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not create client");
    }
  }

  async function addDeposit(clientId, data) {
    setActionError("");
    try {
      await createDeposit({ clientId, amountUsd: parseFloat(data.amount), txHash: data.txHash });
      await selectClient(clientId);
      await reloadClientList();
      setShowAddDeposit(false);
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not log deposit");
    }
  }

  async function addWithdrawal(clientId, data) {
    setActionError("");
    try {
      await createWithdrawal({ clientId, amountUsd: parseFloat(data.amount), destination: data.destination });
      await selectClient(clientId);
      await reloadClientList();
      setShowAddWithdrawal(false);
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not create withdrawal request");
    }
  }

  async function markWithdrawalProcessed(clientId, withdrawalId, txHash) {
    setActionError("");
    try {
      await processWithdrawal(withdrawalId, txHash);
      await selectClient(clientId);
      await reloadClientList();
    } catch (err) {
      if (!handleAuthError(err)) {
        setActionError(
          err.message ||
            "Could not mark withdrawal processed — this action requires the Owner role and 2FA on login."
        );
      }
    }
  }

  async function addTrade(clientId, trade) {
    setActionError("");
    try {
      await createTrade({
        clientId,
        asset: trade.asset,
        side: trade.side,
        size: parseFloat(trade.size),
        entry: parseFloat(trade.entry),
        exit: trade.exit ? parseFloat(trade.exit) : undefined,
      });
      await selectClient(clientId);
      await reloadClientList();
      await reloadRevenue();
      setShowAddTrade(false);
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not log trade");
    }
  }

  async function closeExistingTrade(clientId, tradeId, exit) {
    setActionError("");
    try {
      await closeTrade(tradeId, parseFloat(exit));
      await selectClient(clientId);
      await reloadClientList();
      await reloadRevenue(); // closing in profit may have just created a performance fee
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not close trade");
    }
  }

  async function handleEditDeposit(clientId, depositId, changes) {
    setActionError("");
    try {
      await editDeposit(depositId, changes);
      await selectClient(clientId);
      await reloadClientList();
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not edit deposit");
    }
  }

  async function handleDeleteDeposit(clientId, depositId) {
    setActionError("");
    try {
      await deleteDeposit(depositId);
      await selectClient(clientId);
      await reloadClientList();
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not delete deposit");
    }
  }

  async function handleEditWithdrawal(clientId, withdrawalId, changes) {
    setActionError("");
    try {
      await editWithdrawal(withdrawalId, changes);
      await selectClient(clientId);
      await reloadClientList();
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not edit withdrawal");
    }
  }

  async function handleDeleteWithdrawal(clientId, withdrawalId) {
    setActionError("");
    try {
      await deleteWithdrawal(withdrawalId);
      await selectClient(clientId);
      await reloadClientList();
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not delete withdrawal");
    }
  }

  async function handleEditTrade(clientId, tradeId, changes) {
    setActionError("");
    try {
      await editTrade(tradeId, changes);
      await selectClient(clientId);
      await reloadClientList();
      await reloadRevenue();
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not edit trade");
    }
  }

  async function handleDeleteTrade(clientId, tradeId) {
    setActionError("");
    try {
      await deleteTrade(tradeId);
      await selectClient(clientId);
      await reloadClientList();
      await reloadRevenue();
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not delete trade");
    }
  }

  async function handleBlockClient(clientId, blocked) {
    setActionError("");
    try {
      await blockClient(clientId, blocked);
      await selectClient(clientId);
      await reloadClientList();
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not update client status");
    }
  }

  async function handleDeleteClient(clientId) {
    setActionError("");
    try {
      await deleteClient(clientId);
      setSelectedId(null);
      await reloadClientList();
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not delete client");
    }
  }

  async function handleDownloadStatement(clientId, format) {
    setActionError("");
    try {
      await downloadClientStatement(clientId, format);
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not download statement");
    }
  }

  async function handleReviewDocument(documentId, approve, note) {
    setActionError("");
    try {
      await reviewVerification(documentId, approve, note);
      await reloadVerificationQueue();
      await reloadClientList(); // client summaries include verificationStatus indirectly via re-fetch if ever surfaced there
    } catch (err) {
      if (!handleAuthError(err)) setActionError(err.message || "Could not submit review");
    }
  }

  function handleLogout() {
    clearToken();
    onLoggedOut();
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

        /* Responsive fixes — this admin tool was laptop-only before: a fixed
           side-by-side sidebar+content shell, a header nav row with no wrap,
           and a couple of grids/two-column layouts with no mobile fallback.
           None of that reflowed on a phone, which is what caused text/columns
           to visually overlap. */
        .admin-header { flex-wrap: wrap; row-gap: 10px; }
        .admin-header-nav { flex-wrap: wrap; }
        .admin-shell { flex-direction: row; }
        .admin-sidebar { width: 280px; flex-shrink: 0; }
        .admin-messages-layout { flex-direction: row; }
        .admin-messages-list { width: 280px; flex-shrink: 0; }

        @media (max-width: 860px) {
          .admin-header { padding: 14px 16px; }
          .admin-header-nav { width: 100%; order: 3; justify-content: flex-start; overflow-x: auto; }
          .admin-shell { flex-direction: column; }
          .admin-sidebar { width: 100%; max-height: 280px; }
          .admin-content { padding: 20px 16px !important; }
          .admin-messages-layout { flex-direction: column; height: auto !important; }
          .admin-messages-list { width: 100%; max-height: 220px; }
        }
      `}</style>

      {/* Header */}
      <header
        className="admin-header"
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

        <nav className="admin-header-nav" style={{ display: "flex", gap: 4, background: COLORS.panel, borderRadius: 8, padding: 3 }}>
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
          <button
            onClick={() => {
              setView("verification");
              setSelectedId(null);
            }}
            style={{
              background: view === "verification" ? COLORS.panelBorder : "transparent",
              color: view === "verification" ? COLORS.bone : COLORS.boneDim,
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
            <ShieldCheck size={12} /> Verification
            {verificationQueueCount > 0 && (
              <span
                style={{
                  background: COLORS.signal,
                  color: COLORS.ink,
                  borderRadius: 10,
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "1px 6px",
                  marginLeft: 2,
                }}
              >
                {verificationQueueCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setView("messages");
              setSelectedId(null);
            }}
            style={{
              background: view === "messages" ? COLORS.panelBorder : "transparent",
              color: view === "messages" ? COLORS.bone : COLORS.boneDim,
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
            <MessageCircle size={12} /> Messages
            {unreadMessagesCount > 0 && (
              <span
                style={{
                  background: COLORS.signal,
                  color: COLORS.ink,
                  borderRadius: 10,
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "1px 6px",
                  marginLeft: 2,
                }}
              >
                {unreadMessagesCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setView("plans");
              setSelectedId(null);
            }}
            style={{
              background: view === "plans" ? COLORS.panelBorder : "transparent",
              color: view === "plans" ? COLORS.bone : COLORS.boneDim,
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
            <TrendingUp size={12} /> Plans
          </button>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <PriceTicker price={btcPrice} change={btcChange} status={priceStatus} />
          <button
            onClick={handleLogout}
            aria-label="Log out"
            style={{
              background: "transparent",
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 6,
              color: COLORS.boneDim,
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LogOut size={13} />
          </button>
        </div>
      </header>

      {actionError && (
        <div
          style={{
            background: "rgba(232,96,76,0.08)",
            borderBottom: `1px solid rgba(232,96,76,0.3)`,
            color: COLORS.loss,
            fontSize: 12.5,
            padding: "10px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{actionError}</span>
          <button onClick={() => setActionError("")} style={{ background: "transparent", border: "none", color: COLORS.loss, padding: 4 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {loadError && (
        <div style={{ background: "rgba(232,96,76,0.08)", color: COLORS.loss, fontSize: 12.5, padding: "10px 28px" }}>
          {loadError}
        </div>
      )}

      <div className="admin-shell" style={{ display: "flex", minHeight: "calc(100vh - 68px)" }}>
        {/* Client list */}
        <aside
          className="admin-sidebar"
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

          <input
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            placeholder="Search name, email, or ref code…"
            style={{
              background: COLORS.ink,
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 7,
              padding: "7px 10px",
              color: COLORS.bone,
              fontSize: 12.5,
              outline: "none",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }} className="scrollbar-thin">
            {loadingClients && (
              <div style={{ padding: "24px 12px", textAlign: "center", color: COLORS.boneDim, fontSize: 13 }}>Loading clients…</div>
            )}
            {!loadingClients && clients.length === 0 && (
              <div style={{ padding: "24px 12px", textAlign: "center", color: COLORS.boneDim, fontSize: 13, lineHeight: 1.6 }}>
                No clients yet. Add your first client to start tracking their account.
              </div>
            )}
            {!loadingClients && clients.length > 0 && filteredClients.length === 0 && (
              <div style={{ padding: "24px 12px", textAlign: "center", color: COLORS.boneDim, fontSize: 13, lineHeight: 1.6 }}>
                No clients match "{clientFilter}".
              </div>
            )}
            {filteredClients.map((c) => {
              const pnl = c._pnl ?? clientPnL(c);
              const bal = c._balance ?? clientBalance(c);
              const isSelected = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => selectClient(c.id)}
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
                      {fmtUSD(bal)}
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
        <main className="admin-content" style={{ flex: 1, padding: "24px 32px", minWidth: 0 }}>
          {view === "reconciliation" ? (
            <ReconciliationPanel totals={totals} records={reconciliations} onSubmit={addReconciliation} btcPrice={btcPrice} />
          ) : view === "verification" ? (
            <VerificationQueuePanel queue={verificationQueue} onReview={handleReviewDocument} />
          ) : view === "messages" ? (
            <MessagesPanel conversations={conversations} onSent={reloadConversations} />
          ) : view === "plans" ? (
            <PlansPanel />
          ) : !selected ? (
            <OverviewPanel clients={clients} totals={totals} revenue={revenue} onAddClient={() => setShowAddClient(true)} />
          ) : (
            <ClientPanel
              client={selected}
              onAddTrade={() => setShowAddTrade(true)}
              onAddDeposit={() => setShowAddDeposit(true)}
              onAddWithdrawal={() => setShowAddWithdrawal(true)}
              onMarkProcessed={(withdrawalId, txHash) => markWithdrawalProcessed(selected.id, withdrawalId, txHash)}
              onDownloadStatement={(format) => handleDownloadStatement(selected.id, format)}
              onCloseTrade={(tradeId, exit) => closeExistingTrade(selected.id, tradeId, exit)}
              onEditDeposit={(depositId, changes) => handleEditDeposit(selected.id, depositId, changes)}
              onDeleteDeposit={(depositId) => handleDeleteDeposit(selected.id, depositId)}
              onEditWithdrawal={(withdrawalId, changes) => handleEditWithdrawal(selected.id, withdrawalId, changes)}
              onDeleteWithdrawal={(withdrawalId) => handleDeleteWithdrawal(selected.id, withdrawalId)}
              onEditTrade={(tradeId, changes) => handleEditTrade(selected.id, tradeId, changes)}
              onDeleteTrade={(tradeId) => handleDeleteTrade(selected.id, tradeId)}
              onBlockClient={(blocked) => handleBlockClient(selected.id, blocked)}
              onDeleteClient={() => handleDeleteClient(selected.id)}
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
      {newlyCreatedClient && (
        <TempPasswordModal client={newlyCreatedClient} onClose={() => setNewlyCreatedClient(null)} />
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

function OverviewPanel({ clients, totals, revenue, onAddClient }) {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: -0.3 }}>Overview</h1>
        <p style={{ color: COLORS.boneDim, fontSize: 13.5, marginTop: 4 }}>Across all client accounts</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total deposited" value={fmtUSD(totals.deposited)} />
        <StatCard
          label="Total P&L"
          value={`${totals.pnl >= 0 ? "+" : ""}${fmtUSD(totals.pnl)}`}
          color={totals.pnl >= 0 ? COLORS.gain : COLORS.loss}
        />
        <StatCard label="Active clients" value={totals.clientCount} />
      </div>

      {revenue && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 32 }}>
          <StatCard label="Subscription revenue" value={fmtUSD(revenue.subscriptionRevenue)} color={COLORS.signal} />
          <StatCard label="Performance fee revenue" value={fmtUSD(revenue.performanceFeeRevenue)} color={COLORS.signal} />
          <StatCard label="Total revenue" value={fmtUSD(revenue.totalRevenue)} color={COLORS.signal} />
        </div>
      )}

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

function VerificationQueuePanel({ queue, onReview }) {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: -0.3, display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={19} /> Verification queue
        </h1>
        <p style={{ color: COLORS.boneDim, fontSize: 13.5, marginTop: 4, maxWidth: 560, lineHeight: 1.6 }}>
          Client-submitted ID documents awaiting manual review. This isn't automated — approving or rejecting is
          your judgment call. Verification status doesn't currently block deposits, subscriptions, or withdrawals.
        </p>
      </div>

      {queue.length === 0 ? (
        <div style={{ color: COLORS.boneDim, fontSize: 13.5, padding: "24px 0" }}>Nothing pending review.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {queue.map((doc) => (
            <VerificationQueueRow key={doc.id} doc={doc} onReview={onReview} />
          ))}
        </div>
      )}
    </div>
  );
}

function VerificationQueueRow({ doc, onReview }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showRejectNote, setShowRejectNote] = useState(false);

  async function loadPreview() {
    if (previewUrl) return;
    try {
      const url = await viewVerificationDocument(doc.id);
      setPreviewUrl(url);
    } catch (err) {
      setPreviewError(err.message || "Could not load document");
    }
  }

  async function handleDecision(approve) {
    setSubmitting(true);
    try {
      await onReview(doc.id, approve, approve ? undefined : note.trim() || undefined);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.panelBorder}`,
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{doc.client.name}</div>
          <div style={{ fontSize: 12, color: COLORS.boneDim, marginTop: 2 }}>{doc.client.email}</div>
          <div style={{ fontSize: 11.5, color: COLORS.boneDim, marginTop: 6 }} className="mono">
            {doc.country} · {doc.documentType.replace(/_/g, " ")} · submitted {new Date(doc.submittedAt).toLocaleDateString()}
          </div>
        </div>
        <button onClick={loadPreview} style={{ ...secondaryBtnStyle, padding: "7px 12px" }}>
          {previewUrl ? "Loaded" : "View document"}
        </button>
      </div>

      {previewError && <div style={{ color: COLORS.loss, fontSize: 12, marginTop: 10 }}>{previewError}</div>}

      {previewUrl && (
        <div style={{ marginTop: 12 }}>
          {doc.mimeType === "application/pdf" ? (
            <iframe src={previewUrl} title={doc.fileName} style={{ width: "100%", height: 400, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 8 }} />
          ) : (
            <img
              src={previewUrl}
              alt={doc.fileName}
              style={{ maxWidth: "100%", maxHeight: 400, borderRadius: 8, border: `1px solid ${COLORS.panelBorder}` }}
            />
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => handleDecision(true)}
          disabled={submitting}
          style={{ ...primaryBtnStyle, opacity: submitting ? 0.6 : 1 }}
        >
          <Check size={14} /> Approve
        </button>
        {!showRejectNote ? (
          <button
            onClick={() => setShowRejectNote(true)}
            disabled={submitting}
            style={{ ...secondaryBtnStyle, opacity: submitting ? 0.6 : 1 }}
          >
            Reject
          </button>
        ) : (
          <>
            <input
              placeholder="Reason (shown to client)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ ...inputStyle, width: 220, marginBottom: 0, padding: "7px 10px", fontSize: 12.5 }}
            />
            <button
              onClick={() => handleDecision(false)}
              disabled={submitting}
              style={{ ...secondaryBtnStyle, color: COLORS.loss, borderColor: "rgba(232,96,76,0.4)", opacity: submitting ? 0.6 : 1 }}
            >
              Confirm reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Staff inbox: a conversation list on the left (most recently active first,
// with an unread badge per client) and the selected client's full thread on
// the right, with a reply box. Polls the selected thread every 8s while
// open, mirroring the client-side ChatPanel's polling approach.
function MessagesPanel({ conversations, onSent }) {
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [thread, setThread] = useState(null);
  const [threadError, setThreadError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = React.useRef(null);

  const selectedConversation = conversations.find((c) => c.clientId === selectedClientId) || null;

  async function loadThread(clientId) {
    try {
      const data = await getConversationThread(clientId);
      setThread(data);
      setThreadError("");
    } catch (err) {
      setThreadError(err.message || "Could not load conversation");
    }
  }

  useEffect(() => {
    if (!selectedClientId) return;
    loadThread(selectedClientId);
    const interval = setInterval(() => loadThread(selectedClientId), 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  async function handleSend(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !selectedClientId) return;
    setSending(true);
    try {
      await sendStaffMessage(selectedClientId, body);
      setDraft("");
      await loadThread(selectedClientId);
      onSent();
    } catch (err) {
      setThreadError(err.message || "Could not send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Messages</div>
      <div style={{ fontSize: 13, color: COLORS.boneDim, marginBottom: 20 }}>
        Client support conversations — replies appear in their dashboard within a few seconds.
      </div>

      {conversations.length === 0 ? (
        <div
          style={{
            border: `1px dashed ${COLORS.panelBorder}`,
            borderRadius: 12,
            padding: "48px 24px",
            textAlign: "center",
            color: COLORS.boneDim,
          }}
        >
          <MessageCircle size={22} color={COLORS.boneDim} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14.5 }}>No client messages yet.</div>
        </div>
      ) : (
        <div className="admin-messages-layout" style={{ display: "flex", gap: 16, height: 560 }}>
          <div
            className="admin-messages-list"
            style={{
              width: 280,
              flexShrink: 0,
              background: COLORS.panel,
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 12,
              overflowY: "auto",
            }}
          >
            {conversations.map((c) => {
              const isActive = c.clientId === selectedClientId;
              return (
                <button
                  key={c.clientId}
                  onClick={() => setSelectedClientId(c.clientId)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: isActive ? COLORS.panelBorder : "transparent",
                    border: "none",
                    borderBottom: `1px solid ${COLORS.panelBorder}`,
                    padding: "14px 16px",
                    color: COLORS.bone,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{c.clientName}</span>
                    {c.unreadCount > 0 && (
                      <span
                        style={{
                          background: COLORS.signal,
                          color: COLORS.ink,
                          borderRadius: 10,
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: "1px 6px",
                        }}
                      >
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                  {c.lastMessage && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: COLORS.boneDim,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.lastMessage.senderType === "STAFF" ? "You: " : ""}
                      {c.lastMessage.body}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              background: COLORS.panel,
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {!selectedConversation ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.boneDim, fontSize: 13.5 }}>
                Select a conversation on the left.
              </div>
            ) : (
              <>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${COLORS.panelBorder}` }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{selectedConversation.clientName}</div>
                  <div style={{ fontSize: 11.5, color: COLORS.boneDim }}>{selectedConversation.clientEmail}</div>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {!thread ? (
                    <div style={{ color: COLORS.boneDim, fontSize: 13 }}>Loading…</div>
                  ) : (
                    thread.messages.map((m) => {
                      const fromStaff = m.senderType === "STAFF";
                      return (
                        <div key={m.id} style={{ display: "flex", justifyContent: fromStaff ? "flex-end" : "flex-start" }}>
                          <div
                            style={{
                              maxWidth: "70%",
                              background: fromStaff ? COLORS.signal : COLORS.ink,
                              color: fromStaff ? COLORS.ink : COLORS.bone,
                              borderRadius: fromStaff ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                              padding: "9px 13px",
                              fontSize: 13.5,
                              lineHeight: 1.5,
                            }}
                          >
                            <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</div>
                            <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                <form onSubmit={handleSend} style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${COLORS.panelBorder}` }}>
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Reply…"
                    maxLength={4000}
                    style={{
                      flex: 1,
                      background: COLORS.ink,
                      border: `1px solid ${COLORS.panelBorder}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                      fontSize: 13.5,
                      color: COLORS.bone,
                    }}
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    style={{
                      background: COLORS.signal,
                      color: COLORS.ink,
                      border: "none",
                      borderRadius: 8,
                      width: 42,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: sending || !draft.trim() ? 0.6 : 1,
                      flexShrink: 0,
                    }}
                  >
                    <Send size={16} />
                  </button>
                </form>
                {threadError && <div style={{ color: COLORS.loss, fontSize: 12, padding: "0 16px 12px" }}>{threadError}</div>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Lets Owner set/edit the "typical return" text shown on each subscription
// tier's card in the client dashboard. Deliberately a plain free-text field
// per tier, not a number Claude computes — see schema.prisma
// TierReturnEstimate for why. The client-facing display always pairs
// whatever's set here with a "past performance, not a guarantee" disclaimer.
function PlansPanel() {
  const [tiers, setTiers] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState("");
  const [savedKey, setSavedKey] = useState(null);

  useEffect(() => {
    let mounted = true;
    getTierReturnEstimates()
      .then((data) => {
        if (!mounted) return;
        setTiers(data.tiers);
        setDrafts(Object.fromEntries(data.tiers.map((t) => [t.key, t.returnEstimate || ""])));
      })
      .catch((err) => setError(err.message || "Could not load plans"));
    return () => {
      mounted = false;
    };
  }, []);

  async function save(tierKey) {
    setSavingKey(tierKey);
    setError("");
    setSavedKey(null);
    try {
      await setTierReturnEstimate(tierKey, drafts[tierKey].trim() || null);
      setSavedKey(tierKey);
      setTimeout(() => setSavedKey(null), 2000);
    } catch (err) {
      setError(err.message || "Could not save");
    } finally {
      setSavingKey(null);
    }
  }

  if (!tiers) return <div style={{ color: COLORS.boneDim, fontSize: 13.5 }}>Loading…</div>;

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Plans</div>
      <div style={{ fontSize: 13, color: COLORS.boneDim, marginBottom: 6, maxWidth: 560 }}>
        Set the "typical return" text shown on each plan's card in the client dashboard. Leave a field blank to
        show nothing for that tier. This is always paired with a "past performance, not a guarantee" disclaimer —
        keep it honest and based on real results, since it's a real claim clients will see.
      </div>
      {error && <div style={{ color: COLORS.loss, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560, marginTop: 16 }}>
        {tiers.map((tier) => (
          <div
            key={tier.key}
            style={{
              background: COLORS.panel,
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{tier.name}</div>
              <div className="mono" style={{ fontSize: 11.5, color: COLORS.boneDim }}>
                ${tier.minUsd.toLocaleString()}–${tier.maxUsd.toLocaleString()} · {tier.tierMonths}mo
              </div>
            </div>
            <input
              type="text"
              value={drafts[tier.key] ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [tier.key]: e.target.value }))}
              placeholder="e.g. Historically 5–12% over the lock-up period"
              maxLength={300}
              style={{
                width: "100%",
                background: COLORS.ink,
                border: `1px solid ${COLORS.panelBorder}`,
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 13,
                color: COLORS.bone,
                marginBottom: 10,
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => save(tier.key)}
                disabled={savingKey === tier.key}
                style={{ ...primaryBtnStyle, opacity: savingKey === tier.key ? 0.6 : 1 }}
              >
                {savingKey === tier.key ? "Saving…" : "Save"}
              </button>
              {savedKey === tier.key && <span style={{ fontSize: 12, color: COLORS.gain }}>Saved</span>}
            </div>
          </div>
        ))}
      </div>
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 24 }}>
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
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
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

function ClientPanel({
  client,
  onAddTrade,
  onAddDeposit,
  onAddWithdrawal,
  onMarkProcessed,
  onDownloadStatement,
  onCloseTrade,
  onEditDeposit,
  onDeleteDeposit,
  onEditWithdrawal,
  onDeleteWithdrawal,
  onEditTrade,
  onDeleteTrade,
  onBlockClient,
  onDeleteClient,
  btcPrice,
}) {
  const deposited = totalDeposited(client);
  const pnl = clientPnL(client);
  const withdrawn = totalProcessedWithdrawn(client);
  const pending = totalPendingWithdrawal(client);
  const balance = clientBalance(client);
  const [downloading, setDownloading] = useState(false);

  const openTrades = useMemo(() => client.trades.filter((t) => t.status === "open"), [client]);

  async function handleDownload(format) {
    setDownloading(true);
    try {
      await onDownloadStatement(format);
    } finally {
      setDownloading(false);
    }
  }

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: -0.3 }}>{client.name}</h1>
            {client.blocked && (
              <span
                style={{
                  fontSize: 11,
                  color: COLORS.loss,
                  background: "rgba(232,96,76,0.1)",
                  border: `1px solid rgba(232,96,76,0.3)`,
                  borderRadius: 5,
                  padding: "3px 8px",
                  fontWeight: 600,
                }}
              >
                Blocked
              </span>
            )}
          </div>
          <p style={{ color: COLORS.boneDim, fontSize: 13, marginTop: 4 }}>
            {client.contact} {client.walletRef ? `· ${client.walletRef}` : ""}
          </p>
          <p style={{ color: COLORS.boneDim, fontSize: 12, marginTop: 2 }} className="mono">
            Ref: {client.depositReference || "—"}
          </p>
          <div style={{ marginTop: 6 }}>
            {client.activeSubscription ? (
              <span
                style={{
                  fontSize: 11,
                  color: COLORS.gain,
                  background: "rgba(61,220,151,0.1)",
                  border: `1px solid rgba(61,220,151,0.3)`,
                  borderRadius: 5,
                  padding: "3px 8px",
                }}
              >
                Subscribed · ${Number(client.activeSubscription.priceUsd).toLocaleString()} · {client.activeSubscription.tierMonths}mo · ends{" "}
                {new Date(client.activeSubscription.endDate).toLocaleDateString()}
              </span>
            ) : (
              <span
                style={{
                  fontSize: 11,
                  color: COLORS.boneDim,
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${COLORS.panelBorder}`,
                  borderRadius: 5,
                  padding: "3px 8px",
                }}
              >
                No active subscription
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => handleDownload("pdf")} disabled={downloading} style={{ ...secondaryBtnStyle, opacity: downloading ? 0.6 : 1 }}>
            <Download size={14} /> PDF
          </button>
          <button onClick={() => handleDownload("csv")} disabled={downloading} style={{ ...secondaryBtnStyle, opacity: downloading ? 0.6 : 1 }}>
            <Download size={14} /> CSV
          </button>
          <button onClick={onAddDeposit} style={secondaryBtnStyle}>
            <ArrowDown size={14} /> Deposit
          </button>
          <button onClick={onAddWithdrawal} style={secondaryBtnStyle}>
            <ArrowUp size={14} /> Withdraw
          </button>
          <button onClick={onAddTrade} style={primaryBtnStyle}>
            <Plus size={14} /> Log trade
          </button>
          <button
            onClick={() => {
              if (window.confirm(client.blocked ? `Unblock ${client.name}? They'll be able to log in again.` : `Block ${client.name}? They won't be able to log in until unblocked.`)) {
                onBlockClient(!client.blocked);
              }
            }}
            style={{ ...secondaryBtnStyle, color: client.blocked ? COLORS.gain : COLORS.signal, borderColor: client.blocked ? "rgba(61,220,151,0.4)" : "rgba(242,184,75,0.4)" }}
          >
            <ShieldAlert size={14} /> {client.blocked ? "Unblock" : "Block"}
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Permanently delete ${client.name}? This only works if they have no financial history.`)) {
                onDeleteClient();
              }
            }}
            style={{ ...secondaryBtnStyle, color: COLORS.loss, borderColor: "rgba(232,96,76,0.4)" }}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 14 }}>
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

      {openTrades.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
            Open positions
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {openTrades.map((t) => (
              <OpenTradeRow key={t.id} trade={t} onClose={(exit) => onCloseTrade(t.id, exit)} />
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
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: COLORS.panel }}>
                  {["Type", "Detail", "Amount", "Tx hash", "Date", "Actions"].map((h) => (
                    <th key={h} style={theadCellStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <HistoryRow
                    key={`${item.type}-${item.id}`}
                    item={item}
                    onEditDeposit={onEditDeposit}
                    onDeleteDeposit={onDeleteDeposit}
                    onEditWithdrawal={onEditWithdrawal}
                    onDeleteWithdrawal={onDeleteWithdrawal}
                    onEditTrade={onEditTrade}
                    onDeleteTrade={onDeleteTrade}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryRow({ item, onEditDeposit, onDeleteDeposit, onEditWithdrawal, onDeleteWithdrawal, onEditTrade, onDeleteTrade }) {
  const [editing, setEditing] = useState(false);
  const [draftAmount, setDraftAmount] = useState(item.amount);
  const [draftExtra, setDraftExtra] = useState(item.type === "withdrawal" ? item.destination || "" : "");
  const [saving, setSaving] = useState(false);

  if (item.type === "deposit") {
    if (editing) {
      return (
        <tr style={{ borderBottom: `1px solid ${COLORS.panelBorder}`, background: COLORS.panel }}>
          <td style={cellStyle} colSpan={6}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: COLORS.boneDim }}>Amount</span>
              <input
                type="number"
                value={draftAmount}
                onChange={(e) => setDraftAmount(e.target.value)}
                style={{ ...inlineInputStyle, width: 110 }}
              />
              <button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  await onEditDeposit(item.id, { amountUsd: parseFloat(draftAmount) });
                  setSaving(false);
                  setEditing(false);
                }}
                style={{ ...primaryBtnStyle, padding: "6px 12px", fontSize: 12 }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditing(false)} style={{ ...secondaryBtnStyle, padding: "6px 12px", fontSize: 12 }}>
                Cancel
              </button>
            </div>
          </td>
        </tr>
      );
    }
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
        <td style={cellStyle}>
          <RowActions
            onEdit={() => setEditing(true)}
            onDelete={() => {
              if (window.confirm("Delete this deposit? This lowers the client's balance.")) onDeleteDeposit(item.id);
            }}
          />
        </td>
      </tr>
    );
  }
  if (item.type === "withdrawal") {
    const isSubscriptionFee = item.destination === "SUBSCRIPTION_FEE" || item.destination === "PERFORMANCE_FEE";
    if (editing) {
      return (
        <tr style={{ borderBottom: `1px solid ${COLORS.panelBorder}`, background: COLORS.panel }}>
          <td style={cellStyle} colSpan={6}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: COLORS.boneDim }}>Amount</span>
              <input
                type="number"
                value={draftAmount}
                onChange={(e) => setDraftAmount(e.target.value)}
                style={{ ...inlineInputStyle, width: 110 }}
              />
              <span style={{ fontSize: 12, color: COLORS.boneDim }}>Destination</span>
              <input
                type="text"
                value={draftExtra}
                onChange={(e) => setDraftExtra(e.target.value)}
                style={{ ...inlineInputStyle, width: 160 }}
              />
              <button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  await onEditWithdrawal(item.id, { amountUsd: parseFloat(draftAmount), destination: draftExtra });
                  setSaving(false);
                  setEditing(false);
                }}
                style={{ ...primaryBtnStyle, padding: "6px 12px", fontSize: 12 }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditing(false)} style={{ ...secondaryBtnStyle, padding: "6px 12px", fontSize: 12 }}>
                Cancel
              </button>
            </div>
          </td>
        </tr>
      );
    }
    return (
      <tr style={{ borderBottom: `1px solid ${COLORS.panelBorder}` }}>
        <td style={cellStyle}>
          <TypeBadge label={isSubscriptionFee ? "Subscription" : "Withdrawal"} color={COLORS.loss} />
        </td>
        <td style={{ ...cellStyle, color: COLORS.boneDim }}>
          {isSubscriptionFee
            ? "Trading subscription renewal"
            : `${item.status === "processed" ? "Sent" : "Pending"} ${item.destination ? `→ ${truncateHash(item.destination)}` : ""}`}
        </td>
        <td style={{ ...cellStyle, color: COLORS.loss }} className="mono">
          −{fmtUSD(item.amount)}
        </td>
        <td style={{ ...cellStyle, color: COLORS.boneDim, fontSize: 11.5 }} className="mono">
          {truncateHash(item.txHash)}
        </td>
        <td style={{ ...cellStyle, color: COLORS.boneDim, fontSize: 12 }}>{new Date(item.date).toLocaleDateString()}</td>
        <td style={cellStyle}>
          {isSubscriptionFee ? (
            <span style={{ fontSize: 11, color: COLORS.boneDim }}>Edit the trade/plan</span>
          ) : (
            <RowActions
              onEdit={() => setEditing(true)}
              onDelete={() => {
                if (window.confirm("Delete this withdrawal record?")) onDeleteWithdrawal(item.id);
              }}
            />
          )}
        </td>
      </tr>
    );
  }
  // trade
  const p = tradePnL(item);
  if (editing) {
    return (
      <tr style={{ borderBottom: `1px solid ${COLORS.panelBorder}`, background: COLORS.panel }}>
        <td style={cellStyle} colSpan={6}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: COLORS.boneDim }}>Exit price</span>
            <input
              type="number"
              value={draftAmount}
              onChange={(e) => setDraftAmount(e.target.value)}
              placeholder="Exit price"
              style={{ ...inlineInputStyle, width: 110 }}
            />
            <button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onEditTrade(item.id, { exit: parseFloat(draftAmount) });
                setSaving(false);
                setEditing(false);
              }}
              style={{ ...primaryBtnStyle, padding: "6px 12px", fontSize: 12 }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} style={{ ...secondaryBtnStyle, padding: "6px 12px", fontSize: 12 }}>
              Cancel
            </button>
          </div>
        </td>
      </tr>
    );
  }
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
      <td style={cellStyle}>
        <RowActions
          onEdit={() => setEditing(true)}
          onDelete={() => {
            if (window.confirm("Delete this trade? Any linked performance fee is removed too.")) onDeleteTrade(item.id);
          }}
        />
      </td>
    </tr>
  );
}

const inlineInputStyle = {
  background: COLORS.ink,
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 6,
  padding: "6px 8px",
  fontSize: 12.5,
  color: COLORS.bone,
};

function RowActions({ onEdit, onDelete }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button onClick={onEdit} aria-label="Edit" style={rowIconBtnStyle}>
        <Pencil size={13} />
      </button>
      <button onClick={onDelete} aria-label="Delete" style={{ ...rowIconBtnStyle, color: COLORS.loss }}>
        <Trash2 size={13} />
      </button>
    </div>
  );
}

const rowIconBtnStyle = {
  background: "transparent",
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 6,
  width: 26,
  height: 26,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: COLORS.boneDim,
  cursor: "pointer",
};

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

function OpenTradeRow({ trade, onClose }) {
  const [exit, setExit] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [closing, setClosing] = useState(false);

  async function handleClose() {
    if (!exit.trim() || isNaN(parseFloat(exit))) return;
    setClosing(true);
    try {
      await onClose(exit.trim());
    } finally {
      setClosing(false);
      setShowInput(false);
      setExit("");
    }
  }

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
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 220 }}>
        <Activity size={14} color={COLORS.signal} />
        <div>
          <div className="mono" style={{ fontSize: 13.5, fontWeight: 500 }}>
            {trade.side.toUpperCase()} {trade.size} {trade.asset} @ {trade.entry}
          </div>
          <div style={{ fontSize: 11.5, color: COLORS.boneDim }}>
            Opened {new Date(trade.date).toLocaleDateString()} · still open
          </div>
        </div>
      </div>

      {!showInput ? (
        <button onClick={() => setShowInput(true)} style={{ ...secondaryBtnStyle, padding: "6px 12px" }}>
          Close position
        </button>
      ) : (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            placeholder="Exit price"
            value={exit}
            onChange={(e) => setExit(e.target.value)}
            style={{ ...inputStyle, width: 120, marginBottom: 0, padding: "6px 10px", fontSize: 12.5 }}
          />
          <button
            onClick={handleClose}
            style={{ ...primaryBtnStyle, padding: "7px 12px", opacity: closing ? 0.6 : 1 }}
            disabled={closing || !exit.trim()}
          >
            {closing ? "Closing…" : "Confirm"}
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

function TempPasswordModal({ client, onClose }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(client.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — user can still select and copy manually
    }
  }
  return (
    <ModalShell title="Client account created" onClose={onClose}>
      <div style={{ fontSize: 13, color: COLORS.boneDim, marginBottom: 14, lineHeight: 1.6 }}>
        Relay this temporary password to <strong style={{ color: COLORS.bone }}>{client.name}</strong> ({client.email}) through
        a secure channel — not plaintext email or SMS. It's shown only once and won't be retrievable after you close this.
        They'll be required to set their own password on first login.
      </div>
      <div
        style={{
          background: COLORS.ink,
          border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 8,
          padding: "12px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <span className="mono" style={{ fontSize: 15, letterSpacing: 0.5 }}>
          {client.tempPassword}
        </span>
        <button onClick={copy} style={{ ...secondaryBtnStyle, padding: "6px 10px", fontSize: 12 }}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <button onClick={onClose} style={{ ...primaryBtnStyle, width: "100%", justifyContent: "center" }}>
        Done
      </button>
    </ModalShell>
  );
}

function AddClientModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ name: "", email: "", contact: "", walletRef: "" });
  const valid = form.name.trim() && form.email.trim();
  return (
    <ModalShell title="Add client" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onSubmit(form);
        }}
      >
        <label style={labelStyle}>Full name</label>
        <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

        <label style={labelStyle}>Email (used for client login)</label>
        <input
          style={inputStyle}
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="client@example.com"
          required
        />

        <label style={labelStyle}>Contact (phone, alternate email, etc — optional)</label>
        <input style={inputStyle} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />

        <label style={labelStyle}>Wallet / account reference</label>
        <input style={inputStyle} value={form.walletRef} onChange={(e) => setForm({ ...form, walletRef: e.target.value })} />

        <div style={{ fontSize: 11.5, color: COLORS.boneDim, marginTop: -8, marginBottom: 14, lineHeight: 1.6 }}>
          A temporary password will be generated for this client — you'll see it once after creation to relay
          securely. Log any initial deposit separately afterward, with its on-chain transaction hash as proof.
        </div>

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
          disabled={!valid}
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
