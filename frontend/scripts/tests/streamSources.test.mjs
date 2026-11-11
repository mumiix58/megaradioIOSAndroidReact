import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHlsStream, isPlaylistStream, buildStreamCandidates } from '../../src/utils/streamSources.ts';

test('KRAL POP master playlist uses API HLS hint despite .m3u extension', () => {
  const url = 'https://ssldyg.radyotvonline.com/smil/smil:kralpop.smil/playlist.m3u';
  assert.equal(isHlsStream(url, { hls: true, url }), true);
  assert.equal(isPlaylistStream(url), true);
});
test('signed HLS candidate is detected even when legacy station data has no hint', () => {
  assert.equal(isHlsStream('https://radio.example/live.M3U8?token=test'), true);
  assert.equal(isHlsStream('https://radio.example/live', { hls: true, url: 'https://radio.example/live' }), true);
});
test('ordinary M3U and MP3 fallback are not forced through HLS', () => {
  assert.equal(isHlsStream('https://radio.example/stations.m3u', { hls: false }), false);
  assert.equal(isHlsStream('https://radio.example/backup.mp3', { hls: true, url: 'https://radio.example/master.m3u' }), false);
});
test('failover starts after the selected quality URL and removes duplicates', () => {
  assert.deepEqual(buildStreamCandidates(' https://radio.example/low ', 'https://radio.example/high', 'https://radio.example/low', ['', null]), ['https://radio.example/low', 'https://radio.example/high']);
});
