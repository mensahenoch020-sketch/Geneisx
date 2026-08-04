import React from "react";
import { useAccount } from "../AccountContext.jsx";
import { COLORS, PageHeader, Card, LoadingPage, ErrorPage } from "../shared.jsx";

export default function SupportPage() {
  const { client, loadError } = useAccount();

  if (loadError) return <ErrorPage message={loadError} />;
  if (!client) return <LoadingPage />;

  return (
    <div>
      <PageHeader title="Support" subtitle="Need help with a deposit, withdrawal, or your account?" />
      <Card>
        <div style={{ fontSize: 13.5, color: COLORS.boneDim, lineHeight: 1.7 }}>
          For deposit matching, withdrawal requests, or anything account-related, reach out with your reference
          code so we can look you up quickly.
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
            Your reference code
          </div>
          <div className="mono" style={{ fontSize: 14 }}>{client.depositReference || "—"}</div>
        </div>
      </Card>
    </div>
  );
}
