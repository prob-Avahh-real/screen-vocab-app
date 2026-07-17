/**
 * Subtitle detection + extract gate.
 * @typedef {{ text: string, confidence?: number, source?: string } | null} SubtitleLine
 */

const UI_NOISE = /^(play|pause|settings|share|subscribe|like|home|menu|ok|cancel|skip|next|prev|back)$/i;

/**
 * @param {SubtitleLine} line
 * @returns {boolean}
 */
export function detectSubtitle(line) {
  if (!line || typeof line.text !== 'string') return false;
  const text = line.text.replace(/\s+/g, ' ').trim();
  if (text.length < 4 || text.length > 120) return false;
  if (!/[A-Za-z]/.test(text)) return false;
  if (/^\d+([:./]\d+)*$/.test(text)) return false;
  if (UI_NOISE.test(text)) return false;
  if (typeof line.confidence === 'number' && line.confidence < 0.35) return false;
  const letters = (text.match(/[A-Za-z]/g) || []).join('').length;
  if (letters / text.replace(/\s/g, '').length < 0.4) return false;
  return true;
}

/**
 * Hard gate: subtitle present + source ready + not busy.
 * @param {{
 *   line: SubtitleLine,
 *   sourceReady: boolean,
 *   busy?: boolean,
 * }} opts
 */
export function canExtract(opts) {
  if (!opts || opts.busy) return false;
  if (!opts.sourceReady) return false;
  return detectSubtitle(opts.line);
}

/**
 * Status label for UI / HUD.
 * @param {{ canExtract: boolean, busy?: boolean, reason?: string }} s
 */
export function statusLabel(s) {
  if (s.busy) return '处理中…';
  if (s.canExtract) return '可取词';
  return s.reason || '无字幕';
}
