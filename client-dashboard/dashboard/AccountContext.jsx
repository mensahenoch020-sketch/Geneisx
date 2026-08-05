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
          amountUsd: Number(apiClient.activeSubscription.priceUsd),
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

// Real per-coin logos + real 7-day sparkline price arrays, straight from
// CoinGecko's /coins/markets endpoint — used anywhere we show a coin's icon
// or a mini price chart, so nothing on those cards is fabricated.
//
// CoinGecko's free public API is rate-limited, and previously every page
// that called useMarketData ran its own independent fetch + 45s timer —
// stacking several pollers at once (Dashboard + Watchlist + Market Trends)
// was enough to trip the rate limit and show "couldn't load" even though
// the network was fine. This now shares one in-memory cache per coin-list
// across the whole app: only one fetch is in flight for a given list of
// ids at a time, all callers subscribe to the same result, and the last
// successful prices stay on screen (marked "delayed") instead of being
// replaced by an error the moment one poll fails.
const marketCache = new Map(); // idsKey -> { coins, subscribers:Set, timer }
const MARKET_POLL_MS = 60000;
const DEFAULT_WATCHLIST = ["bitcoin", "ethereum", "solana", "tether", "litecoin", "ripple"];

function getMarketEntry(idsKey) {
  let entry = marketCache.get(idsKey);
  if (!entry) {
    entry = { coins: null, subscribers: new Set(), timer: null, inFlight: false };
    marketCache.set(idsKey, entry);
  }
  return entry;
}

async function pollMarket(idsKey, ids) {
  const entry = getMarketEntry(idsKey);
  if (entry.inFlight) return;
  entry.inFlight = true;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${idsKey}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`
    );
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    entry.coins = data;
    entry.lastFetchedAt = Date.now();
    entry.subscribers.forEach((cb) => cb({ coins: data, status: "live" }));
  } catch (e) {
    // Keep whatever we last had — subscribers get "stale" (if we have old
    // data to show) or "error" (if we've never had a successful fetch).
    entry.subscribers.forEach((cb) => cb({ coins: entry.coins, status: entry.coins ? "stale" : "error" }));
  } finally {
    entry.inFlight = false;
  }
}

export function useMarketData(ids = DEFAULT_WATCHLIST) {
  const idsKey = ids.join(",");
  const [state, setState] = useState(() => {
    const entry = getMarketEntry(idsKey);
    return { coins: entry.coins, status: entry.coins ? "stale" : "loading" };
  });

  useEffect(() => {
    const entry = getMarketEntry(idsKey);
    const onUpdate = (next) => setState(next);
    entry.subscribers.add(onUpdate);

    // First subscriber for this coin list kicks off polling; later
    // subscribers just ride the existing timer instead of starting a
    // second one.
    if (!entry.timer) {
      pollMarket(idsKey, ids);
      entry.timer = setInterval(() => pollMarket(idsKey, ids), MARKET_POLL_MS);
    } else if (entry.coins) {
      setState({ coins: entry.coins, status: "stale" });
    }

    return () => {
      entry.subscribers.delete(onUpdate);
      if (entry.subscribers.size === 0 && entry.timer) {
        clearInterval(entry.timer);
        entry.timer = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return state;
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

  async function handleSubscribe(tierKey, amountUsd) {
    try {
      await subscribe(tierKey, amountUsd);
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
