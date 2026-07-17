/**
 * Output endpoints: headphones (TTS + MediaSession), glasses (voice + HUD),
 * headband (TTS readback + voice/gesture extract).
 * All extract actions must be gated by the caller via canExtract.
 */

/** @typedef {{
 *   extract: () => void | Promise<void>,
 *   next: () => void,
 *   prev: () => void,
 *   getCard: () => { word: string, definition: string, example?: string } | null,
 *   getStatus: () => string,
 *   canExtract: () => boolean,
 *   setHud?: (text: string) => void,
 * }} OutputActions */

export function isGlassesMode() {
  if (typeof window === 'undefined') return false;
  const w = Math.min(window.innerWidth, screen.width || 9999);
  const h = Math.min(window.innerHeight, screen.height || 9999);
  return (w <= 420 && h <= 340) || (w <= 340 && h <= 420) || (w <= 280 || h <= 300);
}

export function isWatchMode() {
  if (typeof window === 'undefined') return false;
  const w = Math.min(window.innerWidth, screen.width || 9999);
  const h = Math.min(window.innerHeight, screen.height || 9999);
  return w <= 280 || h <= 300;
}

/**
 * Speak text via Web Speech API (headphones / headband).
 * @param {string} text
 * @param {{ lang?: string, rate?: number }} [opts]
 */
export function speak(text, opts = {}) {
  if (typeof speechSynthesis === 'undefined' || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = opts.lang || 'zh-CN';
  u.rate = opts.rate ?? 0.95;
  speechSynthesis.speak(u);
}

export function stopSpeak() {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/**
 * Read current card aloud: word (en) then definition (zh-ish).
 * @param {{ word: string, definition: string, example?: string } | null} card
 */
export function speakCard(card) {
  if (!card) return;
  stopSpeak();
  if (typeof speechSynthesis === 'undefined') return;
  const w = new SpeechSynthesisUtterance(card.word);
  w.lang = 'en-US';
  w.rate = 0.9;
  const d = new SpeechSynthesisUtterance(card.definition);
  d.lang = 'zh-CN';
  d.rate = 0.95;
  speechSynthesis.speak(w);
  speechSynthesis.speak(d);
}

/**
 * Headphones: MediaSession line controls → prev / next / play(read).
 * @param {OutputActions} actions
 */
export function setupHeadphones(actions) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
    return { active: false };
  }
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: '屏词',
      artist: 'Screen Vocab',
      album: '取词',
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => actions.prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => actions.next());
    navigator.mediaSession.setActionHandler('play', () => {
      speakCard(actions.getCard());
    });
    navigator.mediaSession.setActionHandler('pause', () => stopSpeak());
    return { active: true };
  } catch {
    return { active: false };
  }
}

/**
 * @param {string} text
 * @returns {string|null}
 */
export function parseVoiceCommand(text) {
  const t = (text || '').trim().toLowerCase();
  if (!t) return null;
  if (/取词|提取|extract|capture|抓词/.test(t)) return 'extract';
  if (/下一个|下一|next|往后/.test(t)) return 'next';
  if (/上一个|上一|prev|previous|往前/.test(t)) return 'prev';
  if (/朗读|读出来|读一下|speak|read|播放|释义/.test(t)) return 'read';
  if (/停止|停|stop|暂停/.test(t)) return 'stop';
  return null;
}

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * Glasses / headband: continuous-ish voice commands.
 * Extract is only dispatched when actions.canExtract() is true (silent otherwise).
 * @param {OutputActions} actions
 * @param {{ continuous?: boolean, label?: string }} [opts]
 */
export function setupVoiceCommands(actions, opts = {}) {
  const SR = getSpeechRecognition();
  if (!SR) {
    return {
      active: false,
      start() {},
      stop() {},
    };
  }

  const rec = new SR();
  rec.lang = 'zh-CN';
  rec.continuous = opts.continuous !== false;
  rec.interimResults = false;

  let running = false;

  rec.onresult = (ev) => {
    const last = ev.results[ev.results.length - 1];
    if (!last?.isFinal) return;
    const cmd = parseVoiceCommand(last[0].transcript);
    if (!cmd) return;
    dispatchVoice(cmd, actions);
  };

  rec.onerror = () => {
    running = false;
  };

  rec.onend = () => {
    if (running) {
      try {
        rec.start();
      } catch { /* ignore */ }
    }
  };

  return {
    active: true,
    start() {
      running = true;
      try {
        rec.start();
        actions.setHud?.(`${opts.label || '语音'} · 聆听中`);
      } catch { /* ignore */ }
    },
    stop() {
      running = false;
      try {
        rec.stop();
      } catch { /* ignore */ }
    },
  };
}

/**
 * @param {string} cmd
 * @param {OutputActions} actions
 */
export function dispatchVoice(cmd, actions) {
  switch (cmd) {
    case 'extract':
      if (actions.canExtract()) actions.extract();
      break;
    case 'next':
      actions.next();
      break;
    case 'prev':
      actions.prev();
      break;
    case 'read':
      speakCard(actions.getCard());
      break;
    case 'stop':
      stopSpeak();
      break;
    default:
      break;
  }
}

/**
 * Headband: TTS readback of current definition + voice extract when gated.
 * @param {OutputActions} actions
 */
export function setupHeadband(actions) {
  const voice = setupVoiceCommands(actions, { label: '头带', continuous: true });
  return {
    ...voice,
    /** Read definition of current card (headband output). */
    readDefinition() {
      const card = actions.getCard();
      if (!card) return;
      speak(card.definition, { lang: 'zh-CN' });
    },
    /** After extract, optionally auto-read first card. */
    onExtracted(card) {
      if (card) speak(`${card.word}。${card.definition}`, { lang: 'zh-CN' });
    },
  };
}
