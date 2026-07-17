/**
 * DOM helpers for 屏词.
 */

/**
 * @param {HTMLElement | null} el
 * @param {string} text
 * @param {'ok' | 'warn' | 'busy'} [kind]
 */
export function setStatus(el, text, kind = 'warn') {
  if (!el) return;
  el.textContent = text;
  el.classList.remove('status-ok', 'status-warn', 'status-busy');
  el.classList.add(`status-${kind}`);
}

/**
 * @param {HTMLButtonElement | null} btn
 * @param {boolean} enabled
 */
export function setExtractEnabled(btn, enabled) {
  if (!btn) return;
  btn.disabled = !enabled;
  btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
}

/**
 * @param {HTMLElement | null} el
 * @param {string} text
 */
export function setLinePreview(el, text) {
  if (!el) return;
  el.textContent = text || '（无当前字幕）';
}

/**
 * @param {HTMLElement | null} el
 * @param {string} text
 */
export function setHud(el, text) {
  if (!el) return;
  el.textContent = text;
}

/**
 * @param {import('./vocab/enrich.js').VocabCard} card
 * @param {number} index
 * @param {number} total
 */
export function renderCard(card, index, total) {
  const syn = card.synonyms?.length ? card.synonyms.join(' · ') : '（暂无）';
  return `
    <article class="card" data-index="${index}">
      <header class="card-head">
        <h2 class="word">${escapeHtml(card.word)}</h2>
        <span class="card-meta">${index + 1}/${total}</span>
      </header>
      <div class="field"><h3>释义</h3><p>${escapeHtml(card.definition)}</p></div>
      <div class="field"><h3>例句</h3><p>${escapeHtml(card.example)}</p></div>
      <div class="field"><h3>近义词</h3><p>${escapeHtml(syn)}</p></div>
      <div class="field"><h3>使用场景</h3><p>${escapeHtml(card.usage)}</p></div>
      <div class="field"><h3>出处</h3><p>${escapeHtml(card.sourceLine)}</p></div>
      <div class="row">
        <button type="button" data-action="save">收藏</button>
      </div>
    </article>
  `;
}

/**
 * @param {HTMLElement | null} mount
 * @param {import('./vocab/enrich.js').VocabCard[]} cards
 * @param {number} index
 * @param {{ onSave?: (c: import('./vocab/enrich.js').VocabCard) => void }} [handlers]
 */
export function mountCards(mount, cards, index, handlers = {}) {
  if (!mount) return;
  if (!cards.length) {
    mount.innerHTML = '<p class="empty">取词后这里显示释义卡片</p>';
    return;
  }
  const i = ((index % cards.length) + cards.length) % cards.length;
  const card = cards[i];
  mount.innerHTML = renderCard(card, i, cards.length);
  mount.querySelector('[data-action="save"]')?.addEventListener('click', () => handlers.onSave?.(card));
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
