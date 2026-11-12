import { getProductionApiOrigin } from '../lib/apiOrigin';
import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Subscription status hook — keeps the TV in sync with the backend's view
 * of the user's plan. Called on app launch (refresh-on-mount) and after
 * any subscription-changing event (activation, restore).
 *
 * Backend contract:  GET /api/subscription/status  (auth required)
 *   200 → { tier, plan, status, validUntil, renewsAt, cancelAtPeriodEnd }
 *   401 → user not authenticated (silently treated as "free")
 *   anything else → silent retry on next refresh
 */

export type SubTier = "free" | "premium";
export type SubStatus = "active" | "past_due" | "canceled" | "trialing";

export interface SubscriptionInfo {
  tier: SubTier;
  plan?: "monthly" | "annual";
  status?: SubStatus;
  validUntil?: string;
  renewsAt?: string;
  cancelAtPeriodEnd?: boolean;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes — quiet polling

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
  if (base === "") return "/api/tv-proxy" + path.replace(/^\/api/, "");
  return base + path;
}

export function useSubscriptionStatus(): {
  info: SubscriptionInfo | null;
  loading: boolean;
  refresh: () => void;
} {
  const { token, isAuthenticated } = useAuth();
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedAtRef = useRef<number>(0);

  const refresh = useCallback(() => {
    if (!isAuthenticated || !token) {
      setInfo(null);
      return;
    }
    setLoading(true);
    fetch(buildSubUrl("/api/subscription/status"), {
      headers: { Authorization: "Bearer " + token },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (data && data.tier) {
          setInfo({
            tier: data.tier,
            plan: data.plan,
            status: data.status,
            validUntil: data.validUntil,
            renewsAt: data.renewsAt,
            cancelAtPeriodEnd: !!data.cancelAtPeriodEnd,
          });
          fetchedAtRef.current = Date.now();
        }
      })
      .catch(() => { /* silent — keep previous info or null */ })
      .finally(() => setLoading(false));
  }, [token, isAuthenticated]);

  // Refresh on auth change + every 5 min while app is alive.
  useEffect(() => {
    refresh();
    if (!isAuthenticated) return;
    const id = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh, isAuthenticated]);

  return { info, loading, refresh };
}
