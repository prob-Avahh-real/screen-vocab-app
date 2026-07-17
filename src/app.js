import { canExtract, detectSubtitle, statusLabel } from './subtitle-detect.js';
import { WearableInput } from './wearable-input.js';
import { ScreenOcrSource, createTesseractOcr } from './sources/screen-ocr.js';
import { SrtPlayer } from './sources/srt-player.js';
import { PasteSource } from './sources/paste-source.js';
import { pickWords } from './vocab/pick.js';
import { enrichVocab, saveCard } from './vocab/enrich.js';
import { setStatus, setExtractEnabled, setLinePreview, setHud, mountCards } from './ui.js';
import {
  isGlassesMode,
  setupHeadphones,
  setupVoiceCommands,
  setupHeadband,
  speakCard,
  stopSpeak,
} from './smart-outputs.js';

/** @typedef {'screen' | 'srt' | 'paste'} Mode */

const state = {
  /** @type {Mode} */
  mode: 'paste',
  busy: false,
  /** @type {import('./vocab/enrich.js').VocabCard[]} */
  cards: [],
  cardIndex: 0,
  ocrFn: null,
};

const screenSrc = new ScreenOcrSource();
const srtSrc = new SrtPlayer();
const pasteSrc = new PasteSource();

const $ = (id) => document.getElementById(id);

function activeSource() {
  if (state.mode === 'screen') return screenSrc;
  if (state.mode === 'srt') return srtSrc;
  return pasteSrc;
}

function sourceReadyFlag() {
  if (state.mode === 'screen') return screenSrc.ready;
  if (state.mode === 'srt') return srtSrc.ready;
  return pasteSrc.ready;
}

function currentLine() {
  return activeSource().getCurrentLine();
}

function gateOpen() {
  return canExtract({
    line: currentLine(),
    sourceReady: sourceReadyFlag(),
    busy: state.busy,
  });
}

function refreshGate() {
  const line = currentLine();
  const open = gateOpen();
  const reason = !sourceReadyFlag()
    ? '源未就绪'
    : line && !detectSubtitle(line)
      ? '未识别为字幕'
      : '无字幕';
  const label = statusLabel({ canExtract: open, busy: state.busy, reason });
  const kind = state.busy ? 'busy' : open ? 'ok' : 'warn';
  setStatus($('status'), label, kind);
  setExtractEnabled(/** @type {HTMLButtonElement} */ ($('btn-extract')), open && !state.busy);
  setLinePreview($('line-preview'), line?.text || '');
  setHud($('hud'), open ? `HUD · 可取词 · ${line?.source || ''}` : `HUD · ${label}`);
}

async function ensureOcr() {
  if (state.ocrFn) return state.ocrFn;
  setStatus($('status'), '加载 OCR…', 'busy');
  state.ocrFn = await createTesseractOcr();
  pasteSrc.ocrFn = state.ocrFn;
  screenSrc.ocrFn = state.ocrFn;
  return state.ocrFn;
}

async function doExtract() {
  if (!gateOpen()) return;
  const line = currentLine();
  if (!line) return;

  state.busy = true;
  refreshGate();
  try {
    const words = pickWords(line.text, { max: 8 });
    if (!words.length) {
      setStatus($('status'), '无可取实词', 'warn');
      return;
    }
    const cards = [];
    for (const w of words) {
      cards.push(await enrichVocab(w, line.text));
    }
    state.cards = cards;
    state.cardIndex = 0;
    renderCards();
    setStatus($('status'), `已取 ${cards.length} 词`, 'ok');
    setHud($('hud'), `HUD · 已取 ${cards[0].word}`);
    headband?.onExtracted?.(cards[0]);
  } finally {
    state.busy = false;
    refreshGate();
  }
}

function currentCard() {
  if (!state.cards.length) return null;
  const i = ((state.cardIndex % state.cards.length) + state.cards.length) % state.cards.length;
  return state.cards[i];
}

function renderCards() {
  mountCards($('cards'), state.cards, state.cardIndex, {
    onSave: (c) => {
      saveCard(c);
      setStatus($('status'), `已收藏 ${c.word}`, 'ok');
    },
  });
}

function shiftCard(delta) {
  if (!state.cards.length) return;
  state.cardIndex = (state.cardIndex + delta + state.cards.length) % state.cards.length;
  renderCards();
  setHud($('hud'), `HUD · ${currentCard()?.word || ''}`);
}

function setMode(/** @type {Mode} */ mode) {
  state.mode = mode;
  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
  });
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    panel.hidden = panel.getAttribute('data-panel') !== mode;
  });
  refreshGate();
}

/** @type {ReturnType<typeof setupHeadband> | null} */
let headband = null;

function outputActions() {
  return {
    extract: () => doExtract(),
    next: () => shiftCard(1),
    prev: () => shiftCard(-1),
    getCard: () => currentCard(),
    getStatus: () => $('status')?.textContent || '',
    canExtract: () => gateOpen(),
    setHud: (t) => setHud($('hud'), t),
  };
}

