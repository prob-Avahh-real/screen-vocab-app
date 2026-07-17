import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canExtract } from '../src/subtitle-detect.js';
import { parseVoiceCommand, dispatchVoice } from '../src/smart-outputs.js';

describe('gate + voice extract', () => {
  it('parseVoiceCommand maps extract/next/prev/read', () => {
    assert.equal(parseVoiceCommand('请取词'), 'extract');
    assert.equal(parseVoiceCommand('下一个'), 'next');
    assert.equal(parseVoiceCommand('上一个'), 'prev');
    assert.equal(parseVoiceCommand('朗读释义'), 'read');
    assert.equal(parseVoiceCommand('hello world'), null);
  });

  it('dispatchVoice extract respects canExtract gate', () => {
    let extracted = 0;
    const actions = {
      extract: () => {
        extracted += 1;
      },
      next: () => {},
      prev: () => {},
      getCard: () => null,
      getStatus: () => '',
      canExtract: () => false,
    };
    dispatchVoice('extract', actions);
    assert.equal(extracted, 0);

    actions.canExtract = () => true;
    dispatchVoice('extract', actions);
    assert.equal(extracted, 1);
  });

  it('wearable-style gate: shake ignored without subtitle', () => {
    const open = canExtract({
      line: null,
      sourceReady: true,
      busy: false,
    });
    assert.equal(open, false);
    // App calls doExtract only when gateOpen(); simulate silent ignore
    let called = 0;
    if (open) called += 1;
    assert.equal(called, 0);
  });
});
