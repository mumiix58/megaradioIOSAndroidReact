// MegaRadio TV — Premium Paywall (matches Frame 570/571 design references 1:1)
// Premium variant : photo of Asian woman on the right, content/checks overlay left
// Remove Ads      : full-width yellow photo top half, content below

import { useState, useEffect } from 'react';
import { assetPath } from '@/lib/assetPath';
import { LegalModal, LegalPage } from '@/components/LegalModal';

export const IAP_PRODUCTS = {
  premium_monthly: 'megaradio_premium_monthly1',
  premium_yearly: 'megaradio_premium_yearly',
  premium_lifetime: 'megaradio_premium_lifetime',
  remove_ads_yearly: 'megaradio_remove_ads_yearly1',
} as const;

export type PaywallVariant = 'premium' | 'remove_ads';

interface PaywallProps {
  open: boolean;
  variant?: PaywallVariant;
  onClose: () => void;
  onPurchase?: (productId: string) => void;
}

const FONT = "'Ubuntu', Helvetica, Arial, sans-serif";

export function PremiumPaywall({ open, variant = 'premium', onClose, onPurchase }: PaywallProps) {
  const [selected, setSelected] = useState<'yearly' | 'lifetime' | 'monthly'>('yearly');
  const [focusIdx, setFocusIdx] = useState(0);
  const [legalPage, setLegalPage] = useState<LegalPage | null>(null);

  useEffect(() => { if (open) { setFocusIdx(0); setSelected('yearly'); setLegalPage(null); } }, [open]);

  useEffect(() => {
    if (!open) return;
    // Swallow key events while a legal modal is open (it has its own handler).
    if (legalPage) return;
    const handler = (e: KeyboardEvent) => {
      const tiers: Array<'yearly' | 'lifetime' | 'monthly'> = ['yearly', 'lifetime', 'monthly'];
      const tierCount = variant === 'premium' ? 3 : 1;
      const ctaIdx = tierCount;
      const closeIdx = tierCount + 1;
      const max = closeIdx;
      // While the paywall is open, stop ALL other keydown listeners
      // (Settings/FocusRouter etc.) from processing the same event.
      e.stopImmediatePropagation();
      e.stopPropagation();

      if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx(i => Math.min(i + 1, max)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Backspace' || e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (focusIdx < tierCount) {
          if (variant === 'premium') setSelected(tiers[focusIdx]);
        } else if (focusIdx === ctaIdx) {
          if (variant === 'remove_ads') onPurchase?.(IAP_PRODUCTS.remove_ads_yearly);
          else {
            const map = {
              yearly: IAP_PRODUCTS.premium_yearly,
              lifetime: IAP_PRODUCTS.premium_lifetime,
              monthly: IAP_PRODUCTS.premium_monthly,
            };
            onPurchase?.(map[selected]);
          }
        } else if (focusIdx === closeIdx) onClose();
      }
    };
    // Use capture phase so we run before any other keydown listener
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [open, focusIdx, selected, variant, onClose, onPurchase, legalPage]);

  if (!open) return null;
  const isRemoveAds = variant === 'remove_ads';
  const ctaIdx = isRemoveAds ? 1 : 3;
  const closeIdx = isRemoveAds ? 2 : 4;

  return (
    <div
      data-testid="paywall-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        backgroundColor: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(16px) saturate(120%)',
        WebkitBackdropFilter: 'blur(16px) saturate(120%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'mr-paywall-fade 0.25s ease-out',
      }}
    >
      <div
        data-testid={`paywall-${variant}`}
        onClick={e => e.stopPropagation()}
        style={{
          width: 620,
          maxHeight: '94vh',
          backgroundColor: '#0E0E0E',
          borderRadius: 32,
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 30px 100px rgba(0,0,0,0.9), 0 0 80px rgba(255,65,153,0.15)',
        }}
      >
        {isRemoveAds
          ? <RemoveAdsBody focusIdx={focusIdx} closeIdx={closeIdx} ctaIdx={ctaIdx} onClose={onClose} onPurchase={onPurchase} onOpenLegal={setLegalPage} />
          : <PremiumBody focusIdx={focusIdx} ctaIdx={ctaIdx} selected={selected} setSelected={setSelected} setFocusIdx={setFocusIdx} onPurchase={onPurchase} onOpenLegal={setLegalPage} />}
      </div>
      <LegalModal open={!!legalPage} page={legalPage || 'terms'} onClose={() => setLegalPage(null)} />
    </div>
  );
}

/* ─────────────────── PREMIUM VARIANT ─────────────────── */
/* Layout: photo of woman occupies the RIGHT half of the card,
   content (logo + 6 checks + 3 tiers) sits on the LEFT and overlaps
   the photo. A horizontal gradient fades the photo into the dark
   background where the text needs to be readable. */

