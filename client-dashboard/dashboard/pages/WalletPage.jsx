import React, { useState } from "react";
import QRCode from "react-qr-code";
import { Download } from "lucide-react";
import { useAccount, balance, totalDeposited, totalWithdrawn } from "../AccountContext.jsx";
import { COLORS, fmtUSD, PageHeader, Card, CopyField, SummaryCard, LoadingPage, ErrorPage } from "../shared.jsx";

function DepositQRCode({ address }) {
  if (!address) return null;
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

export default function WalletPage() {
  const { client, loadError, handleDownload } = useAccount();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  if (loadError) return <ErrorPage message={loadError} />;
  if (!client) return <LoadingPage />;

  const bal = balance(client);
  const deposited = totalDeposited(client);
  const withdrawn = totalWithdrawn(client);

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
      <PageHeader title="Wallet" subtitle="Your deposit address, balances, and statements." />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 28 }}>
        <SummaryCard label="Balance" value={fmtUSD(bal)} />
        <SummaryCard label="Total deposited" value={fmtUSD(deposited)} />
        <SummaryCard label="Total withdrawn" value={fmtUSD(withdrawn)} />
      </div>

      <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
        Deposit instructions
      </div>
      <Card style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12.5, color: COLORS.boneDim, lineHeight: 1.6, marginBottom: 14 }}>
          Send BTC to the address below, then message us with the amount and your reference code so we can match
          it to your account. Deposits are logged manually once confirmed on-chain — this usually takes a few
          hours.
        </div>
        <DepositQRCode address={client.depositAddress} />
        <CopyField label="Deposit address" value={client.depositAddress} />
        <CopyField label="Your reference code" value={client.depositReference} mono />
      </Card>

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
