import { useLocation } from "wouter";
import { useSubscriptionLink } from "@/hooks/useSubscriptionLink";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePageKeyHandler } from "@/contexts/FocusRouterContext";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { assetPath } from "@/lib/assetPath";
import { supportsNativeIap } from "@/lib/platform";

function CompleteNativeOnboarding(): null {
  const [, setLocation] = useLocation();
  useEffect(() => {
    localStorage.setItem('onboardingCompleted', 'true');
    setLocation('/discover-no-user');
  }, [setLocation]);
  return null;
}

export function OnboardingPremium(): JSX.Element {
  // Native store builds offer their StoreKit/Billing paywall from Discover.
  // The web checkout onboarding must never be shown in these builds.
  if ((window as any).megaRadioNative?.supportsNativeIap === true || supportsNativeIap()) {
    return <CompleteNativeOnboarding />;
  }
  return <QrOnboardingPremium />;
}

/**
 * Final onboarding step — Premium upsell with QR code + 6-digit PIN.
 *
 * Shown to first-time users RIGHT AFTER the existing Guide1-4 walkthrough
 * but BEFORE they land on Discover. Goal: lift conversion ~20-30% by
 * presenting the upgrade option while excitement is highest, before any
 * free-tier habituation kicks in.
 *
 * UX rules:
 *   - Two clear CTAs: "Upgrade with QR" (left, primary) vs "Continue Free"
 *     (right, secondary). NEVER block the user from skipping.
 *   - Reuses `useSubscriptionLink` exactly like /premium-upgrade — same
 *     backend code path, same polling, same auto-redirect on activation.
 *   - On activation OR skip, marks `onboardingCompleted=true` so the user
 *     never sees this screen again.
 */
