/**
 * Apple form-factor detection for layout + HUD.
 * Covers iPhone, iPad, iPod, Mac (Catalyst / desktop), Apple Watch (compact viewport).
 */

/** @typedef {'iphone' | 'ipad' | 'ipod' | 'mac' | 'watch' | 'other'} DeviceKind */

/**
 * @param {{
 *   userAgent?: string,
 *   platform?: string,
 *   maxTouchPoints?: number,
 *   width?: number,
 *   height?: number,
 * }} [env]
 * @returns {DeviceKind}
 */
export function detectDeviceKind(env = {}) {
  const hasWindow = typeof window !== 'undefined';
  const hasNav = typeof navigator !== 'undefined';

  const ua = env.userAgent ?? (hasNav ? navigator.userAgent : '') ?? '';
  const platform = env.platform ?? (hasNav ? navigator.platform : '') ?? '';
  const maxTouchPoints =
    env.maxTouchPoints ?? (hasNav ? navigator.maxTouchPoints || 0 : 0);

  const width =
    env.width ??
    (hasWindow ? Math.min(window.innerWidth, screen.width || window.innerWidth) : 0);
  const height =
    env.height ??
    (hasWindow ? Math.min(window.innerHeight, screen.height || window.innerHeight) : 0);

  if (!ua && !width && !height && !hasWindow) return 'other';

  const minSide = Math.min(width || 9999, height || 9999);
  const maxSide = Math.max(width || 0, height || 0);

  // Watch: very small viewport (repo convention ≤280×300)
  if (width > 0 && height > 0 && (width <= 280 || height <= 300 || (maxSide <= 400 && minSide <= 240))) {
    return 'watch';
  }

  if (/iPod/i.test(ua)) return 'ipod';
  if (/iPad/i.test(ua)) return 'ipad';
  if (/iPhone/i.test(ua)) return 'iphone';

  // Mac / Mac Catalyst; iPadOS 13+ may report Macintosh with touch
  const isMacUa = /Macintosh|Mac OS X|MacIntel/i.test(ua) || /Mac/i.test(platform);
  if (isMacUa && maxTouchPoints > 1) return 'ipad';
  if (isMacUa) return 'mac';

  if (maxTouchPoints === 0 && minSide >= 700 && maxSide >= 1000) return 'mac';
  if (minSide >= 744 || (minSide >= 600 && maxSide >= 900)) return 'ipad';
  if (width > 0 && minSide >= 320 && maxSide < 900) return 'iphone';

  return 'other';
}

/** Chinese label for HUD / status */
export function deviceLabel(/** @type {DeviceKind} */ kind) {
  switch (kind) {
    case 'iphone':
      return 'iPhone';
    case 'ipad':
      return 'iPad';
    case 'ipod':
      return 'iPod';
    case 'mac':
      return 'MacBook';
    case 'watch':
      return 'Apple Watch';
    default:
      return '设备';
  }
}

/**
 * Apply `device-*` body class and optional data attribute.
 * @returns {DeviceKind}
 */
export function applyDeviceProfile() {
  const kind = detectDeviceKind();
  if (typeof document === 'undefined') return kind;
  const body = document.body;
  ['iphone', 'ipad', 'ipod', 'mac', 'watch', 'other'].forEach((k) => {
    body.classList.remove(`device-${k}`);
  });
  body.classList.add(`device-${kind}`);
  body.dataset.device = kind;
  if (kind === 'watch') body.classList.add('watch');
  return kind;
}
