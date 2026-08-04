import React, { useEffect, useRef, useState } from "react";

// React port of what used to be landing-page/index.html. Content and visual
// design are unchanged from that file — only the mechanism changed (React
// components + hooks instead of vanilla JS + querySelector), so this now
// lives in the same app as the dashboard instead of a separate static site.

function useRevealOnScroll() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) el.classList.add("in");
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Reveal({ as: Tag = "div", className = "", children, ...props }) {
  const ref = useRevealOnScroll();
  return (
    <Tag ref={ref} className={`reveal ${className}`} {...props}>
      {children}
    </Tag>
  );
}

const COINS = [
  { id: "bitcoin", symbol: "BTC" },
  { id: "ethereum", symbol: "ETH" },
  { id: "solana", symbol: "SOL" },
];

function fmtPrice(n) {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: n < 10 ? 4 : 2 });
}

function MarketPulse() {
  const [prices, setPrices] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const ids = COINS.map((c) => c.id).join(",");
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
        );
        if (!res.ok) throw new Error("bad response");
        const data = await res.json();
        if (mounted) {
          setPrices(data);
          setFailed(false);
        }
      } catch {
        if (mounted) setFailed(true);
      }
    }
    load();
    const interval = setInterval(load, 60000); // 60s — comfortably under CoinGecko's free rate limit
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="market-grid">
      {COINS.map((c) => {
        const d = prices?.[c.id];
        if (!d || failed) {
          return (
            <div className="market-card" key={c.id}>
              <div className="market-loading">
                {failed ? `${c.symbol} price unavailable right now` : `Loading ${c.symbol}…`}
              </div>
            </div>
          );
        }
        const change = d.usd_24h_change ?? 0;
        const dir = change >= 0 ? "up" : "down";
        const arrow = change >= 0 ? "▲" : "▼";
        return (
          <div className="market-card" key={c.id}>
            <div className="sym">{c.symbol}</div>
            <div className="px">{fmtPrice(d.usd)}</div>
            <div className={`chg ${dir}`}>
              {arrow} {Math.abs(change).toFixed(2)}% (24h)
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MarketingSite({ onNavigate, section }) {
  useEffect(() => {
    if (section) {
      const el = document.getElementById(section);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, [section]);

  return (
    <>
      <section className="hero">
        <div className="hero-grid"></div>
        <div className="wrap">
          <div className="eyebrow">
            <span className="pulse-dot"></span> Actively managed Bitcoin accounts
          </div>
          <h1>
            Bitcoin management,
            <br />
            run like it should
            <br />
            be <span className="accent">accountable.</span>
          </h1>
          <p className="hero-sub">
            GenesisX offers actively managed Bitcoin accounts, with every deposit, trade, and withdrawal recorded
            against an on-chain paper trail — not just a number on a screen.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => onNavigate("signup")}>
              Get started →
            </button>
            <a className="btn-secondary" href="#how">
              See how it works
            </a>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="num">10%</div>
              <div className="label">Performance fee only</div>
            </div>
            <div className="hero-stat">
              <div className="num">100%</div>
              <div className="label">Segregated per client</div>
            </div>
            <div className="hero-stat">
              <div className="num">24/7</div>
              <div className="label">Reach a real person</div>
            </div>
          </div>
        </div>
      </section>

      <div className="ticker-strip">
        <div className="ticker-track">
          {[0, 1].map((i) => (
            <React.Fragment key={i}>
              <span className="ticker-item">
                <span className="dot"></span>On-chain proof for every deposit &amp; withdrawal
              </span>
              <span className="ticker-item">
                <span className="dot"></span>Per-client, segregated accounts
              </span>
              <span className="ticker-item">
                <span className="dot"></span>No pooled funds
              </span>
              <span className="ticker-item">
                <span className="dot"></span>Fee only on real, realized profit
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <section id="how">
        <div className="wrap">
          <Reveal className="section-eyebrow">Process</Reveal>
          <Reveal as="h2" className="section-title">
            How an account actually works
          </Reveal>
          <Reveal as="p" className="section-sub">
            No pooled fund, no shared balance. Your account is yours, tracked independently from every other
            client's.
          </Reveal>
          <div className="steps">
            <Reveal className="step-card">
              <div className="step-num">01</div>
              <div className="step-title">You deposit BTC</div>
              <div className="step-desc">
                Funds are sent to a wallet under GenesisX's custody. Every deposit is logged against its on-chain
                transaction hash — never just a typed-in number.
              </div>
            </Reveal>
            <Reveal className="step-card">
              <div className="step-num">02</div>
              <div className="step-title">Your account is managed</div>
              <div className="step-desc">
                Trades are logged against your account specifically. Your balance reflects only your deposits and
                your trade history — not a pool shared with other clients.
              </div>
            </Reveal>
            <Reveal className="step-card">
              <div className="step-num">03</div>
              <div className="step-title">You withdraw on request</div>
              <div className="step-desc">
                Withdrawal requests are logged as pending, then confirmed with an outgoing transaction hash once
                funds are actually sent — a two-step record, not a one-click promise.
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="markets">
        <div className="wrap">
          <Reveal className="section-eyebrow">Market pulse</Reveal>
          <Reveal as="h2" className="section-title">
            Live from the market
          </Reveal>
          <Reveal as="p" className="section-sub">
            A snapshot of where things stand right now — this is public market data, not your account.
          </Reveal>

          <Reveal>
            <MarketPulse />
          </Reveal>

          <Reveal as="h3" style={{ fontSize: 18, marginTop: 56, marginBottom: 4 }}>
            Crypto headlines
          </Reveal>
          <Reveal as="p" className="section-sub" style={{ marginBottom: 0 }}>
            A few places worth keeping an eye on.
          </Reveal>
          <Reveal className="news-list">
            <a className="news-item" href="https://www.coindesk.com" target="_blank" rel="noopener noreferrer">
              <div>
                <div className="news-title">CoinDesk — daily crypto markets &amp; policy coverage</div>
                <div className="news-source">coindesk.com</div>
              </div>
            </a>
            <a className="news-item" href="https://www.theblock.co" target="_blank" rel="noopener noreferrer">
              <div>
                <div className="news-title">The Block — research &amp; breaking crypto news</div>
                <div className="news-source">theblock.co</div>
              </div>
            </a>
            <a className="news-item" href="https://cointelegraph.com" target="_blank" rel="noopener noreferrer">
              <div>
                <div className="news-title">Cointelegraph — market news &amp; analysis</div>
                <div className="news-source">cointelegraph.com</div>
              </div>
            </a>
          </Reveal>
        </div>
      </section>

      <section id="fees">
        <div className="wrap">
          <Reveal className="section-eyebrow">Fee structure</Reveal>
          <Reveal as="h2" className="section-title">
            Simple, disclosed upfront
          </Reveal>
          <Reveal as="p" className="section-sub">
            No hidden spreads, no performance-hiding tricks. One fee, clearly stated before you ever deposit.
          </Reveal>
          <div className="fees">
            <Reveal className="fee-card">
              <div className="fee-num">10%</div>
              <div className="fee-label">Performance fee</div>
              <div className="fee-desc">
                Charged only on realized gains in your account — never on losses, never on unrealized paper gains,
                and never on your deposited principal.
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="risk">
        <div className="wrap">
          <Reveal className="section-eyebrow">Required disclosure</Reveal>
          <Reveal as="h2" className="section-title">
            Risk — read this before you deposit anything
          </Reveal>
          <Reveal className="risk-box">
            <div className="risk-title">⚠ This is not a guarantee of any return</div>
            <p>
              Bitcoin and other digital assets are highly volatile. Their value can rise or fall substantially and
              rapidly at any time. Past performance, whether of GenesisX or any manager, is not indicative of
              future results.
            </p>
            <p>
              Trading and holding digital assets involves risk of loss. You should only use funds you can afford
              to lose.
            </p>
            <p>
              Digital assets held in custody carry risks that differ from traditional bank deposits, including
              custodial risk, cybersecurity risk, regulatory risk, and market risk.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="cta-section" id="contact">
        <div className="wrap">
          <h2>Have a question?</h2>
          <p>Reach out to us any time — you can contact one of our staff directly for any kind of assistance or questions.</p>
          <a href="mailto:chasr1226@gmail.com" className="btn-primary">
            Contact us
          </a>
        </div>
      </section>

      <footer>
        <div className="footer-grid">
          <div className="footer-legal">
            GenesisX. Cryptocurrency trading involves substantial risk of loss. Not FDIC insured. Not a bank
            deposit. See full risk disclosure above before depositing funds.
          </div>
          <div className="mono">© 2026 GenesisX</div>
        </div>
      </footer>
    </>
  );
}
