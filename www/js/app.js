// src/subtitle-detect.js
var UI_NOISE = /^(play|pause|settings|share|subscribe|like|home|menu|ok|cancel|skip|next|prev|back)$/i;
function detectSubtitle(line) {
  if (!line || typeof line.text !== "string") return false;
  const text = line.text.replace(/\s+/g, " ").trim();
  if (text.length < 4 || text.length > 120) return false;
  if (!/[A-Za-z]/.test(text)) return false;
  if (/^\d+([:./]\d+)*$/.test(text)) return false;
  if (UI_NOISE.test(text)) return false;
  if (typeof line.confidence === "number" && line.confidence < 0.35) return false;
  const letters = (text.match(/[A-Za-z]/g) || []).join("").length;
  if (letters / text.replace(/\s/g, "").length < 0.4) return false;
  return true;
}
function canExtract(opts) {
  if (!opts || opts.busy) return false;
  if (!opts.sourceReady) return false;
  return detectSubtitle(opts.line);
}
function statusLabel(s) {
  if (s.busy) return "\u5904\u7406\u4E2D\u2026";
  if (s.canExtract) return "\u53EF\u53D6\u8BCD";
  return s.reason || "\u65E0\u5B57\u5E55";
}

// src/wearable-input.js
var WearableInput = class {
  /**
   * @param {{
   *   onGesture: (gesture: string, detail?: object) => void,
   *   onBadge?: (kind: string, text: string, active: boolean) => void
   * }} opts
   */
  constructor(opts) {
    this.onGesture = opts.onGesture;
    this.onBadge = opts.onBadge ?? (() => {
    });
    this.ringActive = false;
    this.caneActive = false;
    this.ringFrame = 0;
    this.caneFrame = 0;
    this.ringPrevBeta = null;
    this.ringPrevGamma = null;
    this.caneLastAccel = { x: 0, y: 0, z: 0 };
    this.lastHitAt = 0;
  }
  setup() {
    this.setupRing();
    this.setupCane();
  }
  setupRing() {
    if (typeof DeviceOrientationEvent === "undefined") return;
    this.onBadge("ring", "\u6212\u6307 \xB7 \u70B9\u51FB\u542F\u7528", false);
    const enable = async () => {
      try {
        if (typeof DeviceOrientationEvent.requestPermission === "function") {
          const perm = await DeviceOrientationEvent.requestPermission();
          if (perm !== "granted") return;
        }
        this.ringActive = true;
        this.onBadge("ring", "\u6212\u6307 \xB7 \u5DF2\u8FDE\u63A5", true);
        window.addEventListener("deviceorientation", (e) => this.handleRing(e));
      } catch {
        this.onBadge("ring", "\u6212\u6307 \xB7 \u4E0D\u652F\u6301", false);
      }
    };
    document.getElementById("ring-badge")?.addEventListener("click", enable, { once: true });
    if (typeof DeviceOrientationEvent.requestPermission !== "function") enable();
  }
  setupCane() {
    if (typeof DeviceMotionEvent === "undefined") return;
    this.onBadge("cane", "\u624B\u6756 \xB7 \u70B9\u51FB\u542F\u7528", false);
    const enable = async () => {
      try {
        if (typeof DeviceMotionEvent.requestPermission === "function") {
          const perm = await DeviceMotionEvent.requestPermission();
          if (perm !== "granted") return;
        }
        this.caneActive = true;
        this.onBadge("cane", "\u624B\u6756 \xB7 \u5DF2\u8FDE\u63A5", true);
        window.addEventListener("devicemotion", (e) => this.handleCane(e));
      } catch {
        this.onBadge("cane", "\u624B\u6756 \xB7 \u4E0D\u652F\u6301", false);
      }
    };
    document.getElementById("cane-badge")?.addEventListener("click", enable, { once: true });
    if (typeof DeviceMotionEvent.requestPermission !== "function") enable();
  }
  handleRing(e) {
    if (!this.ringActive) return;
    this.ringFrame++;
    if (this.ringFrame % 8 !== 0) return;
    const beta = e.beta || 0;
    const gamma = e.gamma || 0;
    if (this.ringPrevBeta === null) {
      this.ringPrevBeta = beta;
      this.ringPrevGamma = gamma;
      return;
    }
    const dBeta = beta - this.ringPrevBeta;
    const dGamma = gamma - this.ringPrevGamma;
    this.ringPrevBeta = beta;
    this.ringPrevGamma = gamma;
    if (Math.abs(dBeta) > 20 || Math.abs(dGamma) > 20) {
      this.onGesture("shake", { dBeta, dGamma });
      return;
    }
    if (gamma > 5) this.onGesture("tilt_right", { gamma });
    else if (gamma < -5) this.onGesture("tilt_left", { gamma });
    if (beta > 5) this.onGesture("tilt_up", { beta });
    else if (beta < -5) this.onGesture("tilt_down", { beta });
  }
  handleCane(e) {
    if (!this.caneActive) return;
    this.caneFrame++;
    if (this.caneFrame % 6 !== 0) return;
    const a = e.accelerationIncludingGravity || e.acceleration || { x: 0, y: 0, z: 0 };
    const dax = Math.abs((a.x || 0) - this.caneLastAccel.x);
    const day = Math.abs((a.y || 0) - this.caneLastAccel.y);
    const daz = Math.abs((a.z || 0) - this.caneLastAccel.z);
    this.caneLastAccel = { x: a.x || 0, y: a.y || 0, z: a.z || 0 };
    if (dax > 8 || day > 8 || daz > 8) {
      const now = Date.now();
      if (now - this.lastHitAt < 200) return;
      this.lastHitAt = now;
      this.onGesture("tap", { spike: Math.max(dax, day, daz) });
    }
  }
};

