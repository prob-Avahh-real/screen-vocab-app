/**
 * Cross-ecosystem device profile: Apple + Android form factors.
 * Layout classes: eco-{apple|android|other} + form-{phone|tablet|watch|tv|desktop|foldable} + device-{kind}
 */

/** @typedef {'apple' | 'android' | 'other'} EcoFamily */
/** @typedef {'phone' | 'tablet' | 'watch' | 'tv' | 'desktop' | 'foldable' | 'other'} FormFactor */
/**
 * @typedef {'iphone'|'ipad'|'ipod'|'mac'|'applewatch'|'appletv'|'vision'|
 *   'android-phone'|'android-tablet'|'wearos'|'android-tv'|'chromeos'|'foldable'|'other'} DeviceKind
 */
/**
 * @typedef {{
 *   family: EcoFamily,
 *   form: FormFactor,
 *   kind: DeviceKind,
 *   label: string,
 * }} DeviceProfile
 */

const ALL_KINDS = [
  'iphone',
  'ipad',
  'ipod',
  'mac',
  'applewatch',
  'appletv',
  'vision',
  'android-phone',
  'android-tablet',
  'wearos',
  'android-tv',
  'chromeos',
  'foldable',
  'other',
];

const ALL_FORMS = ['phone', 'tablet', 'watch', 'tv', 'desktop', 'foldable', 'other'];
const ALL_FAMILIES = ['apple', 'android', 'other'];

/**
 * @param {{
 *   userAgent?: string,
 *   platform?: string,
 *   maxTouchPoints?: number,
 *   width?: number,
 *   height?: number,
 *   foldSegments?: boolean,
 * }} [env]
 * @returns {DeviceProfile}
 */
export function detectDeviceProfile(env = {}) {
  const hasWindow = typeof window !== 'undefined';
  const hasNav = typeof navigator !== 'undefined';
  const synthetic = Object.keys(env).length > 0;

  const ua = env.userAgent ?? (synthetic ? '' : hasNav ? navigator.userAgent : '') ?? '';
  const platform =
    env.platform ?? (synthetic ? '' : hasNav ? navigator.platform : '') ?? '';
  const maxTouchPoints =
    env.maxTouchPoints ??
    (synthetic ? 0 : hasNav ? navigator.maxTouchPoints || 0 : 0);

  const width =
    env.width ??
    (synthetic
      ? 0
      : hasWindow
        ? Math.min(window.innerWidth, screen.width || window.innerWidth)
        : 0);
  const height =
    env.height ??
    (synthetic
      ? 0
      : hasWindow
        ? Math.min(window.innerHeight, screen.height || window.innerHeight)
        : 0);

  const foldSegments =
    env.foldSegments ??
    (!synthetic &&
      hasWindow &&
      typeof window.matchMedia === 'function' &&
      (window.matchMedia('(horizontal-viewport-segments: 2)').matches ||
        window.matchMedia('(vertical-viewport-segments: 2)').matches));

  if (!ua && !width && !height && (synthetic || !hasWindow)) {
    return profile('other', 'other', 'other');
  }

  const minSide = Math.min(width || 9999, height || 9999);
  const maxSide = Math.max(width || 0, height || 0);
  const isAndroid = /Android/i.test(ua);
  const isAppleMobile = /iPhone|iPad|iPod/i.test(ua);

  // —— Watch (viewport or UA) ——
  if (
    /Watch|Wear ?OS|Android Wear|SM-R|Pixel Watch/i.test(ua) ||
    (width > 0 && height > 0 && (width <= 280 || height <= 300 || (maxSide <= 400 && minSide <= 240)))
  ) {
    if (isAndroid || /Wear/i.test(ua)) return profile('android', 'watch', 'wearos');
    return profile('apple', 'watch', 'applewatch');
  }

  // —— Apple TV / Vision ——
  if (/Apple ?TV|TVOS|AppleTV/i.test(ua)) return profile('apple', 'tv', 'appletv');
  if (/Vision|xrOS|Reality/i.test(ua)) return profile('apple', 'desktop', 'vision');

  // —— Android TV / Leanback ——
  if (
    /Android TV|SMART-TV|SmartTV|BRAVIA|AFT[A-Z]|GoogleTV|MIBOX|TV Box/i.test(ua) ||
    (/Android/i.test(ua) && /TV/i.test(ua) && minSide >= 540)
  ) {
    return profile('android', 'tv', 'android-tv');
  }

  // —— Foldable ——
  if (
    foldSegments ||
    /Fold|Z Fold|Surface Duo|Galaxy Z|hinge/i.test(ua) ||
    (width > 0 && height > 0 && maxSide / Math.max(minSide, 1) >= 2.1 && minSide >= 500)
  ) {
    if (isAndroid || !isAppleMobile) return profile('android', 'foldable', 'foldable');
  }

  // —— Chrome OS ——
  if (/CrOS|Chromebook/i.test(ua)) return profile('android', 'desktop', 'chromeos');

  // —— Classic Apple mobile / Mac ——
  if (/iPod/i.test(ua)) return profile('apple', 'phone', 'ipod');
  if (/iPad/i.test(ua)) return profile('apple', 'tablet', 'ipad');
  if (/iPhone/i.test(ua)) return profile('apple', 'phone', 'iphone');

  const isMacUa = /Macintosh|Mac OS X|MacIntel/i.test(ua) || /Mac/i.test(platform);
  if (isMacUa && maxTouchPoints > 1) return profile('apple', 'tablet', 'ipad');
  if (isMacUa) return profile('apple', 'desktop', 'mac');

  // —— Android phone / tablet by sw ——
  if (isAndroid) {
    // sw600dp-ish: min side ≥ 600 → tablet
    if (minSide >= 600 || (minSide >= 560 && maxSide >= 900)) {
      return profile('android', 'tablet', 'android-tablet');
    }
    return profile('android', 'phone', 'android-phone');
  }

  // —— Fallbacks by viewport ——
  if (maxTouchPoints === 0 && minSide >= 700 && maxSide >= 1000) {
    return profile('other', 'desktop', 'chromeos');
  }
  if (minSide >= 744 || (minSide >= 600 && maxSide >= 900)) {
    return profile('other', 'tablet', 'android-tablet');
  }
  if (width > 0 && minSide >= 320 && maxSide < 900) {
    return profile('other', 'phone', 'android-phone');
  }

  return profile('other', 'other', 'other');
}

