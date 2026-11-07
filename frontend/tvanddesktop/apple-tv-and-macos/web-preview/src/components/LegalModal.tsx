// Legal / Terms / Privacy modal — fetches content from /api/app/pages (same as mobile).
// Opens as a full-screen overlay on top of any other UI (including the paywall).

import { useEffect, useState } from 'react';
import { megaRadioApi, AppPage } from '@/services/megaRadioApi';

export type LegalPage = 'terms' | 'privacy' | 'about' | 'contact';

interface Props {
  open: boolean;
  page: LegalPage;
  onClose: () => void;
}

const FONT = "'Ubuntu', Helvetica, Arial, sans-serif";

export function LegalModal({ open, page, onClose }: Props) {
  const [data, setData] = useState<AppPage | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setData(null);
    megaRadioApi.getAppPages().then(pages => {
      setData(pages[page] || null);
      setLoading(false);
    });
  }, [open, page]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-testid="legal-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 11000,
        backgroundColor: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(20px) saturate(130%)',
        WebkitBackdropFilter: 'blur(20px) saturate(130%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'mr-paywall-fade 0.25s ease-out',
      }}
    >
      <div
        data-testid={`legal-modal-${page}`}
        onClick={e => e.stopPropagation()}
        style={{
          width: 900, maxHeight: '85vh',
          background: '#0E0E0E',
          borderRadius: 24,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 30px 100px rgba(0,0,0,0.9)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{
          padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }} data-tv-gap-axis="row" data-tv-gap="16">
          <div style={{
            fontFamily: FONT, fontSize: 26, fontWeight: 700, color: '#fff',
          }}>{data?.title || (page === 'terms' ? 'Terms and Conditions' : page === 'privacy' ? 'Privacy Policy' : page === 'about' ? 'About' : 'Contact')}</div>
          <button
            onClick={onClose}
            data-testid="legal-modal-close"
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', border: 'none',
              color: '#fff', fontSize: 18, cursor: 'pointer',
            }}
          >✕</button>
        </div>
        <div style={{
          padding: '24px 32px', overflowY: 'auto', flex: 1,
          color: 'rgba(255,255,255,0.85)',
          fontFamily: FONT, fontSize: 18, lineHeight: 1.6,
        }}>
          {loading && <div style={{ color: 'rgba(255,255,255,0.5)' }}>Loading…</div>}
          {!loading && !data && (
            <div style={{ color: 'rgba(255,255,255,0.5)' }}>Content unavailable. Please try again later.</div>
          )}
          {data && (
            <div style={{ whiteSpace: 'pre-wrap' }}>{data.content}</div>
          )}
        </div>
      </div>
    </div>
  );
}