// src/sources/paste-source.js
var PasteSource = class {
  constructor() {
    this.text = "";
    this.ready = false;
    this._confidence = 1;
    this.ocrFn = null;
  }
  /** @param {string} text */
  setText(text) {
    this.text = (text || "").replace(/\s+/g, " ").trim();
    this.ready = this.text.length > 0;
  }
  /**
   * @param {File|Blob} file
   * @param {(img: HTMLImageElement | HTMLCanvasElement | string) => Promise<{ text: string, confidence: number }>} [ocrFn]
   */
  async setImage(file, ocrFn) {
    const run = ocrFn || this.ocrFn;
    if (!run) throw new Error("OCR \u672A\u5C31\u7EEA");
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const band = cropSubtitleBand(img);
      const result = await run(band);
      this.setText(result.text || "");
      this._confidence = typeof result.confidence === "number" ? result.confidence : 0.6;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  /** @returns {{ text: string, confidence: number, source: string } | null} */
  getCurrentLine() {
    if (!this.ready) return null;
    return {
      text: this.text,
      confidence: this._confidence ?? 1,
      source: "paste"
    };
  }
};
function cropSubtitleBand(img, bandRatio = 0.28) {
  const w = (
    /** @type {any} */
    img.naturalWidth || img.width
  );
  const h = (
    /** @type {any} */
    img.naturalHeight || img.height
  );
  const bandH = Math.max(1, Math.floor(h * bandRatio));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = bandH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, h - bandH, w, bandH, 0, 0, w, bandH);
  return canvas;
}
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("\u56FE\u7247\u52A0\u8F7D\u5931\u8D25"));
    img.src = url;
  });
}

// src/sources/screen-ocr.js
var ScreenOcrSource = class {
  constructor() {
    this.stream = null;
    this.video = null;
    this.lastText = "";
    this.lastConfidence = 0;
    this.ready = false;
    this.ocrFn = null;
    this._pollTimer = null;
  }
  /**
   * @param {(img: HTMLCanvasElement | HTMLImageElement | string) => Promise<{ text: string, confidence: number }>} [ocrFn]
   */
  async startShare(ocrFn) {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("\u6B64\u8BBE\u5907\u4E0D\u652F\u6301\u5C4F\u5E55\u5171\u4EAB\uFF0C\u8BF7\u6539\u7528\u622A\u56FE\u6216\u7C98\u8D34");
    }
    this.ocrFn = ocrFn || this.ocrFn;
    this.stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 2 },
      audio: false
    });
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = this.stream;
    await this.video.play();
    this.ready = true;
    this.stream.getVideoTracks()[0]?.addEventListener("ended", () => this.stop());
    this._startPoll();
  }
  stop() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    this.ready = false;
    this.lastText = "";
  }
  _startPoll() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = setInterval(() => {
      this.captureOnce().catch(() => {
      });
    }, 2500);
  }
  async captureOnce() {
    if (!this.video || !this.ocrFn) return null;
    const v = this.video;
    if (!v.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(v, 0, 0);
    const band = cropSubtitleBand(canvas);
    const result = await this.ocrFn(band);
    this.lastText = (result.text || "").replace(/\s+/g, " ").trim();
    this.lastConfidence = typeof result.confidence === "number" ? result.confidence : 0.5;
    this.ready = true;
    return this.getCurrentLine();
  }
  /**
   * Mobile path: pick a screenshot file.
   * @param {File|Blob} file
   * @param {(img: HTMLCanvasElement | HTMLImageElement | string) => Promise<{ text: string, confidence: number }>} [ocrFn]
   */
  async setScreenshot(file, ocrFn) {
    const run = ocrFn || this.ocrFn;
    if (!run) throw new Error("OCR \u672A\u5C31\u7EEA");
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("\u622A\u56FE\u52A0\u8F7D\u5931\u8D25"));
        el.src = url;
      });
      const band = cropSubtitleBand(img);
      const result = await run(band);
      this.lastText = (result.text || "").replace(/\s+/g, " ").trim();
      this.lastConfidence = typeof result.confidence === "number" ? result.confidence : 0.5;
      this.ready = this.lastText.length > 0;
      return this.getCurrentLine();
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  /** @returns {{ text: string, confidence: number, source: string } | null} */
  getCurrentLine() {
    if (!this.ready || !this.lastText) return null;
    return {
      text: this.lastText,
      confidence: this.lastConfidence,
      source: "screen"
    };
  }
};
async function createTesseractOcr() {
  if (typeof window === "undefined") {
    throw new Error("OCR \u4EC5\u5728\u6D4F\u89C8\u5668\u53EF\u7528");
  }
  if (!window.Tesseract) {
    await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
  }
  const Tesseract = window.Tesseract;
  return async (img) => {
    const { data } = await Tesseract.recognize(img, "eng", {
      logger: () => {
      }
    });
    const conf = typeof data.confidence === "number" ? data.confidence / 100 : 0.5;
    return { text: data.text || "", confidence: conf };
  };
}
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Tesseract \u52A0\u8F7D\u5931\u8D25"));
    document.head.appendChild(s);
  });
}

