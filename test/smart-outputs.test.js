import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseVoiceCommand, dispatchVoice } from '../src/smart-outputs.js';

describe('parseVoiceCommand', () => {
  it('maps chinese and english commands', () => {
    assert.equal(parseVoiceCommand('取词'), 'extract');
    assert.equal(parseVoiceCommand('下一个'), 'next');
    assert.equal(parseVoiceCommand('朗读'), 'read');
    assert.equal(parseVoiceCommand('stop'), 'stop');
    assert.equal(parseVoiceCommand('hello'), null);
  });
});

describe('dispatchVoice gate', () => {
  it('skips extract when canExtract is false', () => {
    let extracted = false;
    dispatchVoice('extract', {
      extract: () => {
        extracted = true;
      },
      next: () => {},
      prev: () => {},
      getCard: () => null,
      getStatus: () => '',
      canExtract: () => false,
    });
    assert.equal(extracted, false);
  });

  it('runs extract when gated open', () => {
    let extracted = false;
    dispatchVoice('extract', {
      extract: () => {
        extracted = true;
      },
      next: () => {},
      prev: () => {},
      getCard: () => null,
      getStatus: () => '',
      canExtract: () => true,
    });
    assert.equal(extracted, true);
  });
});
