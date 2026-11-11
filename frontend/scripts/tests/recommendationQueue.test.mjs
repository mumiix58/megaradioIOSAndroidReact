import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextRecommendation } from '../../src/utils/recommendationQueue.ts';

test('repeated next commands advance across the saved queue and wrap', () => {
  const stations = [{ _id: 'dance' }, { _id: 'mango' }, { _id: 'rey' }];
  let current = 'start';
  let index = -1;
  const heard = [];
  for (let i = 0; i < 5; i++) {
    const next = nextRecommendation(stations, current, index);
    current = next.station._id;
    index = next.index;
    heard.push(current);
  }
  assert.deepEqual(heard, ['dance', 'mango', 'rey', 'dance', 'mango']);
});

test('current station and malformed entries cannot turn next into a pause toggle', () => {
  assert.equal(nextRecommendation([{ _id: 'dance' }, {}], 'dance', -1), null);
  assert.deepEqual(nextRecommendation([{}, { _id: 'dance' }, { id: 'mango' }], 'dance', -1),
    { station: { id: 'mango' }, index: 2 });
});

test('an invalid or stale persisted index recovers at the first different station', () => {
  const stations = [{ _id: 'dance' }, { _id: 'mango' }];
  for (const index of [NaN, 100, -3, 1.5]) {
    assert.equal(nextRecommendation(stations, 'dance', index).station._id, 'mango');
  }
});