function PremiumBody({
  focusIdx, ctaIdx, selected, setSelected, setFocusIdx, onPurchase, onOpenLegal,
}: {
  focusIdx: number; ctaIdx: number; selected: 'yearly' | 'lifetime' | 'monthly';
  setSelected: (v: 'yearly' | 'lifetime' | 'monthly') => void;
  setFocusIdx: (n: number) => void;
  onPurchase?: (productId: string) => void;
  onOpenLegal: (p: LegalPage) => void;
}) {
  return (
    <div style={{ position: 'relative' }}>
      {/* Hero photo — top-right portion, fades to black on the left and bottom */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '70%', height: 360,
        backgroundImage: `url(${assetPath('images/paywall-premium-photo.png')})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        zIndex: 1,
      }} />
      {/* Gradient: fade to dark on left + bottom so text is readable */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 360,
        background: `
          linear-gradient(90deg, #0E0E0E 0%, #0E0E0E 30%, rgba(14,14,14,0.4) 55%, rgba(14,14,14,0) 100%),
          linear-gradient(180deg, rgba(14,14,14,0) 60%, rgba(14,14,14,0.85) 92%, #0E0E0E 100%)
        `,
        zIndex: 2, pointerEvents: 'none',
      }} />

      {/* Content layer */}
      <div style={{ position: 'relative', zIndex: 3, padding: '32px 32px 24px' }}>
        {/* Logo + brand */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }} data-tv-gap-axis="row" data-tv-gap="16">
          <BrandLogoTile />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>MegaRadio</div>
            <div style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, color: '#FFC700', lineHeight: 1.1 }}>Premium</div>
          </div>
        </div>

        {/* Benefits list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 22 }} data-tv-gap-axis="column" data-tv-gap="13">
          {[
            'Remove Ads',
            'Spotify And Youtube Music Support',
            'HD Stream',
            'Car Mode',
            'Unlimited Stream Record',
            'And more',
          ].map(item => (
            <div key={item} style={{ display: 'flex', gap: 14, alignItems: 'center' }} data-tv-gap-axis="row" data-tv-gap="14">
              <span style={{
                color: '#fff', fontSize: 20, width: 24, textAlign: 'center', fontWeight: 300,
                textShadow: '0 1px 4px rgba(0,0,0,0.9)',
              }}>✓</span>
              <span style={{
                color: '#fff', fontFamily: FONT, fontSize: 19, fontWeight: 600,
                textShadow: '0 1px 8px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.7)',
              }}>{item}</span>
            </div>
          ))}
        </div>

        {/* Tier rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }} data-tv-gap-axis="column" data-tv-gap="10">
          <TierRow selected={selected === 'yearly'} focused={focusIdx === 0} label="€ 29.99/yearly" sub="cancel anytime" onClick={() => { setSelected('yearly'); setFocusIdx(0); }} />
          <TierRow selected={selected === 'lifetime'} focused={focusIdx === 1} label="€ 59.99/lifetime" sub="cancel anytime" onClick={() => { setSelected('lifetime'); setFocusIdx(1); }} />
          <TierRow selected={selected === 'monthly'} focused={focusIdx === 2} label="€ 3.99/montly" sub="cancel anytime" onClick={() => { setSelected('monthly'); setFocusIdx(2); }} />
        </div>

        {/* CTA */}
        <CtaButton
          label="Subscribe Now"
          focused={focusIdx === ctaIdx}
          onClick={() => {
            const map = {
              yearly: IAP_PRODUCTS.premium_yearly,
              lifetime: IAP_PRODUCTS.premium_lifetime,
              monthly: IAP_PRODUCTS.premium_monthly,
            };
            onPurchase?.(map[selected]);
          }}
          testId="paywall-subscribe-cta"
        />
        <Footer onPurchase={onPurchase} onOpenLegal={onOpenLegal} />
      </div>
    </div>
  );
}

/* ─────────────────── REMOVE ADS VARIANT ─────────────────── */
/* Layout: full-width yellow photo takes the top half (~360px),
   gradient fade to dark, then logo + title + 1 tier + CTA below. */

function RemoveAdsBody({
  focusIdx, closeIdx, ctaIdx, onClose, onPurchase, onOpenLegal,
}: {
  focusIdx: number; closeIdx: number; ctaIdx: number;
  onClose: () => void;
  onPurchase?: (productId: string) => void;
  onOpenLegal: (p: LegalPage) => void;
}) {
  return (
    <>
      {/* Hero — full-width photo */}
      <div style={{
        position: 'relative', width: '100%', height: 360, flexShrink: 0,
        backgroundImage: `url(${assetPath('images/paywall-removeads-photo.png')})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 25%',
      }}>
        {/* Bottom fade so the photo blends into the dark body */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(14,14,14,0) 55%, rgba(14,14,14,0.85) 92%, #0E0E0E 100%)',
          pointerEvents: 'none',
        }} />
        <button
          onClick={onClose}
          data-testid="paywall-close-btn"
          style={{
            position: 'absolute', top: 22, right: 22,
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(255,255,255,0.85)', border: 'none',
            color: '#0E0E0E', fontSize: 22, fontWeight: 700, cursor: 'pointer',
            outline: focusIdx === closeIdx ? '3px solid #fff' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >✕</button>
      </div>

      {/* Body */}
      <div style={{ padding: '4px 32px 0' }}>
        {/* Logo + brand */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 22 }} data-tv-gap-axis="row" data-tv-gap="16">
          <BrandLogoTile />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>MegaRadio</div>
            <div style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, color: '#FFC700', lineHeight: 1.1 }}>Remove Ads</div>
          </div>
        </div>

        <div style={{ marginBottom: 26 }}>
          <div style={{ fontFamily: FONT, fontSize: 32, fontWeight: 700, color: '#fff', lineHeight: 1.15, marginBottom: 6 }}>
            Tired of seeing ads?
          </div>
          <div style={{ fontFamily: FONT, fontSize: 19, fontWeight: 400, color: 'rgba(255,255,255,0.65)' }}>
            Now remove all annoying ads
          </div>
        </div>

        <TierRow selected focused={focusIdx === 0} label="€ 29.99/yearly" sub="cancel anytime" onClick={() => {}} />
      </div>

      {/* CTA + footer */}
      <div style={{ padding: '20px 32px 24px' }}>
        <CtaButton
          label="Remove Ads"
          focused={focusIdx === ctaIdx}
          onClick={() => onPurchase?.(IAP_PRODUCTS.remove_ads_yearly)}
          testId="paywall-remove-ads-cta"
        />
        <Footer onPurchase={onPurchase} onOpenLegal={onOpenLegal} />
      </div>
    </>
  );
}

