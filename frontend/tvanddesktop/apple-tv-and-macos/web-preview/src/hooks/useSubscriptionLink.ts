import { getProductionApiOrigin } from '../lib/apiOrigin';
import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Subscription Account-Linking flow for TV (Tizen/WebOS/AppleTV/AndroidTV).
 *
 * Pattern (identical to /api/auth/tv/code login flow):
 *   1. TV mounts the Premium Upgrade screen → POST /api/subscription/tv/code
 *   2. Backend returns a 6-digit PIN + `activationUrl` (e.g.
 *        https://www.themegaradio.com/activate?code=XXXXXX )
 *   3. TV renders the QR code of `activationUrl` + the 6-digit PIN
 *   4. User scans QR with phone → opens website → Stripe Checkout → pays
 *   5. Stripe webhook on backend marks the pending-code as "activated" and
 *      attaches the chosen plan to the device's owning account
 *   6. TV polls /api/subscription/tv/code/<code>/status every 3s
 *   7. When `status === 'activated'`, the hook fires `onActivated` (caller
 *      typically refreshes auth context + closes the upgrade screen)
 *
 * Failure modes — handled gracefully (no UI crash):
 *   - network error: silent retry on next poll
 *   - 404 from status endpoint: treat as 'pending' and keep polling
 *   - code expired: backend returns `status: 'expired'` → caller shows "regen" CTA
 *
 * @see AuthContext.tsx — same buildAuthUrl trick (preview tv-proxy vs .wgt direct)
 */

const POLL_INTERVAL_MS = 3000;
const CODE_VALIDITY_FALLBACK_SEC = 600; // 10 minutes if backend omits expiresIn

// API_BASE detection — mirrors AuthContext.tsx so the same code works in both
// the Emergent web preview (relative → tv-proxy → backend) and the .wgt/.ipk
// runtime (absolute URL after prepare-tizen.js rewrite, no CORS).
function detectApiBase(): string {
  try {
    const host = window.location.hostname;
    if (!host || host === "" || host === "localhost" || host.indexOf("themegaradio.com") !== -1) {
      return getProductionApiOrigin();
    }
  } catch (_) { /* ignore */ }
  return "";
}

function buildSubUrl(path: string): string {
  const base = detectApiBase();
  if (base === "") {
    return "/api/tv-proxy" + path.replace(/^\/api/, "");
  }
  return base + path;
}

function getOrCreateDeviceId(): string {
  try {
    const KEY = "megaradio_device_id";
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = "tv-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch (_) {
    return "tv-anon-" + Date.now();
  }
}

export type SubscriptionLinkStatus = "loading" | "pending" | "activated" | "expired" | "error";

export interface ActivationPayload {
  subscription: { tier: string; plan?: string; validUntil?: string };
  user?: { id: string; email?: string; name?: string; token: string };
}

export interface UseSubscriptionLinkResult {
  status: SubscriptionLinkStatus;
  code: string | null;          // 6-digit human-readable PIN
  activationUrl: string | null; // full URL the user navigates to in browser
  expiresAt: number | null;     // unix ms
  countdownLabel: string;       // "MM:SS"
  errorMessage: string | null;
  regenerate: () => void;       // re-request a fresh code (after expiry / error)
}

export function useSubscriptionLink(opts: {
  enabled?: boolean;
  onActivated?: (payload: ActivationPayload) => void;
}): UseSubscriptionLinkResult {
  const enabled = opts.enabled !== false;
  const onActivatedRef = useRef(opts.onActivated);
  onActivatedRef.current = opts.onActivated;

  const [status, setStatus] = useState<SubscriptionLinkStatus>("loading");
  const [code, setCode] = useState<string | null>(null);
  const [activationUrl, setActivationUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [countdownLabel, setCountdownLabel] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0); // bump → triggers refetch

  // 1) Request a fresh code whenever `generation` changes or enabled toggles on.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setStatus("loading");
    setErrorMessage(null);
    setCode(null);
    setActivationUrl(null);

    const deviceId = getOrCreateDeviceId();
    fetch(buildSubUrl("/api/subscription/tv/code"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, source: "tv" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data || !data.success || !data.code) {
          setStatus("error");
          setErrorMessage((data && data.error) || "Failed to obtain activation code");
          return;
        }
        setCode(String(data.code));
        setActivationUrl(String(data.activationUrl || ""));
        const ttlSec = Number(data.expiresIn) || CODE_VALIDITY_FALLBACK_SEC;
        setExpiresAt(Date.now() + ttlSec * 1000);
        setStatus("pending");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(err && err.message ? err.message : "Network error");
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, generation]);

  // 2) Poll status while in "pending" state.
  useEffect(() => {
    if (status !== "pending" || !code) return;
    let cancelled = false;

    const tick = () => {
      const deviceId = getOrCreateDeviceId();
      const url =
        buildSubUrl("/api/subscription/tv/code/" + encodeURIComponent(code) + "/status") +
        "?deviceId=" + encodeURIComponent(deviceId);
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          if (!data) return;
          if (data.status === "activated") {
            setStatus("activated");
            if (onActivatedRef.current) {
              onActivatedRef.current({
                subscription: data.subscription || { tier: "premium" },
                user: data.user, // contains `token` for auto-login on TV
              });
            }
          } else if (data.status === "expired") {
            setStatus("expired");
          }
          // anything else → keep polling
        })
        .catch(() => { /* silent — keep polling */ });
    };

    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [status, code]);

  // 3) Countdown label (MM:SS) for UI display.
  useEffect(() => {
    if (!expiresAt) {
      setCountdownLabel("");
      return;
    }
    const update = () => {
      const ms = expiresAt - Date.now();
      if (ms <= 0) {
        setCountdownLabel("00:00");
        if (status === "pending") setStatus("expired");
        return;
      }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setCountdownLabel((m < 10 ? "0" + m : String(m)) + ":" + (s < 10 ? "0" + s : String(s)));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt, status]);

  const regenerate = useCallback(() => {
    setGeneration((g) => g + 1);
  }, []);

  return { status, code, activationUrl, expiresAt, countdownLabel, errorMessage, regenerate };
}
