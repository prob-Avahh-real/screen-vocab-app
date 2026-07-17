/**
 * Parse SRT / VTT and resolve cue by time.
 */

/**
 * @typedef {{ start: number, end: number, text: string }} Cue
 */

/**
 * @param {string} raw
 * @returns {Cue[]}
 */
export function parseSubtitles(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (/WEBVTT/i.test(text.slice(0, 20))) return parseVtt(text);
  return parseSrt(text);
}

/** @param {string} text */
function parseSrt(text) {
  const blocks = text.split(/\n\s*\n/);
  /** @type {Cue[]} */
  const cues = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    let i = 0;
    if (/^\d+$/.test(lines[0])) i = 1;
    const m = lines[i]?.match(
      /(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/,
    );
    if (!m) continue;
    const start = parseTimestamp(m[1]);
    const end = parseTimestamp(m[2]);
    const body = lines.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (body) cues.push({ start, end, text: body });
  }
  return cues;
}

/** @param {string} text */
function parseVtt(text) {
  const blocks = text.split(/\n\s*\n/);
  /** @type {Cue[]} */
  const cues = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length || /^WEBVTT/i.test(lines[0]) || /^NOTE\b/i.test(lines[0])) continue;
    let i = 0;
    if (!/-->/.test(lines[0]) && lines[1] && /-->/.test(lines[1])) i = 1;
    const m = lines[i]?.match(
      /(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})/,
    );
    if (!m) continue;
    const start = parseTimestamp(m[1]);
    const end = parseTimestamp(m[2]);
    const body = lines.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (body) cues.push({ start, end, text: body });
  }
  return cues;
}

/** @param {string} ts */
export function parseTimestamp(ts) {
  const norm = ts.replace(',', '.');
  const parts = norm.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

export class SrtPlayer {
  constructor() {
    /** @type {Cue[]} */
    this.cues = [];
    this.time = 0;
    this.ready = false;
  }

  /** @param {string} raw */
  load(raw) {
    this.cues = parseSubtitles(raw);
    this.ready = this.cues.length > 0;
    this.time = 0;
    return this.cues.length;
  }

  /** @param {number} t */
  setTime(t) {
    this.time = Math.max(0, Number(t) || 0);
  }

  /** @returns {{ text: string, confidence: number, source: string } | null} */
  getCurrentLine() {
    if (!this.ready) return null;
    const cue = this.cues.find((c) => this.time >= c.start && this.time <= c.end);
    if (!cue) return null;
    return { text: cue.text, confidence: 1, source: 'srt' };
  }

  duration() {
    if (!this.cues.length) return 0;
    return this.cues[this.cues.length - 1].end;
  }
}
