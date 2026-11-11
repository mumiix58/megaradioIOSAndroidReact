import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyticsScreen, searchMetrics, analyticsCatalogId, PlaybackMetrics } from '../../src/utils/analyticsMetrics.ts';

test('route metrics use a bounded catalog and never copy dynamic IDs or URLs', () => {
  assert.equal(analyticsScreen(['(tabs)', 'discover']), 'discover');
  assert.equal(analyticsScreen(['(tabs)']), 'home');
  assert.equal(analyticsScreen(['user-profile', 'person@example.com']), 'user_profile');
  assert.equal(analyticsScreen(['https://secret.example/path?token=abc']), 'other');
  assert.equal(analyticsScreen(['[stationId]']), 'other');
  assert.equal(analyticsCatalogId('person@example.com'), 'unknown');
  assert.equal(analyticsCatalogId('https://radio.example/stream?key=private'), 'unknown');
});

test('search diagnostics retain usefulness without retaining personal search text', () => {
  const result = searchMetrics('person@example.com', 0);
  assert.deepEqual(result, { query_length_bucket: '11_plus', results_count: 0, has_results: 0 });
  assert.deepEqual(searchMetrics(' FM ', Infinity), { query_length_bucket: '1_3', results_count: 0, has_results: 0 });
  assert.equal(searchMetrics('rock', 25000).results_count, 10000);
});

test('selection is not successful playback; native playing confirms start and startup delay', () => {
  const metrics = new PlaybackMetrics();
  assert.deepEqual(metrics.update('radio-1', 'idle', 0).map(e => e.name), ['station_selected']);
  assert.deepEqual(metrics.update('radio-1', 'loading', 100), []);
  const [start] = metrics.update('radio-1', 'playing', 2100);
  assert.equal(start.name, 'playback_started');
  assert.equal(start.parameters.startup_ms, 2100);
  assert.deepEqual(metrics.update('radio-1', 'playing', 3100), []);
  const [summary] = metrics.update('radio-1', 'paused', 12100);
  assert.equal(summary.parameters.foreground_play_ms, 10000);
});

test('initial failure is distinguished from failure after playback without error text', () => {
  const metrics = new PlaybackMetrics();
  metrics.update('radio-1', 'loading', 0);
  assert.deepEqual(metrics.update('radio-1', 'error', 1000), [
    { name: 'playback_failed', parameters: { station_id: 'radio-1', failure_phase: 'before_start' } },
  ]);
  assert.deepEqual(metrics.update('radio-1', 'error', 1200), []);
  metrics.update('radio-1', 'loading', 2000);
  assert.equal(metrics.update('radio-1', 'playing', 2300)[0].parameters.startup_ms, 300);
  assert.equal(metrics.update('radio-1', 'error', 2400)[0].parameters.failure_phase, 'after_start');
});

test('buffering excludes listen time and resume does not count as a new first play', () => {
  const metrics = new PlaybackMetrics();
  metrics.update('radio-1', 'loading', 0);
  metrics.update('radio-1', 'playing', 1000);
  metrics.update('radio-1', 'buffering', 6000);
  metrics.update('radio-1', 'buffering', 7000);
  assert.deepEqual(metrics.update('radio-1', 'playing', 8000), []);
  const [summary] = metrics.update('radio-1', 'paused', 11000);
  assert.equal(summary.parameters.foreground_play_ms, 8000);
  assert.equal(summary.parameters.foreground_buffer_ms, 2000);
  assert.equal(summary.parameters.rebuffer_count, 1);
  metrics.update('radio-1', 'playing', 100000);
  assert.equal(metrics.update('radio-1', 'paused', 102000)[0].parameters.foreground_play_ms, 2000);
});

test('background hours and suspended JS do not inflate foreground listening', () => {
  const metrics = new PlaybackMetrics();
  metrics.update('radio-1', 'playing', 0, true);
  assert.equal(metrics.setForeground(false, 1000)[0].parameters.foreground_play_ms, 1000);
  metrics.setForeground(true, 3600000);
  assert.equal(metrics.update('radio-1', 'paused', 3602000)[0].parameters.foreground_play_ms, 2000);
  metrics.update('radio-1', 'playing', 3603000);
  const [summary] = metrics.update('radio-1', 'paused', 3903000);
  assert.equal(summary.parameters.foreground_play_ms, 0);
  assert.equal(summary.parameters.dropped_time_samples, 1);
});

test('station switches flush the previous station and periodic checkpoints do not double count', () => {
  const metrics = new PlaybackMetrics();
  metrics.update('radio-1', 'playing', 0, true);
  const checkpoints = [];
  for (let time = 30000; time <= 300000; time += 30000) checkpoints.push(...metrics.tick(time));
  assert.equal(checkpoints.length, 1);
  assert.equal(checkpoints[0].parameters.foreground_play_ms, 300000);
  const change = metrics.update('radio-2', 'loading', 302000);
  assert.equal(change[0].parameters.station_id, 'radio-1');
  assert.equal(change[0].parameters.foreground_play_ms, 2000);
  assert.equal(change[1].name, 'station_selected');
});