/**
 * @param {EcoFamily} family
 * @param {FormFactor} form
 * @param {DeviceKind} kind
 * @returns {DeviceProfile}
 */
function profile(family, form, kind) {
  return { family, form, kind, label: deviceLabel(kind) };
}

/** @param {DeviceKind} kind */
export function deviceLabel(kind) {
  switch (kind) {
    case 'iphone':
      return 'iPhone';
    case 'ipad':
      return 'iPad';
    case 'ipod':
      return 'iPod';
    case 'mac':
      return 'MacBook';
    case 'applewatch':
      return 'Apple Watch';
    case 'appletv':
      return 'Apple TV';
    case 'vision':
      return 'Vision';
    case 'android-phone':
      return '安卓手机';
    case 'android-tablet':
      return '安卓平板';
    case 'wearos':
      return 'Wear OS';
    case 'android-tv':
      return 'Android TV';
    case 'chromeos':
      return 'ChromeOS';
    case 'foldable':
      return '折叠屏';
    default:
      return '设备';
  }
}

/** @deprecated use detectDeviceProfile().kind */
export function detectDeviceKind(env = {}) {
  return detectDeviceProfile(env).kind;
}

/**
 * Apply eco / form / device body classes.
 * @returns {DeviceProfile}
 */
export function applyDeviceProfile() {
  const p = detectDeviceProfile();
  if (typeof document === 'undefined') return p;
  const body = document.body;

  ALL_FAMILIES.forEach((f) => body.classList.remove(`eco-${f}`));
  ALL_FORMS.forEach((f) => body.classList.remove(`form-${f}`));
  ALL_KINDS.forEach((k) => body.classList.remove(`device-${k}`));
  body.classList.remove('device-watch', 'watch'); // legacy

  body.classList.add(`eco-${p.family}`, `form-${p.form}`, `device-${p.kind}`);
  body.dataset.eco = p.family;
  body.dataset.form = p.form;
  body.dataset.device = p.kind;

  if (p.form === 'watch') {
    body.classList.add('device-watch', 'watch');
  }
  return p;
}