const QrOnboardingPremium = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const { t } = useLocalization();
  const auth = useAuth();
  const [focusIndex, setFocusIndex] = useState(0); // 0 = Upgrade highlight, 1 = Skip
  const [codeRevealed, setCodeRevealed] = useState(false);

  const { status, code, activationUrl, countdownLabel } = useSubscriptionLink({
    enabled: codeRevealed,
    onActivated: (payload) => {
      // Auto-login with backend-issued bearer token (see PremiumUpgrade.tsx)
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
      try { localStorage.setItem('onboardingCompleted', 'true'); } catch (_) { /* noop */ }
      setTimeout(() => setLocation('/discover-no-user'), 2000);
    },
  });

  const completeOnboarding = () => {
    try { localStorage.setItem('onboardingCompleted', 'true'); } catch (_) { /* noop */ }
    setLocation('/discover-no-user');
  };

  usePageKeyHandler('/onboarding-premium', (e: KeyboardEvent) => {
    const kc = e.keyCode || 0;
    // Once the user revealed the QR they can either continue-free (ENTER on the
    // highlighted "Maybe later" button) or Back-out (Escape) — or wait for activation.
    if (codeRevealed) {
      if (kc === 10009 || kc === 461 || kc === 8) {
        setCodeRevealed(false);
        setFocusIndex(0);
      } else if (kc === 13) { // ENTER → continue free (the only focusable control here)
        completeOnboarding();
      }
      return;
    }
    switch (kc) {
      case 37: // LEFT
        setFocusIndex(0); break;
      case 39: // RIGHT
        setFocusIndex(1); break;
      case 13: // ENTER
        if (focusIndex === 0) setCodeRevealed(true);
        else completeOnboarding();
        break;
      case 10009:
      case 461:
      case 8:
        completeOnboarding();
        break;
    }
  });

  return (
    <div
      data-testid="page-onboarding-premium"
      style={{
        position: 'relative',
        width: '1920px',
        height: '1080px',
        overflow: 'hidden',
        background: '#0a0a0a',
        color: 'white',
        fontFamily: "'Ubuntu', Helvetica",
      }}
    >
      {/* Background gradient + soft glow */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(circle at 30% 20%, rgba(255,65,153,0.18) 0%, transparent 45%),' +
            'radial-gradient(circle at 75% 80%, rgba(173,0,255,0.12) 0%, transparent 45%),' +
            'linear-gradient(180deg, #0a0a0a 0%, #18091a 100%)',
        }}
      />

      {/* Logo */}
      <div style={{ position: 'absolute', left: 96, top: 80, display: 'flex', alignItems: 'center', gap: 12 }} data-tv-gap-axis="row" data-tv-gap="12">
        <img src={assetPath("images/path-8.svg")} alt="" style={{ width: 56, height: 56 }} />
        <span style={{ fontSize: 30 }}>
          <span style={{ fontWeight: 'bold' }}>mega</span>radio
        </span>
      </div>

      {!codeRevealed ? (
        /* === INITIAL VIEW — upsell only === */
        <>
          {/* Title block */}
          <div style={{ position: 'absolute', left: 96, top: 240, maxWidth: 1100 }}>
            <p style={{ fontSize: 18, color: '#ff4199', letterSpacing: 3, fontWeight: 700, margin: 0 }}>
              ONE LAST STEP
            </p>
            <h1 style={{ fontSize: 72, fontWeight: 'bold', margin: '20px 0 0', lineHeight: 1.05 }}>
              {t('onboarding_premium_title') || 'Start with Premium —'}
              <br />
              <span style={{
                background: 'linear-gradient(135deg, #ff4199 0%, #AD00FF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {t('onboarding_premium_title_2') || 'no ads, ever.'}
              </span>
            </h1>
            <p style={{ fontSize: 26, color: 'rgba(255,255,255,0.75)', marginTop: 36, lineHeight: 1.4, maxWidth: 980 }}>
              {t('onboarding_premium_subtitle') ||
                'Skip the ads. Get the highest-quality streams. Listen on all your devices.'}
            </p>
          </div>

          {/* Benefit pills */}
          <div data-testid="premium-benefit-wrap-bound" style={{ position: 'absolute', left: 96, top: 580, maxWidth: 1824 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }} data-tv-gap-axis="row" data-tv-gap="16" data-tv-gap-wrap="flow">
            {[
              { icon: '✨', label: t('premium_benefit_no_ads') || 'Ad-free listening' },
              { icon: '🎧', label: t('premium_benefit_quality') || 'HQ audio streams' },
              { icon: '📱', label: t('premium_benefit_multi') || 'All your devices' },
              { icon: '⏱', label: t('premium_benefit_unlimited') || 'Unlimited skips' },
            ].map((b) => (
              <div key={b.label} style={{
                padding: '14px 22px',
                borderRadius: 30,
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                fontSize: 20,
                display: 'flex',
                gap: 10,
                alignItems: 'center',
              }} data-tv-gap-axis="row" data-tv-gap="10">
                <span style={{ fontSize: 22 }}>{b.icon}</span>
                <span>{b.label}</span>
              </div>
            ))}
            </div>
          </div>

          {/* Trial line */}
          <p style={{
            position: 'absolute',
            left: 96,
            top: 720,
            fontSize: 18,
            color: 'rgba(255,255,255,0.45)',
          }}>
            {t('onboarding_premium_billing') || 'Cancel anytime · Manage on themegaradio.com/account'}
          </p>

          {/* CTA buttons */}
          <div style={{ position: 'absolute', left: 96, bottom: 96, display: 'flex', gap: 24 }} data-tv-gap-axis="row" data-tv-gap="24">
            <button
              data-testid="button-onboarding-upgrade"
              onClick={() => setCodeRevealed(true)}
              style={{
                padding: '24px 56px',
                borderRadius: 40,
                border: focusIndex === 0 ? '3px solid #fff' : '3px solid transparent',
                background: 'linear-gradient(135deg, #ff4199 0%, #AD00FF 100%)',
                color: '#fff',
                fontSize: 24,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: focusIndex === 0
                  ? '0 12px 40px rgba(255,65,153,0.7)'
                  : '0 8px 30px rgba(255,65,153,0.35)',
                transform: focusIndex === 0 ? 'scale(1.04)' : 'scale(1)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
             data-tv-gap-axis="row" data-tv-gap="12">
              <span style={{ fontSize: 26 }}>⭐</span>
              <span>{t('onboarding_premium_cta_primary') || 'Upgrade with QR code'}</span>
            </button>
            <button
              data-testid="button-onboarding-skip"
              onClick={completeOnboarding}
              style={{
                padding: '24px 48px',
                borderRadius: 40,
                border: focusIndex === 1 ? '3px solid #ff4199' : '3px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.85)',
                fontSize: 22,
                fontWeight: 500,
                cursor: 'pointer',
                transform: focusIndex === 1 ? 'scale(1.04)' : 'scale(1)',
                transition: 'all 0.2s',
              }}
            >
              {t('onboarding_premium_cta_skip') || 'Continue with free'}
            </button>
          </div>
        </>
      ) : (
        /* === REVEALED VIEW — QR + PIN === */
        <>
          {/* Headline */}
          <div style={{ position: 'absolute', left: 96, top: 240, maxWidth: 820 }}>
            <p style={{ fontSize: 18, color: '#ff4199', letterSpacing: 3, fontWeight: 700, margin: 0 }}>
              ALMOST THERE
            </p>
            <h1 style={{ fontSize: 58, fontWeight: 'bold', margin: '20px 0 0', lineHeight: 1.1 }}>
              {t('onboarding_premium_scan_title') || 'Scan with your phone'}
            </h1>
            <p style={{ fontSize: 24, color: 'rgba(255,255,255,0.7)', marginTop: 24, lineHeight: 1.5 }}>
              {t('onboarding_premium_scan_sub') ||
                'Complete payment on your phone in under 30 seconds. The TV will switch to Premium automatically when you finish.'}
            </p>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', marginTop: 40 }}>
              {t('onboarding_premium_back_hint') || 'Press BACK to skip and go to the app'}
            </p>
          </div>

          {/* QR card */}
          <div style={{
            position: 'absolute',
            right: 96,
            top: 220,
            width: 600,
            padding: 48,
            borderRadius: 24,
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            {status === 'activated' ? (
              <div style={{ padding: 24, textAlign: 'center' }} data-testid="onboarding-premium-activated">
                <div style={{
                  width: 96, height: 96, borderRadius: '50%',
                  backgroundColor: 'rgba(46,204,113,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto',
                }}>
                  <svg width={56} height={56} viewBox="0 0 24 24" fill="none">
                    <circle cx={12} cy={12} r={10} stroke="#2ecc71" strokeWidth={2} />
                    <path d="M7 12.5l3 3 7-7" stroke="#2ecc71" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2 style={{ fontSize: 30, fontWeight: 'bold', marginTop: 20 }}>
                  {t('premium_activated') || "You're Premium!"}
                </h2>
              </div>
            ) : (
              <>
                <div style={{
                  width: 260, height: 260,
                  background: '#fff',
                  borderRadius: 16, padding: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {status === 'pending' && activationUrl ? (
                    <QRCodeSVG value={activationUrl} size={232} level="M" includeMargin={false} fgColor="#0e0e0e" bgColor="#ffffff" />
                  ) : (
                    <div style={{
                      width: 60, height: 60,
                      border: '4px solid rgba(255,65,153,0.3)',
                      borderTopColor: '#ff4199',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }} />
                  )}
                </div>

                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 22, letterSpacing: 2 }}>
                  {t('or') || 'OR ENTER CODE'}
                </p>

                <div style={{ display: 'flex', gap: 10, marginTop: 14 }} data-testid="onboarding-premium-code" data-tv-gap-axis="row" data-tv-gap="10">
                  {(code || '······').split('').map((ch, i) => (
                    <div key={i} style={{
                      width: 48, height: 64, borderRadius: 10,
                      backgroundColor: 'rgba(255,65,153,0.12)',
                      border: '2px solid rgba(255,65,153,0.45)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 30, fontWeight: 'bold', color: '#fff',
                    }}>
                      {ch}
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: 15, marginTop: 22, color: 'rgba(255,255,255,0.7)' }}>
                  {activationUrl ? activationUrl.replace(/^https?:\/\//, '') : 'themegaradio.com/activate'}
                </p>
                {countdownLabel && (
                  <p style={{ fontSize: 13, marginTop: 6, color: 'rgba(255,255,255,0.4)' }}>
                    {(t('code_expires_in') || 'Code expires in') + ' ' + countdownLabel}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Persistent skip CTA at bottom — always highlighted (sole control here) */}
          <button
            data-testid="button-onboarding-skip-revealed"
            onClick={completeOnboarding}
            style={{
              position: 'absolute',
              left: 96, bottom: 96,
              padding: '18px 36px',
              borderRadius: 30,
              border: '3px solid #ff4199',
              background: 'rgba(255,65,153,0.14)',
              color: '#fff',
              fontSize: 20,
              fontWeight: 600,
              cursor: 'pointer',
              transform: 'scale(1.04)',
              boxShadow: '0 10px 34px rgba(255,65,153,0.45)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
           data-tv-gap-axis="row" data-tv-gap="10">
            {t('onboarding_premium_maybe_later') || 'Maybe later — Continue free'}
          </button>
        </>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
};
