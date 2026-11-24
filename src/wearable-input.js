/**
 * Canonical wearable input (ring + cane) for Projects workspace.
 * Source of truth: active/air-shared/wearable-input.js
 * Sync copies: node tools/sync-wearable-input.mjs
 *
 * APIs:
 * - createWearableInput(handlers) → { start, stop, requestPermission, isListening }
 * - WearableInput class (badge UI + onGesture) for continuous / game profiles
 * - IIFE bootstrap: #wearable-enable → window.onWearableGesture('tilt'|'shake'|'tap'|'swing', detail)
 */

export const WEARABLE_DEFAULTS = {
  RING_TILT: 5,
  RING_SHAKE: 20,
  CANE_TAP: 8,
  CANE_SWING: 3,
  RING_THROTTLE: 8,
  CANE_THROTTLE: 6,
};

/**
 * @param {{
 *   onRingShake?: () => void,
 *   onRingTiltUp?: () => void,
 *   onRingTiltDown?: () => void,
 *   onRingTiltLeft?: () => void,
 *   onRingTiltRight?: () => void,
 *   onCaneTap?: () => void,
 *   onCaneSwingLeft?: () => void,
 *   onCaneSwingRight?: () => void,
 *   onCaneSwing?: (dir: string) => void,
 *   throttleMs?: number,
 * }} handlers
 */
export function createWearableInput(handlers = {}) {
  const {
    RING_TILT,
    RING_SHAKE,
    CANE_TAP,
    CANE_SWING,
    RING_THROTTLE,
    CANE_THROTTLE,
  } = WEARABLE_DEFAULTS;
  const throttleMs = handlers.throttleMs ?? 600;

  let ringFrames = 0;
  let caneFrames = 0;
  let lastBeta = 0;
  let lastGamma = 0;
  let listening = false;
  let orientationHandler = null;
  let motionHandler = null;
  let lastAction = 0;

  function throttleAction(fn, ms = throttleMs) {
    const now = Date.now();
    if (now - lastAction < ms) return;
    lastAction = now;
    fn?.();
  }

  function onRing(e) {
    ringFrames++;
    if (ringFrames % RING_THROTTLE !== 0) return;
    const beta = e.beta ?? 0;
    const gamma = e.gamma ?? 0;
    const dBeta = Math.abs(beta - lastBeta);
    const dGamma = Math.abs(gamma - lastGamma);
    lastBeta = beta;
    lastGamma = gamma;

    if (dBeta > RING_SHAKE || dGamma > RING_SHAKE) {
      throttleAction(() => handlers.onRingShake?.());
      return;
    }
    // Tilts are not globally throttled — callers may want rapid UI updates
    if (beta > RING_TILT) handlers.onRingTiltDown?.();
    else if (beta < -RING_TILT) handlers.onRingTiltUp?.();
    if (gamma > RING_TILT) handlers.onRingTiltRight?.();
    else if (gamma < -RING_TILT) handlers.onRingTiltLeft?.();
  }

  function onCane(e) {
    caneFrames++;
    if (caneFrames % CANE_THROTTLE !== 0) return;
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a) return;
    const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
    const spike = Math.abs(mag - 9.8);
    if (spike > CANE_TAP) {
      throttleAction(() => handlers.onCaneTap?.());
      return;
    }
    if (Math.abs(a.x || 0) > CANE_SWING) {
      const dir = (a.x || 0) > 0 ? 'right' : 'left';
      throttleAction(() => {
        handlers.onCaneSwing?.(dir);
        if (dir === 'right') handlers.onCaneSwingRight?.();
        else handlers.onCaneSwingLeft?.();
      }, 800);
    }
  }

  async function requestPermission() {
    let ok = true;
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      try {
        ok = (await DeviceOrientationEvent.requestPermission()) === 'granted';
      } catch {
        ok = false;
      }
    }
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function'
    ) {
      try {
        ok = ok && (await DeviceMotionEvent.requestPermission()) === 'granted';
      } catch {
        ok = false;
      }
    }
    return ok;
  }

  function start() {
    if (listening || typeof window === 'undefined') return;
    listening = true;
    orientationHandler = onRing;
    motionHandler = onCane;
    window.addEventListener('deviceorientation', orientationHandler);
    window.addEventListener('devicemotion', motionHandler);
  }

  function stop() {
    if (!listening) return;
    listening = false;
    if (typeof window !== 'undefined') {
      if (orientationHandler) window.removeEventListener('deviceorientation', orientationHandler);
      if (motionHandler) window.removeEventListener('devicemotion', motionHandler);
    }
    orientationHandler = null;
    motionHandler = null;
  }

  return {
    start,
    stop,
    requestPermission,
    isListening: () => listening,
    get listening() {
      return listening;
    },
  };
}

