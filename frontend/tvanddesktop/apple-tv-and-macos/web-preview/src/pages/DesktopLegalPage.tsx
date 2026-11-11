import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { desktopLegalDocuments } from '@/lib/desktopLegalDocuments';

export function DesktopLegalPage({ document }: { document: 'privacy' | 'terms' }) {
  const [, navigate] = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);
  const data = desktopLegalDocuments[document];
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
    contentRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); navigate('/settings'); }
    };
    window.addEventListener('keydown', keydown, true);
    return () => window.removeEventListener('keydown', keydown, true);
  }, [document, navigate]);
  return <section data-testid={`desktop-legal-${document}`} aria-labelledby="legal-title" style={{ position: 'absolute', inset: 0, zIndex: 12000, background: '#0e0e0e', color: '#fff', padding: '60px 100px', display: 'flex', flexDirection: 'column', fontFamily: "'Ubuntu', sans-serif" }}>
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 30 }}>
      <h1 id="legal-title" style={{ fontSize: 40, margin: 0 }}>{data.title}</h1>
      <button data-testid="desktop-legal-back" onClick={() => navigate('/settings')} style={buttonStyle}>Back to Settings</button>
    </header>
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 24, margin: '28px 0', fontSize: 22 }}>
      <a data-testid="desktop-legal-online" href={data.url} target="_blank" rel="noreferrer" style={{ color: '#ff74b3', textDecoration: 'underline' }}>Read the current published {document === 'privacy' ? 'Privacy Policy' : 'Terms of Use (EULA)'}</a>
      <span style={{ color: '#a7a7a7' }}>Saved copy · checked 4 October 2026 · available offline</span>
    </div>
    <div ref={contentRef} data-testid="desktop-legal-content" tabIndex={0} role="region" aria-label={data.title} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', whiteSpace: 'pre-wrap', fontSize: 24, lineHeight: 1.6, padding: '30px 44px', border: '1px solid #444', borderRadius: 16, background: '#171717' }}>{data.content}</div>
    <nav aria-label="Legal documents" style={{ display: 'flex', gap: 32, marginTop: 24 }}>
      <button style={buttonStyle} onClick={() => navigate('/privacy')}>Privacy Policy</button>
      <button style={buttonStyle} onClick={() => navigate('/terms')}>Terms of Use (EULA)</button>
    </nav>
  </section>;
}
const buttonStyle = { background: '#333', border: '1px solid #777', borderRadius: 12, color: '#fff', padding: '16px 24px', fontSize: 22, cursor: 'pointer' };
