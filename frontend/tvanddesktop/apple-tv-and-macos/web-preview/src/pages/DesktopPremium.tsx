import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { usePremium } from '@/hooks/usePremium';

/** The current Mac app has no paid-only features. Existing accounts can restore. */
export function DesktopPremium() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { isPremium, applyVerified } = usePremium();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const active = useRef<{ token: string; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const refreshPremium = useRef(applyVerified);
  refreshPremium.current = applyVerified;
  useEffect(() => {
    const finish = (text: string) => { clearTimeout(active.current?.timer); active.current = null; setBusy(false); setMessage(text); };
    const restored = (event: Event) => {
      if (!active.current || active.current.token !== localStorage.getItem('tv_auth_token')) return;
      const detail = (event as CustomEvent).detail;
      if (detail?.server?.isActive) { refreshPremium.current(detail.server); finish('Your existing purchase has been restored.'); }
      else finish('No active purchase was found for this account.');
    };
    const failed = (event: Event) => {
      if (!active.current) return;
      finish((event as CustomEvent).detail?.message || 'Restore could not be completed. Please try again.');
    };
    window.addEventListener('mr-iap-restored', restored);
    window.addEventListener('mr-iap-failed', failed);
    return () => { clearTimeout(active.current?.timer); active.current = null; window.removeEventListener('mr-iap-restored', restored); window.removeEventListener('mr-iap-failed', failed); };
  }, []);
  const restore = async () => {
    const token = localStorage.getItem('tv_auth_token');
    if (!token) { navigate('/login'); return; }
    if (active.current) return;
    const operation: { token: string; timer?: ReturnType<typeof setTimeout> } = { token };
    active.current = operation; setBusy(true); setMessage('Waiting for the App Store to verify your existing purchase…');
    const finish = (text: string) => { if (active.current !== operation) return; clearTimeout(operation.timer); active.current = null; setBusy(false); setMessage(text); };
    operation.timer = setTimeout(() => finish('No verified restore was received. Check your App Store account and try again.'), 30000);
    try {
      const bridge = (window as any).megaRadioNative;
      if (!bridge?.restorePurchases || !bridge?.setAuthToken) { finish('Restore is available in the Mac App Store version.'); return; }
      await bridge.setAuthToken(token);
      if (active.current !== operation || localStorage.getItem('tv_auth_token') !== token) { finish('Your account changed. Sign in again to restore.'); return; }
      const result = await bridge.restorePurchases(token);
      if (!result?.ok) finish(result?.message || 'Restore could not start. Please try again.');
    } catch (error: any) { finish(error?.message || 'Restore could not start. Please try again.'); }
  };
  return <section data-testid="desktop-account-listening" style={{ position: 'absolute', inset: 0, zIndex: 11000, background: '#0e0e0e', color: '#fff', padding: '90px 180px', fontFamily: "'Ubuntu', sans-serif", display: 'flex', flexDirection: 'column', gap: 28 }}>
    <h1 style={{ fontSize: 48, margin: 0 }}>Account &amp; Listening</h1>
    <h2 style={{ color: '#ff74b3', fontSize: 30, margin: 0 }}>Radio listening is included on Mac</h2>
    <p style={{ fontSize: 25, lineHeight: 1.6, maxWidth: 1300, margin: 0 }}>Discover stations, search, save favorites and listen without buying a subscription in this Mac app. Advertisements within a station’s broadcast are controlled by the broadcaster.</p>
    <p data-testid="desktop-account-status" style={{ fontSize: 24, margin: 0 }}>{isAuthenticated ? (isPremium ? 'Signed in · existing Premium account recognized' : 'Signed in') : 'You can listen without signing in.'}</p>
    <div style={{ display: 'flex', gap: 20 }}>
      {!isAuthenticated && <button style={buttonStyle} onClick={() => navigate('/login')}>Sign in</button>}
      <button data-testid="desktop-restore" disabled={busy} onClick={restore} style={{ ...buttonStyle, opacity: busy ? 0.6 : 1 }}>{busy ? 'Restoring…' : 'Restore Existing Purchases'}</button>
      <button style={buttonStyle} onClick={() => navigate('/settings')}>Back to Settings</button>
    </div>
    <p role="status" aria-live="polite" style={{ minHeight: 36, margin: 0, fontSize: 23 }}>{message}</p>
    <p style={{ fontSize: 22, color: '#aaa', margin: 0 }}>Restore checks purchases previously associated with your App Store account. To manage an existing Apple subscription, open the App Store → your name → Account Settings → Subscriptions → Manage.</p>
    <nav aria-label="Legal documents" style={{ marginTop: 'auto', display: 'flex', gap: 28 }}>
      <button data-testid="desktop-account-privacy" style={buttonStyle} onClick={() => navigate('/privacy')}>Privacy Policy</button>
      <button data-testid="desktop-account-terms" style={buttonStyle} onClick={() => navigate('/terms')}>Terms of Use (EULA)</button>
    </nav>
  </section>;
}
const buttonStyle = { background: '#333', border: '1px solid #777', borderRadius: 14, color: '#fff', padding: '20px 28px', fontSize: 24, cursor: 'pointer' };