/* ─────────────────── SHARED ATOMS ─────────────────── */

function BrandLogoTile() {
  return (
    <div style={{
      width: 76, height: 76, borderRadius: 18,
      background: 'linear-gradient(135deg, #FF4199 0%, #E91E63 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)', flexShrink: 0,
    }}>
      <img src={assetPath('images/path-8.svg')} alt="" style={{ width: 44, height: 44, filter: 'brightness(0) invert(1)' }} />
    </div>
  );
}

function TierRow({ selected, focused, label, sub, onClick }: {
  selected: boolean; focused: boolean; label: string; sub: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', height: 60, borderRadius: 30,
        border: focused ? '2px solid #FF4199' : '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(40,40,40,0.92)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
        cursor: 'pointer',
        boxShadow: focused ? '0 0 16px rgba(255,65,153,0.5)' : 'none',
        transition: 'border 0.15s, box-shadow 0.15s',
      }}
     data-tv-gap-axis="row" data-tv-gap="16">
      <span style={{
        width: 24, height: 24, borderRadius: '50%',
        border: '2.5px solid #FF4199',
        background: 'transparent',
        position: 'relative',
        flexShrink: 0,
      }}>
        {selected && (
          <span style={{
            position: 'absolute', inset: 4,
            borderRadius: '50%', background: '#FF4199',
          }} />
        )}
      </span>
      <span style={{ color: '#fff', fontFamily: FONT, fontSize: 20, fontWeight: 700 }}>{label},</span>
      <span style={{ color: 'rgba(255,255,255,0.55)', fontFamily: FONT, fontSize: 18, fontWeight: 400 }}>{sub}</span>
    </button>
  );
}

function CtaButton({ label, focused, onClick, testId }: {
  label: string; focused: boolean; onClick: () => void; testId: string;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      style={{
        width: '100%', height: 70, borderRadius: 35, border: 'none',
        background: '#FF4199', color: '#fff',
        fontFamily: FONT, fontSize: 22, fontWeight: 700,
        cursor: 'pointer',
        boxShadow: focused ? '0 0 30px rgba(255,65,153,0.9)' : '0 8px 22px rgba(255,65,153,0.4)',
        outline: focused ? '3px solid #fff' : 'none',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
    >{label}</button>
  );
}

function Footer({ onPurchase, onOpenLegal }: {
  onPurchase?: (productId: string) => void;
  onOpenLegal: (p: LegalPage) => void;
}) {
  return (
    <div style={{
      marginTop: 18, display: 'flex', justifyContent: 'space-between',
      color: 'rgba(255,255,255,0.45)', fontFamily: FONT, fontSize: 15,
    }}>
      <button
        onClick={() => onPurchase?.('restore')}
        data-testid="paywall-restore"
        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 15 }}
      >Already paid?</button>
      <button
        onClick={() => onOpenLegal('terms')}
        data-testid="paywall-terms"
        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 15 }}
      >Terms &amp; conditions</button>
    </div>
  );
}
