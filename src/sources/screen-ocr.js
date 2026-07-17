/**
 * Screen share (getDisplayMedia) + screenshot OCR → subtitle line.
 */

import { cropSubtitleBand } from './paste-source.js';

export class ScreenOcrSource {
  constructor() {
    /** @type {MediaStream | null} */
    this.stream = null;
    /** @type {HTMLVideoElement | null} */
    this.video = null;
    this.lastText = '';
    this.lastConfidence = 0;
    this.ready = false;
    /** @type {(img: HTMLCanvasElement | HTMLImageElement | string) => Promise<{ text: string, confidence: number }>} */
    this.ocrFn = null;
    this._pollTimer = null;
  }

  /**
   * @param {(img: HTMLCanvasElement | HTMLImageElement | string) => Promise<{ text: string, confidence: number }>} [ocrFn]
   */
  async startShare(ocrFn) {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('此设备不支持屏幕共享，请改用截图或粘贴');
    }
    this.ocrFn = ocrFn || this.ocrFn;
    this.stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 2 },
      audio: false,
    });
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = this.stream;
    await this.video.play();
    this.ready = true;
    this.stream.getVideoTracks()[0]?.addEventListener('ended', () => this.stop());
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
    this.lastText = '';
  }

  _startPoll() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = setInterval(() => {
      this.captureOnce().catch(() => {});
    }, 2500);
  }

  async captureOnce() {
    if (!this.video || !this.ocrFn) return null;
    const v = this.video;
    if (!v.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(v, 0, 0);
    const band = cropSubtitleBand(canvas);
    const result = await this.ocrFn(band);
    this.lastText = (result.text || '').replace(/\s+/g, ' ').trim();
    this.lastConfidence = typeof result.confidence === 'number' ? result.confidence : 0.5;
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
    if (!run) throw new Error('OCR 未就绪');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('截图加载失败'));
        el.src = url;
      });
      const band = cropSubtitleBand(img);
      const result = await run(band);
      this.lastText = (result.text || '').replace(/\s+/g, ' ').trim();
      this.lastConfidence = typeof result.confidence === 'number' ? result.confidence : 0.5;
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
      source: 'screen',
    };
  }
}

/**
 * Lazy-load Tesseract from CDN (network required for OCR language data).
 * @returns {Promise<(img: HTMLCanvasElement | HTMLImageElement | string) => Promise<{ text: string, confidence: number }>>}
 */
export async function createTesseractOcr() {
  if (typeof window === 'undefined') {
    throw new Error('OCR 仅在浏览器可用');
  }
  if (!window.Tesseract) {
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
  }
  const Tesseract = window.Tesseract;
  return async (img) => {
    const { data } = await Tesseract.recognize(img, 'eng', {
      logger: () => {},
    });
    const conf = typeof data.confidence === 'number' ? data.confidence / 100 : 0.5;
    return { text: data.text || '', confidence: conf };
  };
}

/** @param {string} src */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Tesseract 加载失败'));
    document.head.appendChild(s);
  });
}
