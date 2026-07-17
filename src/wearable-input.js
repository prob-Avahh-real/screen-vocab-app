/**
 * Wearable input — ring tilt/shake, cane tap.
 * Gestures: shake, tap, tilt_left, tilt_right, tilt_up, tilt_down
 */
export class WearableInput {
  /**
   * @param {{
   *   onGesture: (gesture: string, detail?: object) => void,
   *   onBadge?: (kind: string, text: string, active: boolean) => void
   * }} opts
   */
  constructor(opts) {
    this.onGesture = opts.onGesture;
    this.onBadge = opts.onBadge ?? (() => {});
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
    if (typeof DeviceOrientationEvent === 'undefined') return;
    this.onBadge('ring', '戒指 · 点击启用', false);

    const enable = async () => {
      try {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
          const perm = await DeviceOrientationEvent.requestPermission();
          if (perm !== 'granted') return;
        }
        this.ringActive = true;
        this.onBadge('ring', '戒指 · 已连接', true);
        window.addEventListener('deviceorientation', (e) => this.handleRing(e));
      } catch {
        this.onBadge('ring', '戒指 · 不支持', false);
      }
    };

    document.getElementById('ring-badge')?.addEventListener('click', enable, { once: true });
    if (typeof DeviceOrientationEvent.requestPermission !== 'function') enable();
  }

  setupCane() {
    if (typeof DeviceMotionEvent === 'undefined') return;
    this.onBadge('cane', '手杖 · 点击启用', false);

    const enable = async () => {
      try {
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
          const perm = await DeviceMotionEvent.requestPermission();
          if (perm !== 'granted') return;
        }
        this.caneActive = true;
        this.onBadge('cane', '手杖 · 已连接', true);
        window.addEventListener('devicemotion', (e) => this.handleCane(e));
      } catch {
        this.onBadge('cane', '手杖 · 不支持', false);
      }
    };

    document.getElementById('cane-badge')?.addEventListener('click', enable, { once: true });
    if (typeof DeviceMotionEvent.requestPermission !== 'function') enable();
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
      this.onGesture('shake', { dBeta, dGamma });
      return;
    }
    if (gamma > 5) this.onGesture('tilt_right', { gamma });
    else if (gamma < -5) this.onGesture('tilt_left', { gamma });
    if (beta > 5) this.onGesture('tilt_up', { beta });
    else if (beta < -5) this.onGesture('tilt_down', { beta });
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
      this.onGesture('tap', { spike: Math.max(dax, day, daz) });
    }
  }
}
