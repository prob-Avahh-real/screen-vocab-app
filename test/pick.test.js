import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickWords, STOPWORDS } from '../src/vocab/pick.js';
import { enrichVocab, fallbackCard } from '../src/vocab/enrich.js';

describe('pickWords', () => {
  it('skips stopwords and short tokens', () => {
    const words = pickWords('We need to negotiate the mission carefully now');
    assert.ok(words.includes('negotiate') || words.some((w) => w.toLowerCase() === 'negotiate'));
    assert.ok(!words.some((w) => STOPWORDS.has(w.toLowerCase())));
    assert.ok(words.length >= 1 && words.length <= 8);
  });

  it('returns empty for blank', () => {
    assert.deepEqual(pickWords(''), []);
    assert.deepEqual(pickWords(null), []);
  });
});

describe('enrichVocab', () => {
  it('fallback card has required fields', () => {
    const c = fallbackCard('mission', 'This is the mission.');
    assert.equal(c.word, 'mission');
    assert.ok(c.definition);
    assert.ok(c.example.includes('mission'));
    assert.ok(Array.isArray(c.synonyms));
    assert.ok(c.usage);
  });

  it('uses dictionary API when fetch succeeds', async () => {
    const fakeFetch = async () => ({
      ok: true,
      json: async () => [
        {
          meanings: [
            {
              partOfSpeech: 'noun',
              synonyms: ['task', 'operation'],
              definitions: [
                {
                  definition: 'an important assignment',
                  example: 'a rescue mission',
                  synonyms: [],
                },
              ],
            },
          ],
        },
      ],
    });
    const card = await enrichVocab('mission', 'Start the mission.', { fetchImpl: fakeFetch });
    assert.match(card.definition, /important assignment/);
    assert.ok(card.synonyms.includes('task'));
    assert.match(card.usage, /名词/);
  });

  it('falls back when fetch fails', async () => {
    const fakeFetch = async () => {
      throw new Error('offline');
    };
    const card = await enrichVocab('resist', 'We must resist.', { fetchImpl: fakeFetch });
    assert.match(card.definition, /离线/);
  });
});
