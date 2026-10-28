/**
 * Watercolour for the Penrose masthead, painted once with p5.brush's
 * standalone build (no p5) and handed back as a canvas the banner fills its
 * tiles from. Loaded lazily by PenroseBanner; nothing here runs on first paint.
 */
import * as brush from "p5.brush/standalone";

export type PaintTile = {
  xs: number[];
  ys: number[];
  /** 0 at the sun centre, 1 at the farthest corner of the band. */
  ring: number;
  thick: boolean;
};

// Always painted on the light page's paper; bake() lifts the paper back out,
// so the same painting serves both themes.
const PAPER = [242, 239, 229] as const;
const STOPS = ["#c98a2b", "#b8473f", "#c46a7a", "#2f4b7c"];
const RINGS = 7;
const SEED = 1618;

let target: HTMLCanvasElement | null = null;
let targetDpr = 0;
// Painting and theme bakes are cached for the session, so view-transition
// navigations reuse them instead of repainting.
const paintings = new Map<string, HTMLCanvasElement>();
const bakes = new Map<string, HTMLCanvasElement>();

function mixHex(a: string, b: string, f: number) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * f)).join(",")})`;
}

/**
 * Concentric rings out from the sun centre, ochre through madder and rose to
 * indigo. Each ring is its own pass: paint feathers wet-in-wet inside a ring
 * and dries crisp at render() before the next one goes down.
 */
function paintRings(tiles: PaintTile[]) {
  brush.fillTexture(0.5, 0.6, true, 0.35);
  brush.fillBleed(0.1, "out");
  for (let k = 0; k < RINGS; k++) {
    const f = (k / (RINGS - 1)) * (STOPS.length - 1);
    const i = Math.min(STOPS.length - 2, Math.floor(f));
    const colour = mixHex(STOPS[i], STOPS[i + 1], f - i);
    for (const t of tiles) {
      if (Math.min(RINGS - 1, Math.floor(t.ring * RINGS)) !== k) continue;
      brush.fill(colour, t.thick ? 105 : 70);
      brush.polygon(t.xs.map((x, j) => [x, t.ys[j]]));
    }
    brush.render();
  }
}

function paint(tiles: PaintTile[], w: number, h: number, dpr: number) {
  // The brush canvas keeps the density it was created with, so a new one is
  // only made when that changes (a window moved to another screen).
  if (!target || targetDpr !== dpr) {
    target = brush.createCanvas(w, h, { pixelDensity: dpr, parent: null });
    targetDpr = dpr;
  } else {
    target.width = Math.round(w * dpr);
    target.height = Math.round(h * dpr);
    brush.load(target);
  }
  brush.seed(SEED);
  brush.noStroke();
  brush.noHatch();
  brush.clear(`rgb(${PAPER.join(",")})`);
  // Even standalone, p5.brush keeps WEBGL's centre origin.
  brush.push();
  brush.translate(-w / 2, -h / 2);
  paintRings(tiles);
  brush.pop();

  // Copy out: the WebGL canvas is reused for the next size.
  const out = document.createElement("canvas");
  out.width = target.width;
  out.height = target.height;
  out.getContext("2d")!.drawImage(target, 0, 0);
  return out;
}

/**
 * Colour-to-alpha against the paper, so unpainted paper is exactly
 * transparent. On dark pages each pigment's HSL lightness is flipped, hue and
 * saturation kept, so the washes glow instead of sinking into the black.
 */
function bake(src: HTMLCanvasElement, dark: boolean) {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let a = 0;
    for (let k = 0; k < 3; k++)
      a = Math.max(a, (PAPER[k] - d[i + k]) / PAPER[k]);
    if (a <= 0.003) {
      d[i + 3] = 0;
      continue;
    }
    let r = (d[i] - (1 - a) * PAPER[0]) / a;
    let gr = (d[i + 1] - (1 - a) * PAPER[1]) / a;
    let b = (d[i + 2] - (1 - a) * PAPER[2]) / a;
    if (dark) {
      const shift = 255 - Math.max(r, gr, b) - Math.min(r, gr, b);
      r += shift;
      gr += shift;
      b += shift;
    }
    d[i] = r;
    d[i + 1] = gr;
    d[i + 2] = b;
    d[i + 3] = Math.min(255, a * 255 * (dark ? 1.25 : 1));
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** The finished, theme-ready painting for this band size. */
export function watercolour(
  tiles: PaintTile[],
  w: number,
  h: number,
  dpr: number,
  dark: boolean
) {
  const size = `${w}x${h}@${dpr}`;
  const key = `${size}:${dark ? "dark" : "light"}`;
  const cached = bakes.get(key);
  if (cached) return cached;
  let painting = paintings.get(size);
  if (!painting) {
    painting = paint(tiles, w, h, dpr);
    paintings.set(size, painting);
  }
  const baked = bake(painting, dark);
  bakes.set(key, baked);
  return baked;
}
