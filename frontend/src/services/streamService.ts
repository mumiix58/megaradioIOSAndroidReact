import axios from 'axios';
import { Buffer } from 'buffer';
import { STREAM_PROXY_URL } from '../constants/api';
const stream = axios.create({ baseURL: STREAM_PROXY_URL, timeout: 15000, withCredentials: false });
export const streamService = {
  async resolve(url: string) {
    const response = await stream.get('/api/stream/resolve', { params: { url } });
    if (!Array.isArray(response.data?.candidates)) throw new Error('Invalid stream resolver response');
    return response.data as { candidates: string[]; originalUrl: string; playlistType: string };
  },
  proxyUrl(url: string) {
    const encoded = Buffer.from(url, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${STREAM_PROXY_URL}/api/stream/${encoded}`;
  },
};