// src/sources/srt-player.js
function parseSubtitles(raw) {
  if (!raw || typeof raw !== "string") return [];
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (/WEBVTT/i.test(text.slice(0, 20))) return parseVtt(text);
  return parseSrt(text);
}
function parseSrt(text) {
  const blocks = text.split(/\n\s*\n/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    let i = 0;
    if (/^\d+$/.test(lines[0])) i = 1;
    const m = lines[i]?.match(
      /(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/
    );
    if (!m) continue;
    const start = parseTimestamp(m[1]);
    const end = parseTimestamp(m[2]);
    const body = lines.slice(i + 1).join(" ").replace(/<[^>]+>/g, "").trim();
    if (body) cues.push({ start, end, text: body });
  }
  return cues;
}
function parseVtt(text) {
  const blocks = text.split(/\n\s*\n/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length || /^WEBVTT/i.test(lines[0]) || /^NOTE\b/i.test(lines[0])) continue;
    let i = 0;
    if (!/-->/.test(lines[0]) && lines[1] && /-->/.test(lines[1])) i = 1;
    const m = lines[i]?.match(
      /(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})/
    );
    if (!m) continue;
    const start = parseTimestamp(m[1]);
    const end = parseTimestamp(m[2]);
    const body = lines.slice(i + 1).join(" ").replace(/<[^>]+>/g, "").trim();
    if (body) cues.push({ start, end, text: body });
  }
  return cues;
}
function parseTimestamp(ts) {
  const norm = ts.replace(",", ".");
  const parts = norm.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}
var SrtPlayer = class {
  constructor() {
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
    return { text: cue.text, confidence: 1, source: "srt" };
  }
  duration() {
    if (!this.cues.length) return 0;
    return this.cues[this.cues.length - 1].end;
  }
};