function wireUi() {
  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setMode(/** @type {Mode} */ (btn.getAttribute('data-mode'))));
  });

  $('btn-extract')?.addEventListener('click', () => doExtract());
  $('btn-prev')?.addEventListener('click', () => shiftCard(-1));
  $('btn-next')?.addEventListener('click', () => shiftCard(1));
  $('btn-read')?.addEventListener('click', () => speakCard(currentCard()));
  $('btn-stop')?.addEventListener('click', () => stopSpeak());

  $('paste-text')?.addEventListener('input', (e) => {
    pasteSrc.setText(/** @type {HTMLTextAreaElement} */ (e.target).value);
    if (state.mode === 'paste') refreshGate();
  });

  $('input-paste-image')?.addEventListener('change', async (e) => {
    const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
    if (!file) return;
    state.busy = true;
    refreshGate();
    try {
      await ensureOcr();
      await pasteSrc.setImage(file);
      setMode('paste');
    } catch (err) {
      setStatus($('status'), err?.message || '图片 OCR 失败', 'warn');
    } finally {
      state.busy = false;
      refreshGate();
    }
  });

  $('btn-share')?.addEventListener('click', async () => {
    state.busy = true;
    refreshGate();
    try {
      await ensureOcr();
      await screenSrc.startShare(state.ocrFn);
      setMode('screen');
      setStatus($('status'), '屏幕共享中…', 'ok');
    } catch (err) {
      setStatus($('status'), err?.message || '屏幕共享失败', 'warn');
    } finally {
      state.busy = false;
      refreshGate();
    }
  });

  $('input-screenshot')?.addEventListener('change', async (e) => {
    const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
    if (!file) return;
    state.busy = true;
    refreshGate();
    try {
      await ensureOcr();
      await screenSrc.setScreenshot(file, state.ocrFn);
      setMode('screen');
    } catch (err) {
      setStatus($('status'), err?.message || '截图 OCR 失败', 'warn');
    } finally {
      state.busy = false;
      refreshGate();
    }
  });

  $('input-srt')?.addEventListener('change', async (e) => {
    const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
    if (!file) return;
    const raw = await file.text();
    const n = srtSrc.load(raw);
    const scrub = /** @type {HTMLInputElement} */ ($('srt-scrub'));
    if (scrub) {
      scrub.max = String(Math.max(1, srtSrc.duration()));
      scrub.value = '0';
    }
    setMode('srt');
    setStatus($('status'), `已加载 ${n} 条字幕`, n > 0 ? 'ok' : 'warn');
    refreshGate();
  });

  $('input-video')?.addEventListener('change', (e) => {
    const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
    const video = /** @type {HTMLVideoElement} */ ($('local-video'));
    if (!file || !video) return;
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      const scrub = /** @type {HTMLInputElement} */ ($('srt-scrub'));
      if (scrub) scrub.max = String(Math.ceil(video.duration || srtSrc.duration() || 1));
    };
    video.ontimeupdate = () => {
      srtSrc.setTime(video.currentTime);
      const scrub = /** @type {HTMLInputElement} */ ($('srt-scrub'));
      if (scrub) scrub.value = String(video.currentTime);
      if ($('srt-time')) $('srt-time').textContent = `${video.currentTime.toFixed(1)}s`;
      if (state.mode === 'srt') refreshGate();
    };
  });

  $('srt-scrub')?.addEventListener('input', (e) => {
    const t = Number(/** @type {HTMLInputElement} */ (e.target).value);
    srtSrc.setTime(t);
    const video = /** @type {HTMLVideoElement} */ ($('local-video'));
    if (video?.src) video.currentTime = t;
    if ($('srt-time')) $('srt-time').textContent = `${t.toFixed(1)}s`;
    if (state.mode === 'srt') refreshGate();
  });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'e' || e.key === 'E') doExtract();
    if (e.key === 'ArrowLeft') shiftCard(-1);
    if (e.key === 'ArrowRight') shiftCard(1);
    if (e.key === 'r' || e.key === 'R') speakCard(currentCard());
  });

  setInterval(() => {
    if (state.mode === 'screen' && screenSrc.ready && !state.busy) refreshGate();
  }, 800);
}

function wireWearable() {
  const wear = new WearableInput({
    onGesture(name) {
      if (name === 'shake' || name === 'tap') {
        doExtract();
        return;
      }
      if (name === 'tilt_left') shiftCard(-1);
      if (name === 'tilt_right') shiftCard(1);
      if (name === 'tilt_up') speakCard(currentCard());
    },
    onBadge(kind, text, active) {
      const el = $(`${kind}-badge`);
      if (!el) return;
      el.textContent = text;
      el.classList.toggle('on', active);
    },
  });
  wear.setup();
}

function wireSmartOutputs() {
  const actions = outputActions();
  if (isGlassesMode()) document.body.classList.add('glasses');

  const hp = setupHeadphones(actions);
  $('out-headphones')?.classList.toggle('on', hp.active);

  const glassesVoice = setupVoiceCommands(actions, { label: '眼镜' });
  $('out-glasses')?.addEventListener('click', () => {
    if (!glassesVoice.active) return;
    glassesVoice.start();
    $('out-glasses')?.classList.add('on');
  });

  headband = setupHeadband(actions);
  $('out-headband')?.addEventListener('click', () => {
    if (!headband?.active) return;
    headband.start();
    $('out-headband')?.classList.add('on');
    headband.readDefinition();
  });
}

function init() {
  // Hide non-active panels initially
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    panel.hidden = panel.getAttribute('data-panel') !== 'paste';
  });
  wireUi();
  wireWearable();
  wireSmartOutputs();
  setMode('paste');
  renderCards();
  refreshGate();
}

init();
