// Continue Listening section — shows last 6 recently played stations on Discover top
// Data source: localStorage `recently_played_v1` (populated by TV audio player on play)

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { assetPath } from '@/lib/assetPath';
import { nativeBridge, type BridgeStation } from '@/lib/nativeBridge';

export interface RecentStation {
  _id: string;
  name: string;
  favicon?: string;
  country?: string;
  tags?: string[];
  streamUrl?: string;
  playedAt: number;
}

const STORAGE_KEY = 'recently_played_v1';
const MAX_ITEMS = 12;

const toBridge = (list: RecentStation[]): BridgeStation[] => list.slice(0, 10).map(s => ({
  id:          s._id,
  name:        s.name,
  genre:       s.tags?.[0],
  streamUrl:   s.streamUrl ?? '',
  iconUrl:     s.favicon ?? '',
  description: s.country,
}));

export const recentlyPlayedStore = {
  add(station: Omit<RecentStation, 'playedAt'>) {
    try {
      const list: RecentStation[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const filtered = list.filter(s => s._id !== station._id);
      filtered.unshift({ ...station, playedAt: Date.now() });
      const next = filtered.slice(0, MAX_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('mr:recently-played-changed'));
      // Push to native shells (Apple TV Top Shelf, Android TV Recommendations).
      nativeBridge.postContinueListening(toBridge(next));
    } catch {}
  },
  getAll(): RecentStation[] {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('mr:recently-played-changed'));
    nativeBridge.postContinueListening([]);
  },
  /** Called once at app boot so the home-screen rails are populated even if
   *  the user re-opens the app without playing anything new. */
  syncToNative() {
    try { nativeBridge.postContinueListening(toBridge(this.getAll())); } catch {}
  },
};

export function ContinueListeningSection() {
  const [items, setItems] = useState<RecentStation[]>([]);

  useEffect(() => {
    const refresh = () => setItems(recentlyPlayedStore.getAll().slice(0, 6));
    refresh();
    window.addEventListener('mr:recently-played-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('mr:recently-played-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section
      data-testid="continue-listening-section"
      style={{ marginTop: 32, marginLeft: 150 }}
    >
      <div style={{
        fontFamily: "'Ubuntu', sans-serif",
        fontSize: 28, fontWeight: 700, color: '#fff',
        marginBottom: 20,
      }}>Continue Listening</div>

      <div style={{ display: 'flex', gap: 18, overflowX: 'auto', paddingBottom: 12 }} data-tv-gap-axis="row" data-tv-gap="18">
        {items.map(st => (
          <Link
            key={st._id}
            href={`/radio-playing?id=${st._id}`}
            data-testid={`continue-card-${st._id}`}
            style={{ textDecoration: 'none', flexShrink: 0 }}
          >
            <div
              className="mr-focus-tile"
              style={{
                width: 200, height: 200, borderRadius: 18,
                background: '#1F1F1F', padding: 16,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                cursor: 'pointer',
              }}
            >
              <img
                src={st.favicon || assetPath('images/fallback-station.png')}
                alt={st.name}
                style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover' }}
                onError={e => { (e.target as HTMLImageElement).src = assetPath('images/fallback-station.png'); }}
              />
              <div>
                <div style={{
                  color: '#fff', fontFamily: "'Ubuntu', sans-serif",
                  fontSize: 18, fontWeight: 700,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{st.name}</div>
                {st.tags?.[0] && (
                  <div style={{
                    color: 'rgba(255,255,255,0.55)', fontFamily: "'Ubuntu', sans-serif",
                    fontSize: 14, marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{st.tags[0]}</div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
