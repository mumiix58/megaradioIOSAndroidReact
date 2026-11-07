import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { useSubscriptionLink } from "@/hooks/useSubscriptionLink";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { usePageKeyHandler } from "@/contexts/FocusRouterContext";
import { assetPath } from "@/lib/assetPath";
import { isMacAppStore, supportsNativeIap } from "@/lib/platform";
import { PremiumUpgradeNative } from "./PremiumUpgradeNative";
import { DesktopPremium } from './DesktopPremium';

/**
 * Premium upgrade screen.
 *
 * Platform routing:
 *   - Apple TV (tvOS) → native StoreKit purchase via JS bridge
 *   - Android TV       → native Google Play Billing via JS bridge
 *   - Tizen / WebOS / Web / Electron → QR-code + 6-digit PIN
 *     Account-Linking flow (Stripe Checkout on user's phone). This is the
 *     ONLY compliant option on Samsung/LG TVs (they forbid in-app billing
 *     outside their own marketplaces).
 *
 * Both branches share the same `Auth.loginWithToken()` payload contract
 * and Backend `/api/user/subscription` endpoint, so once the user is
 * Premium it shows up identically across all platforms.
 */
export function PremiumUpgrade(): JSX.Element {
  if (isMacAppStore()) return <DesktopPremium />;
  if (supportsNativeIap()) {
    return <PremiumUpgradeNative />;
  }
  return <PremiumUpgradeQr />;
}

/**
 * QR-code Account-Linking flow (Samsung / LG / Web / Desktop).
 */
