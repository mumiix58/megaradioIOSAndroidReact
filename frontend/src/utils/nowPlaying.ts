import type { NowPlayingMetadata } from '../types';

const entities: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (original, entity: string) => {
    if (entity[0] !== '#') return entities[entity.toLowerCase()] || original;
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : original;
  });
}
/** Reject server documents/diagnostics, rather than turning their error text into a song. */
function trackField(value: unknown): string | null {
  if (typeof value !== 'string') return '';
  let text = value.trim();
  if (text.length > 1024) return null;
  for (let pass = 0; pass < 2; pass++) text = decodeEntities(text);
  // Decode wrappers after entities as well; text=&quot;Artist - Song&quot; is common.
  if(/\b(?:AdCreativeId|adw_ad|adId|insertionType)\s*[:=]/i.test(text))return null;
  const icy=/^StreamTitle\s*=\s*(["'])([\s\S]*?)\1(?=\s*(?:;|$))/i.exec(text);
  text=icy?icy[2]:text.replace(/^text\s*=\s*(["'])([\s\S]*?)\1;?$/i,'$2');
  text = text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length > 300 || /<\/?[a-z!][^>]*>|<!doctype|<\?xml/i.test(text)
    || /^(?:https?:\/\/|HTTP\/\d|\{\s*["']|\[\s*\{)/i.test(text)
    || /\b(?:StreamTitle|StreamUrl|icy-name|icy-description|AdCreativeId|adw_ad|adId|insertionType)\s*[:=]/i.test(text)
    || /^adswizz\s*[:=]/i.test(text)
    || /^(?:(?:stream|radio|station|source|server|service|autodj)\s+(?:is\s+)?(?:offline|unavailable|not available|not found|not connected)|there is no sound on the radio|no (?:stream|metadata|song (?:info|information))\b|(?:error|exception)\s*[:=]|(?:502 |503 |504 )?(?:bad gateway|service unavailable|gateway timeout)\b)/i.test(text)) return null;
  return /^(?:unknown(?: artist| title)?|no name|n\/a|null|undefined)$/i.test(text) ? '' : text;
}

export type MetadataStatus = 'idle' | 'loading' | 'available' | 'unavailable' | 'error';
export const METADATA_HOLD_MS = 120000;
const generic = /^(?:live(?: radio| stream)?|unknown(?: artist| title)?|n\/a)$/i;

function metadataRecord(response: unknown): Record<string, any> | null {
  if (!response || typeof response !== 'object') return null;
  const root=response as Record<string,any>;
  const nested=root.metadata && typeof root.metadata==='object'?root.metadata:root;
  if(Array.isArray(nested))return nested.find(value=>value&&typeof value==='object'&&(value.title||value.song||value.artist))||null;
  return nested;
}
export function isMetadataAdvertisement(response: unknown): boolean {
  const data=metadataRecord(response);
  return !!data && ['AdCreativeId','adw_ad','AdTitle','adId','insertionType'].some(key=>!!data[key]);
}

/** Salvage each clean field independently; one malformed sibling must not erase a song. */
export function normalizeNowPlaying(response: unknown, stationName: string): NowPlayingMetadata | null {
  const metadata=metadataRecord(response);
  if(!metadata||isMetadataAdvertisement(metadata))return null;
  const first=(...values:unknown[])=>values.map(trackField).find(value=>!!value)||'';
  const song=first(metadata.song);
  const title=first(metadata.title,metadata.StreamTitle,metadata.streamTitle,song,metadata.commonMetadata?.title);
  const artist=first(metadata.artist,metadata.commonMetadata?.artist);
  if(!title&&!artist)return null;
  const timestamp=Number(metadata.timestamp);
  return {title,artist,song,station:stationName,album:first(metadata.album,metadata.albumTitle,metadata.genre),
    timestamp:Number.isFinite(timestamp)&&timestamp>0&&timestamp<=Date.now()+5000?timestamp:Date.now()};
}

/** A station/country fallback is not a track. A real artist disambiguates titles such as "Live". */
export function currentTrackText(metadata: NowPlayingMetadata | null | undefined, stationName: string, stationCountry = ''): string | null {
  const safe=normalizeNowPlaying(metadata,stationName);
  if(!safe)return null;
  const same=(a:string,b:string)=>a.trim().normalize('NFKC').toLowerCase().replace(/\u0307/g,'')===b.trim().normalize('NFKC').toLowerCase().replace(/\u0307/g,'');
  const candidateTitle=safe.title||safe.song||'';
  const fallbackTitle=!candidateTitle||same(candidateTitle,stationName)||generic.test(candidateTitle);
  const candidateArtist=safe.artist||'';
  const artist=candidateArtist&&!(fallbackTitle&&(same(candidateArtist,stationName)||same(candidateArtist,stationCountry)||generic.test(candidateArtist)))?candidateArtist:'';
  const title=candidateTitle&&(!fallbackTitle||!!artist)?candidateTitle:'';
  if(!title)return artist||null;
  const leadingArtist=title.split(/\s+[-–—]\s+/)[0];
  if(!artist||same(title,artist)||same(leadingArtist,artist))return title;
  return `${artist} - ${title}`;
}

/** Short transient gaps retain the last clean track, then expire; never retain across stations. */
export function resolveNowPlaying(response: unknown, previous: NowPlayingMetadata | null | undefined,
  stationName: string, stationCountry = '', now = Date.now()) {
  const metadata=normalizeNowPlaying(response,stationName);
  if(currentTrackText(metadata,stationName,stationCountry))
    return {metadata:{...metadata!,timestamp:now},status:'available' as MetadataStatus,retained:false};
  if(previous && (!previous.station||previous.station===stationName) && currentTrackText(previous,stationName,stationCountry)
      && typeof previous.timestamp==='number' && now-previous.timestamp>=0 && now-previous.timestamp<METADATA_HOLD_MS)
    return {metadata:previous,status:'available' as MetadataStatus,retained:true};
  const record=metadataRecord(response);
  const diagnostic=record&&[record.title,record.song,record.artist].some(value=>trackField(value)===null);
  const error=!record||diagnostic||!!record.error||record.success===false;
  return {metadata:null,status:(error?'error':'unavailable') as MetadataStatus,retained:false};
}

export function hasFreshIcyMetadata(receivedAt:number,now=Date.now()):boolean {
  return receivedAt>0&&now>=receivedAt&&now-receivedAt<METADATA_HOLD_MS;
}

export function trackSearchUrls(track: string) {
  const query = encodeURIComponent(track.trim());
  return {
    spotify: { app: `spotify://search/${query}`, web: `https://open.spotify.com/search/${query}` },
    youtube: { app: `youtube://results?search_query=${query}`, web: `https://www.youtube.com/results?search_query=${query}` },
    // HTTPS links use the platform's universal link handling, with the web search as fallback.
    appleMusic: { app: `https://music.apple.com/search?term=${query}`, web: `https://music.apple.com/search?term=${query}` },
    deezer: { app: `https://www.deezer.com/search/${query}`, web: `https://www.deezer.com/search/${query}` },
    soundcloud: { app: `https://soundcloud.com/search/sounds?q=${query}`, web: `https://soundcloud.com/search/sounds?q=${query}` },
  };
}