// src/vocab/pick.js
var STOPWORDS = new Set(
  `a an the and or but if in on at to for of as is was are were be been being
  it this that these those i you he she we they me him her us them my your his
  their our with from by not no so do does did have has had will would can could
  should may might must just about into over out up down off then than too very
  also only own same such both each few more most other some such than too
  what which who whom when where why how all any both each few more most other
  some such than too very can will just don should now am im youre theyre theres
  dont doesnt didnt isnt arent wasnt werent havent hasnt hadnt wont wouldnt
  cant couldnt shouldnt`.split(/\s+/).filter(Boolean)
);
function pickWords(line, opts = {}) {
  const max = opts.max ?? 8;
  if (!line || typeof line !== "string") return [];
  const tokens = line.replace(/[“”"‘’]/g, "").split(/[^A-Za-z'-]+/).map((t) => t.trim()).filter(Boolean);
  const seen = /* @__PURE__ */ new Map();
  for (const tok of tokens) {
    const lower = tok.toLowerCase();
    if (lower.length < 3) continue;
    if (STOPWORDS.has(lower)) continue;
    if (/^\d+$/.test(lower)) continue;
    if (!seen.has(lower)) seen.set(lower, tok);
  }
  const ranked = [...seen.entries()].sort((a, b) => {
    const score = (w) => (w.length >= 5 && w.length <= 10 ? 2 : 0) + Math.min(w.length, 12) * 0.1;
    return score(b[0]) - score(a[0]);
  });
  return ranked.slice(0, Math.min(max, Math.max(3, ranked.length))).map(([, orig]) => orig);
}

// src/vocab/enrich.js
async function enrichVocab(word, sourceLine, opts = {}) {
  const fetchImpl = opts.fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
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
      ...first?.synonyms || [],
      ...def?.synonyms || []
    ].filter(Boolean).slice(0, 5);
    const definitionEn = def?.definition || "";
    const exampleEn = def?.example || sourceLine;
    return {
      word,
      definition: definitionEn ? `${definitionEn}\uFF08\u82F1\u91CA\u4E49\uFF1B\u53EF\u5BF9\u7167\u4E0A\u4E0B\u6587\u7406\u89E3\uFF09` : base.definition,
      example: exampleEn || base.example,
      synonyms: syns.length ? syns : base.synonyms,
      usage: usageFromPos(first?.partOfSpeech, word, sourceLine),
      sourceLine
    };
  } catch {
    return base;
  }
}
function fallbackCard(word, sourceLine) {
  return {
    word,
    definition: `\uFF08\u79BB\u7EBF\uFF09\u8BF7\u7ED3\u5408\u5B57\u5E55\u53E5\u7406\u89E3\u300C${word}\u300D\u7684\u542B\u4E49`,
    example: sourceLine || `I heard "${word}" in the subtitle.`,
    synonyms: [],
    usage: `\u5F71\u89C6/\u5BF9\u8BDD\u5B57\u5E55\u4E2D\u51FA\u73B0\uFF1B\u53EF\u5728\u53E3\u8BED\u6216\u5199\u4F5C\u4E2D\u66FF\u6362\u540C\u4E49\u8868\u8FBE\u7EC3\u4E60\u300C${word}\u300D\u3002`,
    sourceLine: sourceLine || ""
  };
}
function usageFromPos(pos, word, sourceLine) {
  const p = (pos || "").toLowerCase();
  if (p.includes("verb")) {
    return `\u52A8\u8BCD\u7528\u6CD5\uFF1A\u6CE8\u610F\u65F6\u6001\u4E0E\u642D\u914D\uFF1B\u5B57\u5E55\u53E5\uFF1A\u300C${sourceLine}\u300D`;
  }
  if (p.includes("noun")) {
    return `\u540D\u8BCD\u7528\u6CD5\uFF1A\u6CE8\u610F\u5355\u590D\u6570\u4E0E\u51A0\u8BCD\uFF1B\u5B57\u5E55\u53E5\uFF1A\u300C${sourceLine}\u300D`;
  }
  if (p.includes("adj")) {
    return `\u5F62\u5BB9\u8BCD\u7528\u6CD5\uFF1A\u53EF\u4FEE\u9970\u540D\u8BCD\u6216\u4F5C\u8868\u8BED\uFF1B\u5B57\u5E55\u53E5\uFF1A\u300C${sourceLine}\u300D`;
  }
  if (p.includes("adv")) {
    return `\u526F\u8BCD\u7528\u6CD5\uFF1A\u5E38\u4FEE\u9970\u52A8\u8BCD/\u5F62\u5BB9\u8BCD\uFF1B\u5B57\u5E55\u53E5\uFF1A\u300C${sourceLine}\u300D`;
  }
  return `\u5728\u5B57\u5E55\u8BED\u5883\u4E2D\u5B66\u4E60\u300C${word}\u300D\uFF1A${sourceLine}`;
}
var STORAGE_KEY = "screen-vocab-saved";
function saveCard(card) {
  const list = loadSaved();
  if (list.some((c) => c.word.toLowerCase() === card.word.toLowerCase())) return list;
  list.unshift(card);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
  }
  return list;
}
function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// src/ui.js
function setStatus(el, text, kind = "warn") {
  if (!el) return;
  el.textContent = text;
  el.classList.remove("status-ok", "status-warn", "status-busy");
  el.classList.add(`status-${kind}`);
}
function setExtractEnabled(btn, enabled) {
  if (!btn) return;
  btn.disabled = !enabled;
  btn.setAttribute("aria-disabled", enabled ? "false" : "true");
}
function setLinePreview(el, text) {
  if (!el) return;
  el.textContent = text || "\uFF08\u65E0\u5F53\u524D\u5B57\u5E55\uFF09";
}
function setHud(el, text) {
  if (!el) return;
  el.textContent = text;
}
function renderCard(card, index, total) {
  const syn = card.synonyms?.length ? card.synonyms.join(" \xB7 ") : "\uFF08\u6682\u65E0\uFF09";
  return `
    <article class="card" data-index="${index}">
      <header class="card-head">
        <h2 class="word">${escapeHtml(card.word)}</h2>
        <span class="card-meta">${index + 1}/${total}</span>
      </header>
      <div class="field"><h3>\u91CA\u4E49</h3><p>${escapeHtml(card.definition)}</p></div>
      <div class="field"><h3>\u4F8B\u53E5</h3><p>${escapeHtml(card.example)}</p></div>
      <div class="field"><h3>\u8FD1\u4E49\u8BCD</h3><p>${escapeHtml(syn)}</p></div>
      <div class="field"><h3>\u4F7F\u7528\u573A\u666F</h3><p>${escapeHtml(card.usage)}</p></div>
      <div class="field"><h3>\u51FA\u5904</h3><p>${escapeHtml(card.sourceLine)}</p></div>
      <div class="row">
        <button type="button" data-action="save">\u6536\u85CF</button>
      </div>
    </article>
  `;
}
function mountCards(mount, cards, index, handlers = {}) {
  if (!mount) return;
  if (!cards.length) {
    mount.innerHTML = '<p class="empty">\u53D6\u8BCD\u540E\u8FD9\u91CC\u663E\u793A\u91CA\u4E49\u5361\u7247</p>';
    return;
  }
  const i = (index % cards.length + cards.length) % cards.length;
  const card = cards[i];
  mount.innerHTML = renderCard(card, i, cards.length);
  mount.querySelector('[data-action="save"]')?.addEventListener("click", () => handlers.onSave?.(card));
}
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// src/smart-outputs.js
function isGlassesMode() {
  if (typeof window === "undefined") return false;
  const w = Math.min(window.innerWidth, screen.width || 9999);
  const h = Math.min(window.innerHeight, screen.height || 9999);
  return w <= 420 && h <= 340 || w <= 340 && h <= 420 || (w <= 280 || h <= 300);
}
function speak(text, opts = {}) {
  if (typeof speechSynthesis === "undefined" || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = opts.lang || "zh-CN";
  u.rate = opts.rate ?? 0.95;
  speechSynthesis.speak(u);
}
function stopSpeak() {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}
function speakCard(card) {
  if (!card) return;
  stopSpeak();
  if (typeof speechSynthesis === "undefined") return;
  const w = new SpeechSynthesisUtterance(card.word);
  w.lang = "en-US";
  w.rate = 0.9;
  const d = new SpeechSynthesisUtterance(card.definition);
  d.lang = "zh-CN";
  d.rate = 0.95;
  speechSynthesis.speak(w);
  speechSynthesis.speak(d);
}
function setupHeadphones(actions) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
    return { active: false };
  }
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "\u5C4F\u8BCD",
      artist: "Screen Vocab",
      album: "\u53D6\u8BCD"
    });
    navigator.mediaSession.setActionHandler("previoustrack", () => actions.prev());
    navigator.mediaSession.setActionHandler("nexttrack", () => actions.next());
    navigator.mediaSession.setActionHandler("play", () => {
      speakCard(actions.getCard());
    });
    navigator.mediaSession.setActionHandler("pause", () => stopSpeak());
    return { active: true };
  } catch {
    return { active: false };
  }
}
function parseVoiceCommand(text) {
  const t = (text || "").trim().toLowerCase();
  if (!t) return null;
  if (/取词|提取|extract|capture|抓词/.test(t)) return "extract";
  if (/下一个|下一|next|往后/.test(t)) return "next";
  if (/上一个|上一|prev|previous|往前/.test(t)) return "prev";
  if (/朗读|读出来|读一下|speak|read|播放|释义/.test(t)) return "read";
  if (/停止|停|stop|暂停/.test(t)) return "stop";
  return null;
}
function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}
function setupVoiceCommands(actions, opts = {}) {
  const SR = getSpeechRecognition();
  if (!SR) {
    return {
      active: false,
      start() {
      },
      stop() {
      }
    };
  }
  const rec = new SR();
  rec.lang = "zh-CN";
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
      } catch {
      }
    }
  };
  return {
    active: true,
    start() {
      running = true;
      try {
        rec.start();
        actions.setHud?.(`${opts.label || "\u8BED\u97F3"} \xB7 \u8046\u542C\u4E2D`);
      } catch {
      }
    },
    stop() {
      running = false;
      try {
        rec.stop();
      } catch {
      }
    }
  };
}
function dispatchVoice(cmd, actions) {
  switch (cmd) {
    case "extract":
      if (actions.canExtract()) actions.extract();
      break;
    case "next":
      actions.next();
      break;
    case "prev":
      actions.prev();
      break;
    case "read":
      speakCard(actions.getCard());
      break;
    case "stop":
      stopSpeak();
      break;
    default:
      break;
  }
}
function setupHeadband(actions) {
  const voice = setupVoiceCommands(actions, { label: "\u5934\u5E26", continuous: true });
  return {
    ...voice,
    /** Read definition of current card (headband output). */
    readDefinition() {
      const card = actions.getCard();
      if (!card) return;
      speak(card.definition, { lang: "zh-CN" });
    },
    /** After extract, optionally auto-read first card. */
    onExtracted(card) {
      if (card) speak(`${card.word}\u3002${card.definition}`, { lang: "zh-CN" });
    }
  };
}

