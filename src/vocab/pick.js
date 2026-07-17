/** Common English stopwords — skip for vocab pick. */
export const STOPWORDS = new Set(
  `a an the and or but if in on at to for of as is was are were be been being
  it this that these those i you he she we they me him her us them my your his
  their our with from by not no so do does did have has had will would can could
  should may might must just about into over out up down off then than too very
  also only own same such both each few more most other some such than too
  what which who whom when where why how all any both each few more most other
  some such than too very can will just don should now am im youre theyre theres
  dont doesnt didnt isnt arent wasnt werent havent hasnt hadnt wont wouldnt
  cant couldnt shouldnt`.split(/\s+/).filter(Boolean),
);

/**
 * Pick 3–8 learnable tokens from a subtitle line.
 * @param {string} line
 * @param {{ max?: number }} [opts]
 * @returns {string[]}
 */
export function pickWords(line, opts = {}) {
  const max = opts.max ?? 8;
  if (!line || typeof line !== 'string') return [];
  const tokens = line
    .replace(/[“”"‘’]/g, '')
    .split(/[^A-Za-z'-]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  /** @type {Map<string, string>} */
  const seen = new Map();
  for (const tok of tokens) {
    const lower = tok.toLowerCase();
    if (lower.length < 3) continue;
    if (STOPWORDS.has(lower)) continue;
    if (/^\d+$/.test(lower)) continue;
    if (!seen.has(lower)) seen.set(lower, tok);
  }

  const ranked = [...seen.entries()].sort((a, b) => {
    // Prefer mid length (less common looking) then longer
    const score = (w) => (w.length >= 5 && w.length <= 10 ? 2 : 0) + Math.min(w.length, 12) * 0.1;
    return score(b[0]) - score(a[0]);
  });

  return ranked.slice(0, Math.min(max, Math.max(3, ranked.length))).map(([, orig]) => orig);
}
