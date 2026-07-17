import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSubtitles, parseTimestamp, SrtPlayer } from '../src/sources/srt-player.js';

describe('parseTimestamp', () => {
  it('parses srt and vtt styles', () => {
    assert.equal(parseTimestamp('01:02:03,500'), 3723.5);
    assert.equal(parseTimestamp('01:02:03.500'), 3723.5);
    assert.equal(parseTimestamp('02:03.500'), 123.5);
  });
});

describe('parseSubtitles', () => {
  it('parses SRT blocks', () => {
    const cues = parseSubtitles(`1
00:00:01,000 --> 00:00:03,000
First line here.

2
00:00:04,000 --> 00:00:06,000
Second <i>line</i> here.
`);
    assert.equal(cues.length, 2);
    assert.equal(cues[0].text, 'First line here.');
    assert.equal(cues[1].text, 'Second line here.');
    assert.equal(cues[0].start, 1);
  });

  it('parses VTT', () => {
    const cues = parseSubtitles(`WEBVTT

00:00:01.000 --> 00:00:02.500
Vtt cue text
`);
    assert.equal(cues.length, 1);
    assert.equal(cues[0].text, 'Vtt cue text');
  });
});

describe('SrtPlayer', () => {
  it('resolves cue by time', () => {
    const p = new SrtPlayer();
    const n = p.load(`1
00:00:00,000 --> 00:00:02,000
Alpha

2
00:00:02,500 --> 00:00:05,000
Bravo mission
`);
    assert.equal(n, 2);
    p.setTime(1);
    assert.equal(p.getCurrentLine()?.text, 'Alpha');
    p.setTime(3);
    assert.equal(p.getCurrentLine()?.text, 'Bravo mission');
    p.setTime(2.2);
    assert.equal(p.getCurrentLine(), null);
  });
});
