/**
 * UpdateBanner — soft (kapatılabilir) + forced (kapatılamaz) update prompt.
 * 1920×1080 TV canvas üzerinde tasarlandı; D-pad ile odaklanabilir.
 */
import { useEffect, useRef, useState } from 'react';
import { useTvVersionCheck, dismissSoftUpdate } from '../hooks/useTvVersionCheck';

export function UpdateBanner() {
  const state = useTvVersionCheck();
  const primaryBtnRef = useRef<HTMLButtonElement>(null);
  // Soft banner D-pad focus index. 0 = "Mağazaya Git", 1 = "Sonra"
  // (capture-phase keydown so it works even when /focusRouter handles
  // page-level keys). Reset when banner appears/disappears.
  const [softFocus, setSoftFocus] = useState<0 | 1>(0);

  // Force-update modal açılınca primary butona odaklan
  useEffect(() => {
    if (state.kind === 'forced' && primaryBtnRef.current) {
      primaryBtnRef.current.focus();
    }
    if (state.kind === 'soft') setSoftFocus(state.storeUrl ? 0 : 1);
  }, [state]);

  // Soft banner D-pad handler — captures BEFORE the page-level FocusRouter
  // so LEFT/RIGHT/ENTER work even when the user is on Discover with the
  // spatial navigation active. Same pattern as PaywallContext does.
  useEffect(() => {
    if (state.kind !== 'soft') return;
    const onKey = (e: KeyboardEvent) => {
      const kc = e.keyCode || 0;
      const key = e.key;
      // Left/Right toggle between the two buttons.
      if (kc === 37 || key === 'ArrowLeft')  { e.preventDefault(); e.stopImmediatePropagation(); setSoftFocus(state.storeUrl ? 0 : 1); return; }
      if (kc === 39 || key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); setSoftFocus(1); return; }
      // OK / Enter — trigger the focused button.
      if (kc === 13 || key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (softFocus === 0 && state.storeUrl) {
          if (state.storeUrl) window.open(state.storeUrl, '_blank');
        } else {
          dismissSoftUpdate();
          window.location.reload();
        }
        return;
      }
      // Samsung BACK / WebOS BACK / Escape → treat as "Sonra".
      if (kc === 10009 || kc === 461 || kc === 27 || key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        dismissSoftUpdate();
        window.location.reload();
      }
    };
    // capture: true so we run before page-level listeners.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [state, softFocus]);

  if (state.kind === 'none') return null;

  // Forced = full-screen blocking modal
  if (state.kind === 'forced') {
    return (
      <div
        data-testid="update-banner-forced"
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(14, 14, 14, 0.92)',
          backdropFilter: 'blur(24px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{
          width: 720, padding: '48px 56px', borderRadius: 28,
          background: 'linear-gradient(160deg, rgba(40,20,32,0.95) 0%, rgba(20,12,18,0.95) 100%)',
          border: '1px solid rgba(235, 79, 159, 0.32)',
          boxShadow: '0 24px 64px rgba(235, 79, 159, 0.25)',
          color: '#fff',
        }}>
          <div style={{
            display: 'inline-block', padding: '6px 14px', borderRadius: 999,
            background: 'rgba(235, 79, 159, 0.18)', color: '#EB4F9F',
            fontSize: 14, fontWeight: 600, letterSpacing: 0.5, marginBottom: 20,
          }}>
            ZORUNLU GÜNCELLEME
          </div>
          <h2 style={{ fontSize: 36, fontWeight: 700, margin: '0 0 12px', lineHeight: 1.2 }}>
            Devam etmek için MegaRadio'yu güncelleyin
          </h2>
          <p style={{ fontSize: 18, lineHeight: 1.5, color: 'rgba(255,255,255,0.78)', margin: '0 0 28px' }}>
            Yeni sürüm <strong style={{ color: '#fff' }}>{state.latest}</strong> ile önemli iyileştirmeler ve güvenlik düzeltmeleri geldi. Lütfen mağazadan güncellemeyi yükleyin.
          </p>
          {state.notes && (
            <div style={{
              padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.04)',
              fontSize: 15, color: 'rgba(255,255,255,0.72)', margin: '0 0 24px',
            }}>
              {state.notes}
            </div>
          )}
          {!state.storeUrl && (
            <p style={{ fontSize: 18, lineHeight: 1.5 }}>
              TV’nizin uygulama mağazasını açıp MegaRadio’yu güncelleyin.
            </p>
          )}
          {state.storeUrl && <button
            ref={primaryBtnRef}
            data-testid="update-banner-forced-store-btn"
            onClick={() => state.storeUrl && window.open(state.storeUrl, '_blank')}
            style={{
              padding: '16px 32px', borderRadius: 999, border: 'none',
              background: '#EB4F9F', color: '#fff',
              fontSize: 17, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(235, 79, 159, 0.4)',
              outline: 'none',
            }}
          >
            Mağazaya Git ve Güncelle
          </button>}
        </div>
      </div>
    );
  }

  // Soft = bottom-right toast-style banner with dismiss
  return (
    <div
      data-testid="update-banner-soft"
      style={{
        position: 'fixed', right: 32, bottom: 32, zIndex: 9998,
        width: 480, padding: '24px 28px', borderRadius: 20,
        background: 'rgba(20, 14, 18, 0.92)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(235, 79, 159, 0.28)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        color: '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }} data-tv-gap-axis="row" data-tv-gap="10">
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: '#EB4F9F',
          boxShadow: '0 0 12px rgba(235, 79, 159, 0.8)',
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#EB4F9F', letterSpacing: 0.4 }}>
          YENİ SÜRÜM MEVCUT
        </span>
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>
        MegaRadio {state.latest} yayında
      </h3>
      <p style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.7)', margin: '0 0 16px' }}>
        {state.notes || 'Mağazadan güncelleyerek yeni özelliklerden faydalanın.'}
      </p>
      {!state.storeUrl && (
        <p style={{ fontSize: 14, lineHeight: 1.5, margin: '0 0 16px' }}>
          TV’nizin uygulama mağazasını açıp MegaRadio’yu güncelleyebilirsiniz.
        </p>
      )}
      <div style={{ display: 'flex', gap: 10 }} data-tv-gap-axis="row" data-tv-gap="10">
        {state.storeUrl && <button
          data-testid="update-banner-soft-store-btn"
          onClick={() => state.storeUrl && window.open(state.storeUrl, '_blank')}
          style={{
            flex: 1, padding: '10px 16px', borderRadius: 999,
            border: softFocus === 0 ? '3px solid #fff' : 'none',
            background: '#EB4F9F', color: '#fff',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', outline: 'none',
            transform: softFocus === 0 ? 'scale(1.05)' : 'scale(1)',
            boxShadow: softFocus === 0 ? '0 0 24px rgba(235,79,159,0.7)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          Mağazaya Git
        </button>}
        <button
          data-testid="update-banner-soft-dismiss-btn"
          onClick={() => { dismissSoftUpdate(); window.location.reload(); }}
          style={{
            padding: '10px 16px', borderRadius: 999,
            border: softFocus === 1
              ? '3px solid #EB4F9F'
              : '1px solid rgba(255,255,255,0.16)',
            background: softFocus === 1 ? 'rgba(235,79,159,0.18)' : 'transparent',
            color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', outline: 'none',
            transform: softFocus === 1 ? 'scale(1.05)' : 'scale(1)',
            transition: 'all 0.15s',
          }}
        >
          Sonra
        </button>
      </div>
    </div>
  );
}
