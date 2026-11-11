import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleWearStationRequest } from '../../src/services/wearStationRequest.ts';

test('out-of-order catalog responses keep their selection IDs', async () => {
  const replies = [];
  let finish;
  const slow = handleWearStationRequest({ type: 'genre_stations', genreId: 'jazz', requestId: 'first' },
    () => new Promise(resolve => { finish = resolve; }), async () => [], (...args) => replies.push(args));
  await handleWearStationRequest({ type: 'country_stations', countryCode: 'Türkiye', requestId: 'second' },
    async () => [], async country => [{ name: country }], (...args) => replies.push(args));
  finish([{ name: 'Jazz' }]);
  await slow;
  assert.deepEqual(replies, [['second', [{ name: 'Türkiye' }], ''], ['first', [{ name: 'Jazz' }], '']]);
});
test('API failure returns a correlated error, not a successful empty result', async () => {
  const replies = [];
  await handleWearStationRequest({ type: 'genre_stations', genreId: 'jazz', requestId: 'failed' },
    async () => { throw new Error('offline'); }, async () => [], (...args) => replies.push(args));
  assert.deepEqual(replies, [['failed', [], 'catalog_unavailable']]);
});
test('legacy requests remain available to the existing handler', async () => {
  const never = () => { throw new Error('must not be called'); };
  assert.equal(await handleWearStationRequest({ type: 'all' }, never, never, never), false);
  assert.equal(await handleWearStationRequest({ type: 'genre_stations', genreId: 'jazz' }, never, never, never), false);
});
