import { useState } from "react";
import { useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePageKeyHandler } from "@/contexts/FocusRouterContext";
import { isMacAppStore } from "@/lib/platform";
import { DesktopPremium } from "./DesktopPremium";
import { assetPath } from "@/lib/assetPath";

/**
 * Manage Subscription deep-link screen.
 *
 * Single source of truth for "I need to do something with my plan":
 *   - update payment method (past_due)
 *   - change plan (monthly → annual upgrade)
 *   - cancel
 *   - resume after cancellation
 *
 * The TV cannot host any of these flows (Tizen/LG payment policy), so we
 * just point the user at https://www.themegaradio.com/account via QR +
 * URL. Backend is responsible for that web page; TV side is just a
 * presentation layer + status badge.
 */
const ACCOUNT_URL = "https://www.themegaradio.com/account";

export const ManageSubscription = (): JSX.Element => isMacAppStore() ? <DesktopPremium /> : <ManageSubscriptionQr />;

const ManageSubscriptionQr = (): JSX.Element => {
  const { t } = useLocalization();
  const { user } = useAuth();
  const { info, loading, refresh } = useSubscriptionStatus();
  const [, setLocation] = useLocation();
  const [focusIndex, setFocusIndex] = useState(0); // 0 = Back, 1 = Refresh

  usePageKeyHandler("/manage-subscription", (e: KeyboardEvent) => {
    const kc = e.keyCode || 0;
    switch (kc) {
      case 37: setFocusIndex(0); break;
      case 39: setFocusIndex(1); break;
      case 13:
        if (focusIndex === 0) setLocation("/settings");
        else refresh();
        break;
      case 10009: case 461: case 8:
        setLocation("/settings");
        break;
    }
  });

  const status = info?.status || "active";
  const tier = info?.tier || "free";
  const validUntil = info?.validUntil ? new Date(info.validUntil).toLocaleDateString() : "—";
  const renewsAt = info?.renewsAt ? new Date(info.renewsAt).toLocaleDateString() : "—";

  // Status pill style
  const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
    active:    { bg: "rgba(46,204,113,0.18)", color: "#2ecc71", label: t("status_active")     || "Active" },
    trialing:  { bg: "rgba(52,152,219,0.18)", color: "#3498db", label: t("status_trialing")   || "Trial" },
    past_due:  { bg: "rgba(231,76,60,0.22)",  color: "#e74c3c", label: t("status_past_due")   || "Payment failed" },
    canceled:  { bg: "rgba(180,180,180,0.18)",color: "#bbbbbb", label: t("status_canceled")   || "Canceled" },
  };
  const sx = statusStyles[status] || statusStyles.active;

  return (
    <div
      data-testid="page-manage-subscription"
      style={{
        position: "relative",
        width: "1920px", height: "1080px",
        backgroundColor: "#0e0e0e",
        color: "white",
        fontFamily: "'Ubuntu', Helvetica",
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <div style={{ position: "absolute", left: 96, top: 80, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={assetPath("images/path-8.svg")} alt="" style={{ width: 56, height: 56 }} />
        <span style={{ fontSize: 28 }}>
          <span style={{ fontWeight: "bold" }}>mega</span>radio
        </span>
      </div>

      {/* Left column — subscription details */}
      <div style={{ position: "absolute", left: 96, top: 220, maxWidth: 780 }}>
        <p style={{ fontSize: 16, color: "#ff4199", letterSpacing: 3, fontWeight: 700, margin: 0 }}>
          {t("manage_subscription_kicker") || "YOUR SUBSCRIPTION"}
        </p>
        <h1 style={{ fontSize: 56, fontWeight: "bold", margin: "16px 0 0", lineHeight: 1.1 }}>
          {tier === "premium"
            ? (t("manage_subscription_title_premium") || "MegaRadio Premium")
            : (t("manage_subscription_title_free")    || "Free plan")}
        </h1>

        {/* Status pill */}
        <div
          data-testid="subscription-status-pill"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 18px",
            borderRadius: 30,
            backgroundColor: sx.bg,
            border: `1.5px solid ${sx.color}`,
            color: sx.color,
            marginTop: 24,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: sx.color }} />
          {sx.label.toUpperCase()}
        </div>

        {/* Detail rows */}
        <div style={{ marginTop: 40, fontSize: 20, lineHeight: 1.9 }}>
          {tier === "premium" && (
            <>
              <Row label={t("plan") || "Plan"} value={info?.plan === "annual" ? (t("annual") || "Annual") : (t("monthly") || "Monthly")} />
              {info?.cancelAtPeriodEnd ? (
                <Row label={t("ends_on") || "Ends on"} value={validUntil} highlight />
              ) : (
                <Row label={t("renews_on") || "Renews on"} value={renewsAt} />
              )}
              <Row label={t("account") || "Account"} value={user?.email || user?.name || "—"} />
            </>
          )}
        </div>

        {/* Context-specific message */}
        <p
          style={{
            marginTop: 36, fontSize: 18, lineHeight: 1.5,
            color: status === "past_due" ? "#e74c3c" : "rgba(255,255,255,0.6)",
            maxWidth: 700,
          }}
        >
          {status === "past_due"
            ? (t("manage_subscription_past_due_msg") ||
                "Your last payment failed. Scan the QR code with your phone and update your card to keep Premium.")
            : info?.cancelAtPeriodEnd
              ? (t("manage_subscription_canceling_msg") ||
                  "You've canceled — Premium stays active until the end of the period. Scan to resume.")
              : (t("manage_subscription_default_msg") ||
                  "Scan the QR code with your phone to change your plan, update payment, or cancel.")}
        </p>
      </div>

      {/* Right column — QR card */}
      <div
        style={{
          position: "absolute", right: 96, top: 220,
          width: 560,
          padding: 40,
          borderRadius: 24,
          backgroundColor: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.10)",
          display: "flex", flexDirection: "column", alignItems: "center",
        }}
      >
        <div
          style={{
            width: 260, height: 260,
            background: "#fff",
            borderRadius: 16, padding: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <QRCodeSVG value={ACCOUNT_URL} size={232} level="M" includeMargin={false} fgColor="#0e0e0e" bgColor="#ffffff" />
        </div>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 22, letterSpacing: 2 }}>
          {t("scan_with_phone") || "SCAN WITH YOUR PHONE"}
        </p>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.85)", marginTop: 10, fontWeight: 600 }}>
          themegaradio.com/account
        </p>
        {loading && (
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginTop: 14 }}>
            {t("refreshing") || "Refreshing…"}
          </p>
        )}
      </div>

      {/* Footer buttons */}
      <div style={{ position: "absolute", left: 96, bottom: 80, display: "flex", gap: 16 }}>
        <FooterButton focused={focusIndex === 0} onClick={() => setLocation("/settings")} testid="button-manage-back">
          {t("back") || "Back"}
        </FooterButton>
        <FooterButton focused={focusIndex === 1} onClick={refresh} testid="button-manage-refresh">
          {t("refresh_status") || "Refresh status"}
        </FooterButton>
      </div>
    </div>
  );
};

const Row = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div style={{ display: "flex", gap: 16 }}>
    <span style={{ color: "rgba(255,255,255,0.45)", minWidth: 140 }}>{label}</span>
    <span style={{ color: highlight ? "#ff4199" : "#fff", fontWeight: 500 }}>{value}</span>
  </div>
);

const FooterButton = (props: {
  focused: boolean; onClick: () => void; testid: string; children: React.ReactNode;
}) => (
  <button
    onClick={props.onClick}
    data-testid={props.testid}
    style={{
      padding: "16px 36px",
      borderRadius: 30,
      border: props.focused ? "3px solid #ff4199" : "3px solid rgba(255,255,255,0.18)",
      backgroundColor: props.focused ? "rgba(255,65,153,0.18)" : "rgba(255,255,255,0.06)",
      color: "white", fontSize: 18, fontWeight: 500,
      cursor: "pointer",
      transform: props.focused ? "scale(1.04)" : "scale(1)",
      boxShadow: props.focused ? "0 0 24px rgba(255,65,153,0.45)" : "none",
      transition: "all 0.15s",
    }}
  >
    {props.children}
  </button>
);
