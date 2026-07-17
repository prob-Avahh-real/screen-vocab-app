/**
 * Enrich a word with definition / example / synonyms / usage (EN → ZH-friendly).
 */

/**
 * @typedef {{
 *   word: string,
 *   definition: string,
 *   example: string,
 *   synonyms: string[],
 *   usage: string,
 *   sourceLine: string,
 * }} VocabCard
 */

/**
 * @param {string} word
 * @param {string} sourceLine
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<VocabCard>}
 */
export async function enrichVocab(word, sourceLine, opts = {}) {
  const fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  const base = fallbackCard(word, sourceLine);
  if (!fetchImpl) return base;

  try {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`;
    const res = await fetchImpl(url);
    if (!res.ok) return base;
    const data = await res.json();
    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry) return base;

    const meanings = entry.meanings || [];
    const first = meanings[0];
    const def = first?.definitions?.[0];
    const syns = [
      ...(first?.synonyms || []),
      ...(def?.synonyms || []),
    ].filter(Boolean).slice(0, 5);

    const definitionEn = def?.definition || '';
    const exampleEn = def?.example || sourceLine;

    return {
      word,
      definition: definitionEn
        ? `${definitionEn}（英释义；可对照上下文理解）`
        : base.definition,
      example: exampleEn || base.example,
      synonyms: syns.length ? syns : base.synonyms,
      usage: usageFromPos(first?.partOfSpeech, word, sourceLine),
      sourceLine,
    };
  } catch {
    return base;
  }
}

/**
 * @param {string} word
 * @param {string} sourceLine
 * @returns {VocabCard}
 */
export function fallbackCard(word, sourceLine) {
  return {
    word,
    definition: `（离线）请结合字幕句理解「${word}」的含义`,
    example: sourceLine || `I heard "${word}" in the subtitle.`,
    synonyms: [],
    usage: `影视/对话字幕中出现；可在口语或写作中替换同义表达练习「${word}」。`,
    sourceLine: sourceLine || '',
  };
}

/**
 * @param {string | undefined} pos
 * @param {string} word
 * @param {string} sourceLine
 */
function usageFromPos(pos, word, sourceLine) {
  const p = (pos || '').toLowerCase();
  if (p.includes('verb')) {
    return `动词用法：注意时态与搭配；字幕句：「${sourceLine}」`;
  }
  if (p.includes('noun')) {
    return `名词用法：注意单复数与冠词；字幕句：「${sourceLine}」`;
  }
  if (p.includes('adj')) {
    return `形容词用法：可修饰名词或作表语；字幕句：「${sourceLine}」`;
  }
  if (p.includes('adv')) {
    return `副词用法：常修饰动词/形容词；字幕句：「${sourceLine}」`;
  }
  return `在字幕语境中学习「${word}」：${sourceLine}`;
}

const STORAGE_KEY = 'screen-vocab-saved';

/** @param {VocabCard} card */
export function saveCard(card) {
  const list = loadSaved();
  if (list.some((c) => c.word.toLowerCase() === card.word.toLowerCase())) return list;
  list.unshift(card);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 200)));
  } catch { /* ignore quota */ }
  return list;
}

/** @returns {VocabCard[]} */
export function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
