import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectDeviceKind, deviceLabel } from '../src/device-profile.js';

describe('deviceLabel', () => {
  it('maps kinds to Apple product names', () => {
    assert.equal(deviceLabel('iphone'), 'iPhone');
    assert.equal(deviceLabel('ipad'), 'iPad');
    assert.equal(deviceLabel('ipod'), 'iPod');
    assert.equal(deviceLabel('mac'), 'MacBook');
    assert.equal(deviceLabel('watch'), 'Apple Watch');
  });
});

describe('detectDeviceKind', () => {
  it('detects watch by small viewport', () => {
    assert.equal(detectDeviceKind({ width: 184, height: 224, userAgent: 'Watch' }), 'watch');
  });

  it('detects iPhone / iPod / iPad from UA', () => {
    assert.equal(
      detectDeviceKind({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', width: 390, height: 844 }),
      'iphone',
    );
    assert.equal(
      detectDeviceKind({ userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)', width: 320, height: 568 }),
      'ipod',
    );
    assert.equal(
      detectDeviceKind({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', width: 1024, height: 1366 }),
      'ipad',
    );
  });

  it('detects Mac and iPadOS-as-Mac', () => {
    assert.equal(
      detectDeviceKind({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)',
        platform: 'MacIntel',
        maxTouchPoints: 0,
        width: 1440,
        height: 900,
      }),
      'mac',
    );
    assert.equal(
      detectDeviceKind({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
        width: 1024,
        height: 1366,
      }),
      'ipad',
    );
  });
});
