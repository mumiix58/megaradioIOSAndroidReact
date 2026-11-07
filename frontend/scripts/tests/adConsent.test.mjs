import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAdConsent } from '../../src/utils/adConsent.ts';

function ump(allowed = true) {
  const calls = [];
  return { calls,
    requestInfoUpdate: async () => { calls.push('update'); return { canRequestAds: allowed }; },
    loadAndShowConsentFormIfRequired: async () => { calls.push('form'); return { canRequestAds: allowed }; },
    getConsentInfo: async () => { calls.push('cached'); return { canRequestAds: allowed }; },
  };
}
test('a missing native ATT bridge cannot initialize iOS ads', async () => {
  const consent = ump();
  assert.equal(await prepareAdConsent('ios', undefined, consent), false);
  assert.deepEqual(consent.calls, []);
});
test('no ad SDK work while the ATT system alert is pending', async () => {
  const consent = ump(); let answer;
  const request = new Promise(resolve => { answer = resolve; });
  const ready = prepareAdConsent('ios', () => request, consent);
  await Promise.resolve(); assert.deepEqual(consent.calls, []);
  answer('authorized'); assert.equal(await ready, true);
  assert.deepEqual(consent.calls, ['update', 'form']);
});
test('unresolved and failed ATT requests fail closed', async () => {
  assert.equal(await prepareAdConsent('ios', async () => 'notDetermined', ump()), false);
  assert.equal(await prepareAdConsent('ios', async () => { throw Error('inactive'); }, ump()), false);
});
test('denying tracking may serve existing NPA ads only after UMP permits requests', async () => {
  for (const status of ['denied', 'restricted']) {
    assert.equal(await prepareAdConsent('ios', async () => status, ump(true)), true);
    assert.equal(await prepareAdConsent('ios', async () => status, ump(false)), false);
  }
});
test('Android must also complete required UMP consent', async () => {
  const consent = ump(false);
  assert.equal(await prepareAdConsent('android', undefined, consent), false);
  assert.deepEqual(consent.calls, ['update', 'form']);
});
test('a consent network error only permits a valid prior consent decision', async () => {
  for (const allowed of [false, true]) {
    const consent = ump(allowed);
    consent.requestInfoUpdate = async () => { throw Error('offline'); };
    assert.equal(await prepareAdConsent('android', undefined, consent), allowed);
  }
  const consent = ump();
  consent.requestInfoUpdate = consent.getConsentInfo = async () => { throw Error('offline'); };
  assert.equal(await prepareAdConsent('android', undefined, consent), false);
});