// src/device-profile.js
var ALL_KINDS = [
  "iphone",
  "ipad",
  "ipod",
  "mac",
  "applewatch",
  "appletv",
  "vision",
  "android-phone",
  "android-tablet",
  "wearos",
  "android-tv",
  "chromeos",
  "foldable",
  "other"
];
var ALL_FORMS = ["phone", "tablet", "watch", "tv", "desktop", "foldable", "other"];
var ALL_FAMILIES = ["apple", "android", "other"];
function detectDeviceProfile(env = {}) {
  const hasWindow = typeof window !== "undefined";
  const hasNav = typeof navigator !== "undefined";
  const synthetic = Object.keys(env).length > 0;
  const ua = env.userAgent ?? (synthetic ? "" : hasNav ? navigator.userAgent : "") ?? "";
  const platform = env.platform ?? (synthetic ? "" : hasNav ? navigator.platform : "") ?? "";
  const maxTouchPoints = env.maxTouchPoints ?? (synthetic ? 0 : hasNav ? navigator.maxTouchPoints || 0 : 0);
  const width = env.width ?? (synthetic ? 0 : hasWindow ? Math.min(window.innerWidth, screen.width || window.innerWidth) : 0);
  const height = env.height ?? (synthetic ? 0 : hasWindow ? Math.min(window.innerHeight, screen.height || window.innerHeight) : 0);
  const foldSegments = env.foldSegments ?? (!synthetic && hasWindow && typeof window.matchMedia === "function" && (window.matchMedia("(horizontal-viewport-segments: 2)").matches || window.matchMedia("(vertical-viewport-segments: 2)").matches));
  if (!ua && !width && !height && (synthetic || !hasWindow)) {
    return profile("other", "other", "other");
  }
  const minSide = Math.min(width || 9999, height || 9999);
  const maxSide = Math.max(width || 0, height || 0);
  const isAndroid = /Android/i.test(ua);
  const isAppleMobile = /iPhone|iPad|iPod/i.test(ua);
  if (/Watch|Wear ?OS|Android Wear|SM-R|Pixel Watch/i.test(ua) || width > 0 && height > 0 && (width <= 280 || height <= 300 || maxSide <= 400 && minSide <= 240)) {
    if (isAndroid || /Wear/i.test(ua)) return profile("android", "watch", "wearos");
    return profile("apple", "watch", "applewatch");
  }
  if (/Apple ?TV|TVOS|AppleTV/i.test(ua)) return profile("apple", "tv", "appletv");
  if (/Vision|xrOS|Reality/i.test(ua)) return profile("apple", "desktop", "vision");
  if (/Android TV|SMART-TV|SmartTV|BRAVIA|AFT[A-Z]|GoogleTV|MIBOX|TV Box/i.test(ua) || /Android/i.test(ua) && /TV/i.test(ua) && minSide >= 540) {
    return profile("android", "tv", "android-tv");
  }
  if (foldSegments || /Fold|Z Fold|Surface Duo|Galaxy Z|hinge/i.test(ua) || width > 0 && height > 0 && maxSide / Math.max(minSide, 1) >= 2.1 && minSide >= 500) {
    if (isAndroid || !isAppleMobile) return profile("android", "foldable", "foldable");
  }
  if (/CrOS|Chromebook/i.test(ua)) return profile("android", "desktop", "chromeos");
  if (/iPod/i.test(ua)) return profile("apple", "phone", "ipod");
  if (/iPad/i.test(ua)) return profile("apple", "tablet", "ipad");
  if (/iPhone/i.test(ua)) return profile("apple", "phone", "iphone");
  const isMacUa = /Macintosh|Mac OS X|MacIntel/i.test(ua) || /Mac/i.test(platform);
  if (isMacUa && maxTouchPoints > 1) return profile("apple", "tablet", "ipad");
  if (isMacUa) return profile("apple", "desktop", "mac");
  if (isAndroid) {
    if (minSide >= 600 || minSide >= 560 && maxSide >= 900) {
      return profile("android", "tablet", "android-tablet");
    }
    return profile("android", "phone", "android-phone");
  }
  if (maxTouchPoints === 0 && minSide >= 700 && maxSide >= 1e3) {
    return profile("other", "desktop", "chromeos");
  }
  if (minSide >= 744 || minSide >= 600 && maxSide >= 900) {
    return profile("other", "tablet", "android-tablet");
  }
  if (width > 0 && minSide >= 320 && maxSide < 900) {
    return profile("other", "phone", "android-phone");
  }
  return profile("other", "other", "other");
}
function profile(family, form, kind) {
  return { family, form, kind, label: deviceLabel(kind) };
}
function deviceLabel(kind) {
  switch (kind) {
    case "iphone":
      return "iPhone";
    case "ipad":
      return "iPad";
    case "ipod":
      return "iPod";
    case "mac":
      return "MacBook";
    case "applewatch":
      return "Apple Watch";
    case "appletv":
      return "Apple TV";
    case "vision":
      return "Vision";
    case "android-phone":
      return "\u5B89\u5353\u624B\u673A";
    case "android-tablet":
      return "\u5B89\u5353\u5E73\u677F";
    case "wearos":
      return "Wear OS";
    case "android-tv":
      return "Android TV";
    case "chromeos":
      return "ChromeOS";
    case "foldable":
      return "\u6298\u53E0\u5C4F";
    default:
      return "\u8BBE\u5907";
  }
}
function applyDeviceProfile() {
  const p = detectDeviceProfile();
  if (typeof document === "undefined") return p;
  const body = document.body;
  ALL_FAMILIES.forEach((f) => body.classList.remove(`eco-${f}`));
  ALL_FORMS.forEach((f) => body.classList.remove(`form-${f}`));
  ALL_KINDS.forEach((k) => body.classList.remove(`device-${k}`));
  body.classList.remove("device-watch", "watch");
  body.classList.add(`eco-${p.family}`, `form-${p.form}`, `device-${p.kind}`);
  body.dataset.eco = p.family;
  body.dataset.form = p.form;
  body.dataset.device = p.kind;
  if (p.form === "watch") {
    body.classList.add("device-watch", "watch");
  }
  return p;
}

