import api from './api';
import { useAuthStore } from '../store/authStore';
async function send(token: string, body: unknown): Promise<boolean> {
  if (useAuthStore.getState().token !== token) return false;
  try {
    const response = await api.post('/api/cast/send', body);
    return response.data?.success !== false;
  } catch { return false; }
}
export const castService = {
  castStation(token: string, station: any): Promise<boolean> {
    return send(token, { type: 'cast:play', station: {
      _id: station._id || station.id, name: station.name, url: station.url,
      url_resolved: station.url_resolved || station.urlResolved || station.url,
      favicon: station.favicon || station.logo, country: station.country, language: station.language,
      tags: Array.isArray(station.tags) ? station.tags.join(',') : station.tags,
    } });
  },
  sendPause: (token: string) => send(token, { type: 'cast:pause' }),
  sendResume: (token: string) => send(token, { type: 'cast:resume' }),
  sendStop: (token: string) => send(token, { type: 'cast:stop' }),
  async getNowPlaying(token: string): Promise<any | null> {
    if (useAuthStore.getState().token !== token) return null;
    try { return (await api.get('/api/cast/now-playing')).data; } catch { return null; }
  },
};
export default castService;
