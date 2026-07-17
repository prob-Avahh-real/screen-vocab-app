import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectSubtitle, canExtract, statusLabel } from '../src/subtitle-detect.js';

describe('detectSubtitle', () => {
  it('accepts a normal English subtitle', () => {
    assert.equal(detectSubtitle({ text: 'We need to negotiate the terms carefully.' }), true);
  });

  it('rejects empty / short / no latin', () => {
    assert.equal(detectSubtitle(null), false);
    assert.equal(detectSubtitle({ text: 'hi' }), false);
    assert.equal(detectSubtitle({ text: '你好世界哈哈' }), false);
  });

  it('rejects UI noise and pure numbers', () => {
    assert.equal(detectSubtitle({ text: 'Play' }), false);
    assert.equal(detectSubtitle({ text: '12:34' }), false);
  });

  it('rejects low OCR confidence', () => {
    assert.equal(
      detectSubtitle({ text: 'Hello there friend', confidence: 0.1 }),
      false,
    );
  });
});

describe('canExtract gate', () => {
  const good = { text: 'This is a real subtitle line.' };

  it('opens only when ready + subtitle + not busy', () => {
    assert.equal(canExtract({ line: good, sourceReady: true, busy: false }), true);
    assert.equal(canExtract({ line: good, sourceReady: false }), false);
    assert.equal(canExtract({ line: good, sourceReady: true, busy: true }), false);
    assert.equal(canExtract({ line: { text: 'ok' }, sourceReady: true }), false);
  });
});

describe('statusLabel', () => {
  it('maps states', () => {
    assert.equal(statusLabel({ canExtract: true }), '可取词');
    assert.equal(statusLabel({ canExtract: false, busy: true }), '处理中…');
    assert.equal(statusLabel({ canExtract: false }), '无字幕');
    assert.equal(statusLabel({ canExtract: false, reason: '源未就绪' }), '源未就绪');
  });
});
