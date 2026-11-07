import { isMacAppStore } from "@/lib/platform";
import { useLocation } from "wouter";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { useLocalization } from "@/contexts/LocalizationContext";

/**
 * Global past-due / payment-issue banner. Mounts at app root, polls
 * subscription status every 5 min, and shows a non-blocking top banner
 * when the user's payment is past_due (Stripe terminology — last charge
 * failed but Stripe is retrying).
 *
 * Tapping the banner takes the user to /manage-subscription where they
 * see a QR to update payment on their phone — the only way to fix
 * past_due without violating Tizen/WebOS payment policy.
 *
 * Hidden when:
 *   - status is "active" / "trialing" / "canceled"
 *   - user is unauthenticated (no sub → nothing to be past-due about)
 *   - on /manage-subscription / /premium-upgrade / /onboarding-premium
 *     (user is already addressing it; don't double-nudge)
 */
export const PastDueBanner = (): JSX.Element | null => {
  const { info } = useSubscriptionStatus();
  const { t } = useLocalization();
  const [location, setLocation] = useLocation();

  if (isMacAppStore() || !info || info.status !== "past_due") return null;
  const muted = ["/manage-subscription", "/premium-upgrade", "/onboarding-premium"].some(
    (p) => location.startsWith(p)
  );
  if (muted) return null;

  return (
    <div
      data-testid="past-due-banner"
      onClick={() => setLocation("/manage-subscription")}
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        padding: "12px 28px",
        borderRadius: 12,
        background: "linear-gradient(135deg, #c0392b 0%, #e74c3c 100%)",
        color: "#fff",
        boxShadow: "0 8px 28px rgba(231,76,60,0.5)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: "'Ubuntu', Helvetica",
        fontSize: 18,
        fontWeight: 600,
        maxWidth: 720,
        animation: "pulse 2s ease-in-out infinite",
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L1 21h22L12 2z" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
        <line x1="12" y1="9" x2="12" y2="14" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1" fill="#fff" />
      </svg>
      <span>
        {t("past_due_banner") ||
          "Payment failed — update your card to keep Premium active. Tap to fix."}
      </span>
      <style>{`@keyframes pulse{0%,100%{box-shadow:0 8px 28px rgba(231,76,60,0.5)}50%{box-shadow:0 8px 36px rgba(231,76,60,0.85)}}`}</style>
    </div>
  );
};
