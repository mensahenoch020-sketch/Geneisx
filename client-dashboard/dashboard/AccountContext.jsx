import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchMe, downloadStatement, subscribe, ApiError } from "../api.js";

// One shared fetch of /api/me for the whole dashboard shell, instead of each
// sidebar page (Portfolio, Wallet, Transactions, Trade...) independently
// re-fetching and re-normalizing the same account. Pages read this via
// useAccount() and get the same client/derived-numbers helpers that used to
// live only inside client-dashboard.jsx.

const AccountCtx = createContext(null);

export function useAccount() {
  const ctx = useContext(AccountCtx);
  if (!ctx) throw new Error("useAccount must be used inside <AccountProvider>");
  return ctx;
}

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

export function tradePnL(t) {
  const diff = t.side === "long" ? t.exit - t.entry : t.entry - t.exit;
  return diff * t.size;
}
export function totalDeposited(client) {
  return client.deposits.reduce((s, d) => s + d.amount, 0);
}
export function totalWithdrawn(client) {
  return client.withdrawals.filter((w) => w.status === "processed").reduce((s, w) => s + w.amount, 0);
}
export function totalPnL(client) {
  return client.trades.reduce((s, t) => s + tradePnL(t), 0);
}
export function balance(client) {
  return totalDeposited(client) - totalWithdrawn(client) + totalPnL(client);
}
export function pnlSince(client, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return client.trades.filter((t) => new Date(t.date).getTime() >= cutoff).reduce((s, t) => s + tradePnL(t), 0);
}

export function useLivePrice(symbol = "bitcoin") {
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

export function AccountProvider({ onLoggedOut, children }) {
  const [client, setClient] = useState(null);
  const [loadError, setLoadError] = useState("");

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
    return downloadStatement(format);
  }

  async function handleSubscribe(tierMonths) {
    try {
      await subscribe(tierMonths);
      await reload();
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        onLoggedOut();
        return { ok: false };
      }
      throw err;
    }
  }

  const value = useMemo(
    () => ({ client, loadError, reload, handleDownload, handleSubscribe }),
    [client, loadError]
  );

  return <AccountCtx.Provider value={value}>{children}</AccountCtx.Provider>;
}