/**
 * Class API for games / continuous control.
 * profile:
 * - 'generic' (default): emits tilt/shake/tap/swing via onGesture
 * - 'aim-draw': aim {x,y}, draw, release, cancel_draw (archery family)
 * - 'steer': steer {x,y} + tap/boost-style cane
 * - 'relay': onAction('relayToggle'|'relayOn'|'relayOff') — IoT hubs
 */
export class WearableInput {
  /**
   * @param {{
   *   onGesture?: (gesture: string, detail?: object) => void,
   *   onAction?: (action: string) => void,
   *   onBadge?: (kind: string, text: string, active: boolean) => void,
   *   profile?: 'generic'|'aim-draw'|'steer'|'relay',
   *   ringBadgeId?: string,
   *   caneBadgeId?: string,
   * }} opts
   */
  constructor(opts = {}) {
    this.onGesture = opts.onGesture ?? (() => {});
    this.onAction = opts.onAction;
    this.onBadge = opts.onBadge ?? (() => {});
    this.profile = opts.profile || 'generic';
    this.ringBadgeId = opts.ringBadgeId || 'ring-badge';
    this.caneBadgeId = opts.caneBadgeId || 'cane-badge';
    this.ringActive = false;
    this.caneActive = false;
    this.ringFrame = 0;
    this.caneFrame = 0;
    this.ringPrevBeta = null;
    this.ringPrevGamma = null;
    this.caneLastAccel = { x: 0, y: 0, z: 0 };
    this.canePrevGamma = null;
    this.lastHitAt = 0;
    this.neutralBeta = null;
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
        this.neutralBeta = null;
        this.onBadge('ring', '戒指 · 已连接', true);
        window.addEventListener('deviceorientation', (e) => this.handleRing(e));
      } catch {
        this.onBadge('ring', '戒指 · 不支持', false);
      }
    };
    document.getElementById(this.ringBadgeId)?.addEventListener('click', enable, { once: true });
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
    document.getElementById(this.caneBadgeId)?.addEventListener('click', enable, { once: true });
    if (typeof DeviceMotionEvent.requestPermission !== 'function') enable();
  }

  handleRing(e) {
    if (!this.ringActive) return;
    this.ringFrame++;
    const beta = e.beta || 0;
    const gamma = e.gamma || 0;
    const { RING_TILT, RING_SHAKE, RING_THROTTLE } = WEARABLE_DEFAULTS;

    if (this.profile === 'aim-draw') {
      if (this.ringFrame % 2 === 0) {
        const x = Math.max(-1, Math.min(1, gamma / 45));
        const y = Math.max(-1, Math.min(1, beta / 45));
        this.onGesture('aim', { x, y });
      }
      if (this.ringFrame % RING_THROTTLE !== 0) return;
      if (this.ringPrevBeta === null) {
        this.ringPrevBeta = beta;
        this.ringPrevGamma = gamma;
        return;
      }
      const dBeta = beta - this.ringPrevBeta;
      const dGamma = gamma - this.ringPrevGamma;
      this.ringPrevBeta = beta;
      this.ringPrevGamma = gamma;
      if (Math.abs(dBeta) > RING_SHAKE || Math.abs(dGamma) > RING_SHAKE) {
        this.onGesture('cancel_draw');
      }
      return;
    }

    if (this.profile === 'steer') {
      if (this.ringFrame % 2 === 0) {
        const x = Math.max(-1, Math.min(1, gamma / 35));
        const y = Math.max(-1, Math.min(1, (beta - 45) / 35));
        this.onGesture('steer', { x, y });
      }
      return;
    }

    if (this.profile === 'relay') {
      if (this.ringFrame % RING_THROTTLE !== 0) return;
      if (this.ringPrevBeta === null) {
        this.ringPrevBeta = beta;
        this.ringPrevGamma = gamma;
        return;
      }
      const dBeta = Math.abs(beta - this.ringPrevBeta);
      const dGamma = Math.abs(gamma - this.ringPrevGamma);
      this.ringPrevBeta = beta;
      this.ringPrevGamma = gamma;
      if (dBeta > RING_SHAKE || dGamma > RING_SHAKE) {
        this.onAction?.('relayToggle');
        return;
      }
      if (dBeta > RING_TILT || dGamma > RING_TILT) {
        if (beta > 0) this.onAction?.('relayOn');
        else this.onAction?.('relayOff');
      }
      return;
    }

    // generic
    if (this.ringFrame % RING_THROTTLE !== 0) return;
    if (this.ringPrevBeta === null) {
      this.ringPrevBeta = beta;
      this.ringPrevGamma = gamma;
      return;
    }
    const dBeta = Math.abs(beta - this.ringPrevBeta);
    const dGamma = Math.abs(gamma - this.ringPrevGamma);
    this.ringPrevBeta = beta;
    this.ringPrevGamma = gamma;
    if (dBeta > RING_SHAKE || dGamma > RING_SHAKE) {
      this.onGesture('shake', { dBeta, dGamma });
      return;
    }
    if (gamma > RING_TILT) this.onGesture('tilt', { dir: 'right', gamma });
    else if (gamma < -RING_TILT) this.onGesture('tilt', { dir: 'left', gamma });
    else if (beta > RING_TILT) this.onGesture('tilt', { dir: 'up', beta });
    else if (beta < -RING_TILT) this.onGesture('tilt', { dir: 'down', beta });
  }

  handleCane(e) {
    if (!this.caneActive) return;
    this.caneFrame++;
    const { CANE_TAP, CANE_SWING, CANE_THROTTLE } = WEARABLE_DEFAULTS;
    if (this.caneFrame % CANE_THROTTLE !== 0) return;

    const a = e.accelerationIncludingGravity || e.acceleration || { x: 0, y: 0, z: 0 };
    const dax = Math.abs((a.x || 0) - this.caneLastAccel.x);
    const day = Math.abs((a.y || 0) - this.caneLastAccel.y);
    const daz = Math.abs((a.z || 0) - this.caneLastAccel.z);
    this.caneLastAccel = { x: a.x || 0, y: a.y || 0, z: a.z || 0 };

    if (this.profile === 'aim-draw') {
      if (dax > CANE_TAP || day > CANE_TAP || daz > CANE_TAP) {
        const now = Date.now();
        if (now - this.lastHitAt < 160) return;
        this.lastHitAt = now;
        const velocity = Math.min(1.25, Math.max(dax, day, daz) / 14);
        this.onGesture('release', { velocity });
        return;
      }
      const rot = e.rotationRate || { gamma: 0 };
      const rg = rot.gamma || 0;
      if (this.canePrevGamma !== null && Math.abs(rg - this.canePrevGamma) > CANE_SWING) {
        const now = Date.now();
        if (now - this.lastHitAt >= 100) {
          this.lastHitAt = now;
          const velocity = Math.min(1.2, Math.abs(rg - this.canePrevGamma) / 12);
          this.onGesture('draw', { velocity });
        }
      }
      this.canePrevGamma = rg;
      return;
    }

    if (this.profile === 'relay') {
      if (dax > CANE_TAP || day > CANE_TAP || daz > CANE_TAP) this.onAction?.('relayToggle');
      return;
    }

    if (dax > CANE_TAP || day > CANE_TAP || daz > CANE_TAP) {
      const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
      this.onGesture('tap', { spike: Math.max(dax, day, daz), mag });
      if (this.profile === 'steer') this.onGesture('chirp', {});
      return;
    }
    if (Math.abs(a.x || 0) > CANE_SWING) {
      const dir = (a.x || 0) > 0 ? 'right' : 'left';
      this.onGesture('swing', { dir });
    }
  }
}

