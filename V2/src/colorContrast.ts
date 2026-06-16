/** Contraste minimal de luminance relative (WCAG) entre matériaux adjacents. */
export const MIN_LUMINANCE_DELTA = 0.11;

export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace("#", "").trim();
  const expanded =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const n = parseInt(expanded, 16);
  if (!Number.isFinite(n)) return { r: 200, g: 200, b: 200 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function linearize(channel: number): number {
  const x = channel / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHexColor(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function luminanceDelta(a: string, b: string): number {
  return Math.abs(relativeLuminance(a) - relativeLuminance(b));
}

export function hasMinContrast(
  a: string,
  b: string,
  minDelta = MIN_LUMINANCE_DELTA,
): boolean {
  return luminanceDelta(a, b) >= minDelta;
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) =>
        Math.round(Math.max(0, Math.min(255, v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = parseHexColor(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 1) + 1) % 1;
  const sat = Math.max(0, Math.min(1, s));
  const lit = Math.max(0, Math.min(1, l));

  if (sat === 0) {
    const v = lit * 255;
    return rgbToHex(v, v, v);
  }

  const q = lit < 0.5 ? lit * (1 + sat) : lit + sat - lit * sat;
  const p = 2 * lit - q;
  const hk = hue * 6;
  const tr = hk + 2;
  const tg = hk;
  const tb = hk - 2;

  const toRgb = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };

  return rgbToHex(toRgb(tr) * 255, toRgb(tg) * 255, toRgb(tb) * 255);
}

/** Ajuste une couleur pour qu'elle contraste avec une couleur voisine. */
export function distinctFrom(
  color: string,
  reference: string,
  minDelta = MIN_LUMINANCE_DELTA,
): string {
  if (hasMinContrast(color, reference, minDelta)) return color;

  const hsl = hexToHsl(color);
  const refLum = relativeLuminance(reference);

  for (let step = 0.05; step <= 0.38; step += 0.05) {
    const lighter = hslToHex(hsl.h, Math.min(0.55, hsl.s + 0.04), Math.min(0.93, hsl.l + step));
    const darker = hslToHex(hsl.h, hsl.s, Math.max(0.07, hsl.l - step));
    const preferLight = refLum < relativeLuminance(color);
    for (const candidate of preferLight ? [lighter, darker] : [darker, lighter]) {
      if (hasMinContrast(candidate, reference, minDelta)) return candidate;
    }
  }

  for (const dh of [0.09, -0.09, 0.16, -0.16, 0.24]) {
    const candidate = hslToHex(
      hsl.h + dh,
      Math.min(0.52, hsl.s + 0.08),
      refLum > 0.55 ? Math.max(0.1, hsl.l - 0.12) : Math.min(0.9, hsl.l + 0.12),
    );
    if (hasMinContrast(candidate, reference, minDelta)) return candidate;
  }

  return refLum > 0.5 ? "#404040" : "#f0f0f0";
}

/** Trait de séparation entre deux couleurs de matériaux. */
export function segmentBorderStroke(left: string, right: string): string {
  const avg = (relativeLuminance(left) + relativeLuminance(right)) / 2;
  return avg > 0.52 ? "rgba(0, 0, 0, 0.24)" : "rgba(255, 255, 255, 0.42)";
}
