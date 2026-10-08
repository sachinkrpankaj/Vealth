export interface HsvColor {
  h: number;
  s: number;
  v: number;
}

const clamp = (value: number, max = 1) => Math.max(0, Math.min(max, value));

export function normalizeHexColor(input: string): string | null {
  const hex = input.trim().replace(/^#/, '');
  if (!/^([a-f\d]{3}|[a-f\d]{6})$/i.test(hex)) return null;
  return `#${hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex}`.toUpperCase();
}

export function hexToHsv(input: string): HsvColor {
  const hex = normalizeHexColor(input) ?? '#3B82F6';
  const value = parseInt(hex.slice(1), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === r) hue = ((g - b) / delta + 6) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
  }
  // Keep fractional hue: rounding it changes the user's exact HEX color.
  return { h: hue * 60, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s);
  const brightness = clamp(v);
  const c = brightness * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = brightness - c;
  const sectors = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]];
  return `#${sectors[Math.floor(hue / 60)].map((channel) =>
    Math.round((channel + m) * 255).toString(16).padStart(2, '0')
  ).join('')}`.toUpperCase();
}

export function colorFieldSelection(hsv: HsvColor, x: number, y: number, width: number, height: number): HsvColor {
  if (width <= 0 || height <= 0) return hsv;
  return { ...hsv, s: clamp(x / width), v: clamp(1 - y / height) };
}

export function hueSliderSelection(hsv: HsvColor, x: number, width: number): HsvColor {
  if (width <= 0) return hsv;
  // Preserve 360 at the right edge so the thumb does not jump to the left.
  return { ...hsv, h: clamp(x / width) * 360 };
}
