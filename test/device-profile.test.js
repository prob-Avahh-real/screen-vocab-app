import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectDeviceProfile, deviceLabel } from '../src/device-profile.js';

describe('deviceLabel', () => {
  it('covers apple and android ecosystems', () => {
    assert.equal(deviceLabel('iphone'), 'iPhone');
    assert.equal(deviceLabel('appletv'), 'Apple TV');
    assert.equal(deviceLabel('wearos'), 'Wear OS');
    assert.equal(deviceLabel('android-tv'), 'Android TV');
    assert.equal(deviceLabel('chromeos'), 'ChromeOS');
    assert.equal(deviceLabel('foldable'), '折叠屏');
  });
});

describe('detectDeviceProfile', () => {
  it('detects Apple Watch / Wear OS by viewport or UA', () => {
    assert.equal(detectDeviceProfile({ width: 184, height: 224 }).kind, 'applewatch');
    assert.equal(
      detectDeviceProfile({
        userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel Watch) AppleWebKit Wear OS',
        width: 384,
        height: 384,
      }).kind,
      'wearos',
    );
  });

  it('detects Apple phone / tablet / mac / tv / vision', () => {
    assert.equal(
      detectDeviceProfile({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        width: 390,
        height: 844,
      }).kind,
      'iphone',
    );
    assert.equal(
      detectDeviceProfile({
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
        width: 1024,
        height: 1366,
      }).kind,
      'ipad',
    );
    assert.equal(
      detectDeviceProfile({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)',
        platform: 'MacIntel',
        maxTouchPoints: 0,
        width: 1440,
        height: 900,
      }).kind,
      'mac',
    );
    assert.equal(
      detectDeviceProfile({ userAgent: 'AppleTV6,2 TVOS', width: 1920, height: 1080 }).kind,
      'appletv',
    );
    assert.equal(
      detectDeviceProfile({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleVision', width: 2000, height: 1500 })
        .kind,
      'vision',
    );
  });

  it('detects Android phone / tablet / tv / chromeos / foldable', () => {
    assert.equal(
      detectDeviceProfile({
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit',
        width: 412,
        height: 915,
      }).kind,
      'android-phone',
    );
    assert.equal(
      detectDeviceProfile({
        userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-X900) AppleWebKit',
        width: 800,
        height: 1280,
      }).kind,
      'android-tablet',
    );
    assert.equal(
      detectDeviceProfile({
        userAgent: 'Mozilla/5.0 (Linux; Android 11; BRAVIA 4K) Android TV',
        width: 1920,
        height: 1080,
      }).kind,
      'android-tv',
    );
    assert.equal(
      detectDeviceProfile({
        userAgent: 'Mozilla/5.0 (X11; CrOS x86_64) AppleWebKit',
        width: 1366,
        height: 768,
      }).kind,
      'chromeos',
    );
    assert.equal(
      detectDeviceProfile({
        userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-F946B) Samsung Z Fold',
        width: 1812,
        height: 2176,
        foldSegments: true,
      }).kind,
      'foldable',
    );
  });

  it('sets family and form consistently', () => {
    const wear = detectDeviceProfile({
      userAgent: 'Wear OS',
      width: 200,
      height: 200,
    });
    assert.equal(wear.family, 'android');
    assert.equal(wear.form, 'watch');
  });
});