/** Script-tag bootstrap for pages using #wearable-enable + window.onWearableGesture */
export function attachWearableEnableButton(buttonId = 'wearable-enable') {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  const input = createWearableInput({
    onRingShake: () => window.onWearableGesture?.('shake', {}),
    onRingTiltUp: () => window.onWearableGesture?.('tilt', { dir: 'up' }),
    onRingTiltDown: () => window.onWearableGesture?.('tilt', { dir: 'down' }),
    onRingTiltLeft: () => window.onWearableGesture?.('tilt', { dir: 'left' }),
    onRingTiltRight: () => window.onWearableGesture?.('tilt', { dir: 'right' }),
    onCaneTap: () => window.onWearableGesture?.('tap', {}),
    onCaneSwing: (dir) => window.onWearableGesture?.('swing', { dir }),
  });
  btn.addEventListener('click', async () => {
    const ok = await input.requestPermission().catch(() => false);
    if (!ok) return;
    input.start();
    btn.textContent = '戒指/手杖已启用';
  });
}

// Auto-attach in browser when loaded as classic/module script
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.WearableInput = WearableInput;
  window.createWearableInput = createWearableInput;
  window.WEARABLE_DEFAULTS = WEARABLE_DEFAULTS;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => attachWearableEnableButton());
  } else {
    attachWearableEnableButton();
  }
}
