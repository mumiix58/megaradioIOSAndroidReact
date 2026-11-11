import type { Station } from '../types';
import { getStationLogoUrl } from './stationLogoHelper';

export function createCastMedia(station: Station, streamUrl?: string | null, track?: { title?: string; artist?: string } | null) {
  const url = streamUrl || station.urlResolved || station.url_resolved || station.url;
  if (!url || !/^https?:\/\//i.test(url)) throw new Error('cast_invalid_stream');
  const path = url.split(/[?#]/)[0].toLowerCase();
  const codec = (station.codec || '').toUpperCase();
  const contentType = path.endsWith('.m3u8') ? 'application/x-mpegURL'
    : path.endsWith('.aac') || codec.startsWith('AAC') ? 'audio/aac'
    : path.endsWith('.ogg') || codec === 'VORBIS' || codec === 'OPUS' ? 'audio/ogg'
    : path.endsWith('.flac') || codec === 'FLAC' ? 'audio/flac' : 'audio/mpeg';
  const logo = getStationLogoUrl(station);
  return { autoplay: true, mediaInfo: {
    contentId: url, contentUrl: url, contentType, streamType: 'live' as const,
    customData: { stationId: station._id, stationName: station.name },
    metadata: { type: 'musicTrack' as const, title: track?.title || station.name,
      artist: track?.artist || station.name, albumTitle: 'MegaRadio',
      images: logo ? [{ url: logo }] : [] },
  } };
}

/** Do not interrupt the phone if the receiver rejects the load. */
export async function transferCastMedia(client: { loadMedia: (request: ReturnType<typeof createCastMedia>) => Promise<unknown> }, request: ReturnType<typeof createCastMedia>, pauseLocal?: () => void | Promise<void>, isCurrent: () => boolean = () => true) {
  await client.loadMedia(request);
  if (isCurrent()) await pauseLocal?.();
}
