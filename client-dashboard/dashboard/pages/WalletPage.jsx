import React, { useState } from "react";
import QRCode from "react-qr-code";
import { Download, Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useAccount, balance, totalDeposited, totalWithdrawn } from "../AccountContext.jsx";
import { COLORS, fmtUSD, PageHeader, Card, CopyField, SummaryCard, LoadingPage, ErrorPage } from "../shared.jsx";
import WithdrawPanel from "../WithdrawPanel.jsx";

const ASSET_ACCENTS = { BTC: "#F7931A", USDT: "#26A17B", SOL: "#9945FF", ETH: "#8C8CFF", TRON: "#EF0027" };

function DepositQRCode({ address }) {
  if (!address) return null;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        marginBottom: 14,
        background: "#FFFFFF",
        borderRadius: 10,
        padding: 16,
        border: `1px solid ${COLORS.panelBorder}`,
      }}
    >
      <QRCode value={address} size={160} bgColor="#FFFFFF" fgColor="#000000" />
    </div>
  );
}

export default function WalletPage() {
  const { client, loadError, handleDownload } = useAccount();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [showWithdraw, setShowWithdraw] = useState(false);

  // Falls back to the single legacy BTC address if no multi-asset wallets
  // are configured yet on the backend (SHARED_DEPOSIT_ADDRESS_* env vars) —
  // so this never shows an empty page while those are being set up.
  const wallets =
    client && client.depositWallets && client.depositWallets.length > 0
      ? client.depositWallets
      : client && client.depositAddress
      ? [{ asset: "BTC", name: "Bitcoin", network: "Bitcoin", address: client.depositAddress }]
      : [];

  const [activeAsset, setActiveAsset] = useState(null);

  if (loadError) return <ErrorPage message={loadError} />;
  if (!client) return <LoadingPage />;

  const bal = balance(client);
  const deposited = totalDeposited(client);
  const withdrawn = totalWithdrawn(client);
  const selected = wallets.find((w) => w.asset === activeAsset) || wallets[0];

  async function onDownload(format) {
    setDownloadError("");
    setDownloading(true);
    try {
      await handleDownload(format);
    } catch (err) {
      setDownloadError(err.message || "Could not download statement");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Wallet" subtitle="Your deposit addresses, balances, and statements." />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 28 }}>
        <SummaryCard label="Balance" value={fmtUSD(bal)} icon={WalletIcon} accent={COLORS.gain} />
        <SummaryCard label="Total deposited" value={fmtUSD(deposited)} icon={ArrowDownToLine} accent="#4C9BE8" />
        <SummaryCard label="Total withdrawn" value={fmtUSD(withdrawn)} icon={ArrowUpFromLine} accent="#E8B84C" />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6 }}>
          Deposit instructions
        </div>
      </div>

      {wallets.length === 0 ? (
        <Card style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12.5, color: COLORS.boneDim, lineHeight: 1.6 }}>
            No deposit addresses are configured yet. Contact support and we'll get one set up for you.
          </div>
        </Card>
      ) : (
        <>
          {wallets.length > 1 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {wallets.map((w) => {
                const accent = ASSET_ACCENTS[w.asset] || COLORS.gain;
                const isActive = selected.asset === w.asset;
                return (
                  <button
                    key={w.asset}
                    onClick={() => setActiveAsset(w.asset)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: isActive ? accent : COLORS.panel,
                      color: isActive ? "#FFFFFF" : COLORS.bone,
                      border: `1px solid ${isActive ? accent : COLORS.panelBorder}`,
                      borderRadius: 8,
                      padding: "8px 14px",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {w.asset}
                  </button>
                );
              })}
            </div>
          )}

          <Card style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: `${ASSET_ACCENTS[selected.asset] || COLORS.gain}1f`,
                  color: ASSET_ACCENTS[selected.asset] || COLORS.gain,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 12,
                }}
                className="mono"
              >
                {selected.asset.slice(0, 1)}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{selected.name || selected.asset}</div>
                <div style={{ fontSize: 11.5, color: COLORS.boneDim }}>{selected.network} network</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: COLORS.boneDim, lineHeight: 1.6, marginBottom: 14 }}>
              Send {selected.asset} on the {selected.network} network to the address below, then message us with
              the amount and your reference code so we can match it to your account. Deposits are logged manually
              once confirmed on-chain — this usually takes a few hours.
            </div>
            <DepositQRCode address={selected.address} />
            <CopyField label={`${selected.asset} deposit address`} value={selected.address} mono />
            <CopyField label="Your reference code" value={client.depositReference} mono />
          </Card>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6 }}>
          Withdraw
        </div>
        {!showWithdraw && (
          <button
            onClick={() => setShowWithdraw(true)}
            style={{ background: "transparent", border: "none", color: COLORS.gain, fontSize: 12.5, fontWeight: 700 }}
          >
            Request a withdrawal
          </button>
        )}
      </div>
      {showWithdraw && (
        <div style={{ marginBottom: 28 }}>
          <WithdrawPanel onClose={() => setShowWithdraw(false)} />
        </div>
      )}

      <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
        Statements
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => onDownload("pdf")}
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
          onClick={() => onDownload("csv")}
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
      {downloadError && <div style={{ color: COLORS.loss, fontSize: 12, marginTop: 10 }}>{downloadError}</div>}
    </div>
  );
}
