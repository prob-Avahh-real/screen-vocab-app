/**
 * Paste / image file → current subtitle line.
 * Image OCR is injected via ocrFn to keep tests free of Tesseract.
 */

export class PasteSource {
  constructor() {
    this.text = '';
    this.ready = false;
    this._confidence = 1;
    /** @type {(img: HTMLImageElement | HTMLCanvasElement | string) => Promise<{ text: string, confidence: number }>} */
    this.ocrFn = null;
  }

  /** @param {string} text */
  setText(text) {
    this.text = (text || '').replace(/\s+/g, ' ').trim();
    this.ready = this.text.length > 0;
  }

  /**
   * @param {File|Blob} file
   * @param {(img: HTMLImageElement | HTMLCanvasElement | string) => Promise<{ text: string, confidence: number }>} [ocrFn]
   */
  async setImage(file, ocrFn) {
    const run = ocrFn || this.ocrFn;
    if (!run) throw new Error('OCR 未就绪');
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const band = cropSubtitleBand(img);
      const result = await run(band);
      this.setText(result.text || '');
      this._confidence = typeof result.confidence === 'number' ? result.confidence : 0.6;
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
      source: 'paste',
    };
  }
}

/**
 * @param {HTMLImageElement|HTMLCanvasElement} img
 * @param {number} [bandRatio=0.28]
 */
export function cropSubtitleBand(img, bandRatio = 0.28) {
  const w = /** @type {any} */ (img).naturalWidth || img.width;
  const h = /** @type {any} */ (img).naturalHeight || img.height;
  const bandH = Math.max(1, Math.floor(h * bandRatio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = bandH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, h - bandH, w, bandH, 0, 0, w, bandH);
  return canvas;
}

/** @param {string} url */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = url;
  });
}