function PremiumUpgradeQr(): JSX.Element {
  const { t } = useLocalization();
  const [, setLocation] = useLocation();
  const auth = useAuth();
  const [focusIndex, setFocusIndex] = useState(0); // 0 = Cancel, 1 = Regenerate (only when expired/error)

  const { status, code, activationUrl, countdownLabel, errorMessage, regenerate } =
    useSubscriptionLink({
      enabled: true,
      onActivated: (payload) => {
        console.log("[Premium] Activation received");
        // Auto-login the TV using the backend-issued bearer token. No
        // credentials are typed on the device — the user authenticated on
        // their phone via Stripe/Paddle Checkout, the backend handed us a
        // JWT, we trust it.
        if (payload.user && payload.user.token) {
          auth.loginWithToken(payload.user.token, {
            id: payload.user.id,
            name: payload.user.name || payload.user.email || "Premium User",
            email: payload.user.email,
            subscription: {
              tier: (payload.subscription.tier as 'free' | 'premium') || 'premium',
              plan: payload.subscription.plan as 'monthly' | 'annual',
              validUntil: payload.subscription.validUntil,
            },
          });
        }
      },
    });

  const showRegenerate = status === "expired" || status === "error";
  const totalItems = showRegenerate ? 2 : 1;

  usePageKeyHandler("/premium-upgrade", (e: KeyboardEvent) => {
    const kc = e.keyCode || 0;
    switch (kc) {
      case 37: // LEFT
      case 39: // RIGHT
        if (showRegenerate) setFocusIndex((i) => (i === 0 ? 1 : 0));
        break;
      case 13: // ENTER
        if (focusIndex === 0) {
          setLocation("/discover-no-user");
        } else if (showRegenerate && focusIndex === 1) {
          setFocusIndex(0);
          regenerate();
        }
        break;
      case 10009: // Samsung BACK
      case 461:   // LG BACK
      case 8:
        setLocation("/discover-no-user");
        break;
    }
  });

  // When activated, auto-redirect after 2s so the user sees the success state.
  useEffect(() => {
    if (status !== "activated") return;
    const id = setTimeout(() => setLocation("/discover-no-user"), 2200);
    return () => clearTimeout(id);
  }, [status, setLocation]);

  function focusStyle(isFocused: boolean): React.CSSProperties {
    return isFocused
      ? {
          border: "3px solid #ff4199",
          backgroundColor: "rgba(255,65,153,0.18)",
          boxShadow: "0 0 24px rgba(255,65,153,0.45)",
          transform: "scale(1.04)",
        }
      : {
          border: "3px solid rgba(255,255,255,0.18)",
          backgroundColor: "rgba(255,255,255,0.06)",
          boxShadow: "none",
        };
  }

  const codeChars = code ? code.split("") : [];

  return (
    <div
      data-testid="page-premium-upgrade"
      style={{
        position: "relative",
        width: "1920px",
        height: "1080px",
        backgroundColor: "#0e0e0e",
        overflow: "hidden",
        color: "white",
        fontFamily: "'Ubuntu', Helvetica",
      }}
    >
      {/* Logo */}
      <div style={{ position: "absolute", left: 96, top: 80, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={assetPath("images/path-8.svg")} alt="" style={{ width: 60, height: 60 }} />
        <span style={{ fontSize: 32 }}>
          <span style={{ fontWeight: "bold" }}>mega</span>radio
        </span>
      </div>

      {/* Title + subtitle */}
      <div style={{ position: "absolute", left: 96, top: 220, maxWidth: 760 }}>
        <p style={{ fontSize: 18, color: "#ff4199", letterSpacing: 2, fontWeight: "bold", margin: 0 }}>
          MEGARADIO PREMIUM
        </p>
        <h1 style={{ fontSize: 58, fontWeight: "bold", margin: "16px 0 0 0", lineHeight: 1.1 }}>
          {t("premium_upgrade_title") || "Upgrade on your phone"}
        </h1>
        <p style={{ fontSize: 24, color: "rgba(255,255,255,0.75)", marginTop: 24, lineHeight: 1.5 }}>
          {t("premium_upgrade_subtitle") ||
            "Scan the QR code or visit the URL on any device, then enter the 6-digit code. Payment happens securely in your browser."}
        </p>

        {/* Benefits list */}
        <ul style={{ marginTop: 36, padding: 0, listStyle: "none", fontSize: 22, lineHeight: 1.8 }}>
          {[
            t("premium_benefit_no_ads") || "Ad-free listening",
            t("premium_benefit_quality") || "High-quality streams",
            t("premium_benefit_multi") || "Works on all your devices",
          ].map((line) => (
            <li key={line} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: "#ff4199", fontSize: 24 }}>✦</span>
              {line}
            </li>
          ))}
        </ul>
      </div>

      {/* Right panel: QR + code */}
      <div
        style={{
          position: "absolute",
          right: 96,
          top: 220,
          width: 680,
          padding: 48,
          borderRadius: 24,
          backgroundColor: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.10)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
        data-testid="premium-link-panel"
      >
        {status === "loading" && (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div
              style={{
                width: 60,
                height: 60,
                margin: "0 auto",
                border: "4px solid rgba(255,65,153,0.3)",
                borderTopColor: "#ff4199",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            <p style={{ marginTop: 24, fontSize: 20, color: "rgba(255,255,255,0.7)" }}>
              {t("loading") || "Loading..."}
            </p>
          </div>
        )}

        {status === "activated" && (
          <div style={{ padding: 48, textAlign: "center" }} data-testid="premium-activated">
            <div style={{
              width: 96, height: 96, borderRadius: "50%",
              backgroundColor: "rgba(46,204,113,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto",
            }}>
              <svg width={56} height={56} viewBox="0 0 24 24" fill="none">
                <circle cx={12} cy={12} r={10} stroke="#2ecc71" strokeWidth={2} />
                <path d="M7 12.5l3 3 7-7" stroke="#2ecc71" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 style={{ fontSize: 36, fontWeight: "bold", marginTop: 24 }}>
              {t("premium_activated") || "You're Premium!"}
            </h2>
            <p style={{ fontSize: 20, color: "rgba(255,255,255,0.7)", marginTop: 16 }}>
              {t("premium_redirecting") || "Returning to your radio..."}
            </p>
          </div>
        )}

        {(status === "pending") && code && (
          <>
            {/* QR code */}
            <div
              style={{
                width: 280,
                height: 280,
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              data-testid="premium-qr-wrapper"
            >
              {activationUrl ? (
                <QRCodeSVG
                  value={activationUrl}
                  size={248}
                  level="H"
                  includeMargin={false}
                  fgColor="#0e0e0e"
                  bgColor="#ffffff"
                  imageSettings={{
                    src: assetPath('images/logo.png'),
                    height: 52,
                    width: 52,
                    excavate: true,
                  }}
                />
              ) : null}
            </div>

            {/* Or */}
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", marginTop: 24, letterSpacing: 2 }}>
              {t("or") || "OR ENTER CODE"}
            </p>

            {/* 6-digit code */}
            <div style={{ display: "flex", gap: 12, marginTop: 18 }} data-testid="premium-code-digits">
              {codeChars.map((ch, idx) => (
                <div
                  key={idx}
                  style={{
                    width: 56,
                    height: 72,
                    borderRadius: 12,
                    backgroundColor: "rgba(255,65,153,0.12)",
                    border: "2px solid rgba(255,65,153,0.45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 36,
                    fontWeight: "bold",
                    color: "#fff",
                  }}
                >
                  {ch}
                </div>
              ))}
            </div>

            {/* URL hint + countdown */}
            <p style={{ fontSize: 16, marginTop: 24, color: "rgba(255,255,255,0.75)" }}>
              {activationUrl
                ? activationUrl.replace(/^https?:\/\//, "")
                : "themegaradio.com/activate"}
            </p>
            {countdownLabel && (
              <p style={{ fontSize: 14, marginTop: 8, color: "rgba(255,255,255,0.45)" }}>
                {(t("code_expires_in") || "Code expires in") + " " + countdownLabel}
              </p>
            )}
          </>
        )}

        {(status === "expired" || status === "error") && (
          <div style={{ padding: 32, textAlign: "center" }} data-testid="premium-error">
            <p style={{ fontSize: 24, fontWeight: "bold", color: "#ff4199" }}>
              {status === "expired"
                ? (t("code_expired") || "Code expired")
                : (t("connection_error") || "Connection error")}
            </p>
            {errorMessage && (
              <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", marginTop: 12 }}>{errorMessage}</p>
            )}
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <div style={{ position: "absolute", left: 96, bottom: 64, display: "flex", gap: 24 }}>
        <button
          data-testid="button-premium-cancel"
          onClick={() => setLocation("/discover-no-user")}
          style={{
            ...focusStyle(focusIndex === 0),
            padding: "16px 40px",
            borderRadius: 30,
            fontSize: 20,
            color: "white",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          {t("cancel") || "Cancel"}
        </button>
        {showRegenerate && (
          <button
            data-testid="button-premium-regenerate"
            onClick={() => regenerate()}
            style={{
              ...focusStyle(focusIndex === 1),
              padding: "16px 40px",
              borderRadius: 30,
              fontSize: 20,
              color: "white",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {t("generate_new_code") || "Generate new code"}
          </button>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