// src/app.js
var state = {
  /** @type {Mode} */
  mode: "paste",
  busy: false,
  /** @type {import('./vocab/enrich.js').VocabCard[]} */
  cards: [],
  cardIndex: 0,
  ocrFn: null
};
var screenSrc = new ScreenOcrSource();
var srtSrc = new SrtPlayer();
var pasteSrc = new PasteSource();
var $ = (id) => document.getElementById(id);
function activeSource() {
  if (state.mode === "screen") return screenSrc;
  if (state.mode === "srt") return srtSrc;
  return pasteSrc;
}
function sourceReadyFlag() {
  if (state.mode === "screen") return screenSrc.ready;
  if (state.mode === "srt") return srtSrc.ready;
  return pasteSrc.ready;
}
function currentLine() {
  return activeSource().getCurrentLine();
}
function gateOpen() {
  return canExtract({
    line: currentLine(),
    sourceReady: sourceReadyFlag(),
    busy: state.busy
  });
}
function refreshGate() {
  const line = currentLine();
  const open = gateOpen();
  const reason = !sourceReadyFlag() ? "\u6E90\u672A\u5C31\u7EEA" : line && !detectSubtitle(line) ? "\u672A\u8BC6\u522B\u4E3A\u5B57\u5E55" : "\u65E0\u5B57\u5E55";
  const label = statusLabel({ canExtract: open, busy: state.busy, reason });
  const kind = state.busy ? "busy" : open ? "ok" : "warn";
  setStatus($("status"), label, kind);
  setExtractEnabled(
    /** @type {HTMLButtonElement} */
    $("btn-extract"),
    open && !state.busy
  );
  setLinePreview($("line-preview"), line?.text || "");
  setHud($("hud"), open ? `HUD \xB7 \u53EF\u53D6\u8BCD \xB7 ${line?.source || ""}` : `HUD \xB7 ${label}`);
}
async function ensureOcr() {
  if (state.ocrFn) return state.ocrFn;
  setStatus($("status"), "\u52A0\u8F7D OCR\u2026", "busy");
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
      setStatus($("status"), "\u65E0\u53EF\u53D6\u5B9E\u8BCD", "warn");
      return;
    }
    const cards = [];
    for (const w of words) {
      cards.push(await enrichVocab(w, line.text));
    }
    state.cards = cards;
    state.cardIndex = 0;
    renderCards();
    setStatus($("status"), `\u5DF2\u53D6 ${cards.length} \u8BCD`, "ok");
    setHud($("hud"), `HUD \xB7 \u5DF2\u53D6 ${cards[0].word}`);
    headband?.onExtracted?.(cards[0]);
  } finally {
    state.busy = false;
    refreshGate();
  }
}
function currentCard() {
  if (!state.cards.length) return null;
  const i = (state.cardIndex % state.cards.length + state.cards.length) % state.cards.length;
  return state.cards[i];
}
function renderCards() {
  mountCards($("cards"), state.cards, state.cardIndex, {
    onSave: (c) => {
      saveCard(c);
      setStatus($("status"), `\u5DF2\u6536\u85CF ${c.word}`, "ok");
    }
  });
}
function shiftCard(delta) {
  if (!state.cards.length) return;
  state.cardIndex = (state.cardIndex + delta + state.cards.length) % state.cards.length;
  renderCards();
  setHud($("hud"), `HUD \xB7 ${currentCard()?.word || ""}`);
}
function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-mode") === mode);
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.getAttribute("data-panel") !== mode;
  });
  refreshGate();
}
var headband = null;
function outputActions() {
  return {
    extract: () => doExtract(),
    next: () => shiftCard(1),
    prev: () => shiftCard(-1),
    getCard: () => currentCard(),
    getStatus: () => $("status")?.textContent || "",
    canExtract: () => gateOpen(),
    setHud: (t) => setHud($("hud"), t)
  };
}
function wireUi() {
  document.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => setMode(
      /** @type {Mode} */
      btn.getAttribute("data-mode")
    ));
  });
  $("btn-extract")?.addEventListener("click", () => doExtract());
  $("btn-prev")?.addEventListener("click", () => shiftCard(-1));
  $("btn-next")?.addEventListener("click", () => shiftCard(1));
  $("btn-read")?.addEventListener("click", () => speakCard(currentCard()));
  $("btn-stop")?.addEventListener("click", () => stopSpeak());
  $("paste-text")?.addEventListener("input", (e) => {
    pasteSrc.setText(
      /** @type {HTMLTextAreaElement} */
      e.target.value
    );
    if (state.mode === "paste") refreshGate();
  });
  $("input-paste-image")?.addEventListener("change", async (e) => {
    const file = (
      /** @type {HTMLInputElement} */
      e.target.files?.[0]
    );
    if (!file) return;
    state.busy = true;
    refreshGate();
    try {
      await ensureOcr();
      await pasteSrc.setImage(file);
      setMode("paste");
    } catch (err) {
      setStatus($("status"), err?.message || "\u56FE\u7247 OCR \u5931\u8D25", "warn");
    } finally {
      state.busy = false;
      refreshGate();
    }
  });
  $("btn-share")?.addEventListener("click", async () => {
    state.busy = true;
    refreshGate();
    try {
      await ensureOcr();
      await screenSrc.startShare(state.ocrFn);
      setMode("screen");
      setStatus($("status"), "\u5C4F\u5E55\u5171\u4EAB\u4E2D\u2026", "ok");
    } catch (err) {
      setStatus($("status"), err?.message || "\u5C4F\u5E55\u5171\u4EAB\u5931\u8D25", "warn");
    } finally {
      state.busy = false;
      refreshGate();
    }
  });
  $("input-screenshot")?.addEventListener("change", async (e) => {
    const file = (
      /** @type {HTMLInputElement} */
      e.target.files?.[0]
    );
    if (!file) return;
    state.busy = true;
    refreshGate();
    try {
      await ensureOcr();
      await screenSrc.setScreenshot(file, state.ocrFn);
      setMode("screen");
    } catch (err) {
      setStatus($("status"), err?.message || "\u622A\u56FE OCR \u5931\u8D25", "warn");
    } finally {
      state.busy = false;
      refreshGate();
    }
  });
  $("input-srt")?.addEventListener("change", async (e) => {
    const file = (
      /** @type {HTMLInputElement} */
      e.target.files?.[0]
    );
    if (!file) return;
    const raw = await file.text();
    const n = srtSrc.load(raw);
    const scrub = (
      /** @type {HTMLInputElement} */
      $("srt-scrub")
    );
    if (scrub) {
      scrub.max = String(Math.max(1, srtSrc.duration()));
      scrub.value = "0";
    }
    setMode("srt");
    setStatus($("status"), `\u5DF2\u52A0\u8F7D ${n} \u6761\u5B57\u5E55`, n > 0 ? "ok" : "warn");
    refreshGate();
  });
  $("input-video")?.addEventListener("change", (e) => {
    const file = (
      /** @type {HTMLInputElement} */
      e.target.files?.[0]
    );
    const video = (
      /** @type {HTMLVideoElement} */
      $("local-video")
    );
    if (!file || !video) return;
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      const scrub = (
        /** @type {HTMLInputElement} */
        $("srt-scrub")
      );
      if (scrub) scrub.max = String(Math.ceil(video.duration || srtSrc.duration() || 1));
    };
    video.ontimeupdate = () => {
      srtSrc.setTime(video.currentTime);
      const scrub = (
        /** @type {HTMLInputElement} */
        $("srt-scrub")
      );
      if (scrub) scrub.value = String(video.currentTime);
      if ($("srt-time")) $("srt-time").textContent = `${video.currentTime.toFixed(1)}s`;
      if (state.mode === "srt") refreshGate();
    };
  });
  $("srt-scrub")?.addEventListener("input", (e) => {
    const t = Number(
      /** @type {HTMLInputElement} */
      e.target.value
    );
    srtSrc.setTime(t);
    const video = (
      /** @type {HTMLVideoElement} */
      $("local-video")
    );
    if (video?.src) video.currentTime = t;
    if ($("srt-time")) $("srt-time").textContent = `${t.toFixed(1)}s`;
    if (state.mode === "srt") refreshGate();
  });
  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === "e" || e.key === "E") doExtract();
    if (e.key === "ArrowLeft") shiftCard(-1);
    if (e.key === "ArrowRight") shiftCard(1);
    if (e.key === "r" || e.key === "R") speakCard(currentCard());
  });
  setInterval(() => {
    if (state.mode === "screen" && screenSrc.ready && !state.busy) refreshGate();
  }, 800);
}
function wireWearable() {
  const wear = new WearableInput({
    onGesture(name) {
      if (name === "shake" || name === "tap") {
        doExtract();
        return;
      }
      if (name === "tilt_left") shiftCard(-1);
      if (name === "tilt_right") shiftCard(1);
      if (name === "tilt_up") speakCard(currentCard());
    },
    onBadge(kind, text, active) {
      const el = $(`${kind}-badge`);
      if (!el) return;
      el.textContent = text;
      el.classList.toggle("on", active);
    }
  });
  wear.setup();
}
function wireSmartOutputs() {
  const actions = outputActions();
  if (isGlassesMode()) document.body.classList.add("glasses");
  const hp = setupHeadphones(actions);
  $("out-headphones")?.classList.toggle("on", hp.active);
  const glassesVoice = setupVoiceCommands(actions, { label: "\u773C\u955C" });
  $("out-glasses")?.addEventListener("click", () => {
    if (!glassesVoice.active) return;
    glassesVoice.start();
    $("out-glasses")?.classList.add("on");
  });
  headband = setupHeadband(actions);
  $("out-headband")?.addEventListener("click", () => {
    if (!headband?.active) return;
    headband.start();
    $("out-headband")?.classList.add("on");
    headband.readDefinition();
  });
}
function init() {
  const profile2 = applyDeviceProfile();
  const pill = $("device-pill");
  if (pill) pill.textContent = profile2.label;
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.getAttribute("data-panel") !== "paste";
  });
  wireUi();
  wireWearable();
  wireSmartOutputs();
  setMode("paste");
  renderCards();
  refreshGate();
  setHud($("hud"), `HUD \xB7 ${profile2.label} \xB7 \u7B49\u5F85\u5B57\u5E55`);
  window.addEventListener("resize", () => {
    const p = applyDeviceProfile();
    if (pill) pill.textContent = p.label;
  });
}
init();
//# sourceMappingURL=app.js.map
