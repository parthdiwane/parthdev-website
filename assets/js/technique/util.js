/* Shared maths and canvas plumbing for the technique renderers. */

export const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (min, max) => min + Math.random() * (max - min);

/* 0 below `edge0`, 1 above `edge1`, smooth in between. */
export const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInCubic = (t) => t * t * t;
export const easeInQuad = (t) => t * t;

export const dprScale = () => Math.min(window.devicePixelRatio || 1, 2);

/* Frame-rate independent exponential decay: `factor` is the multiplier that
   would be applied over a single 60Hz frame. */
export const decay = (factor, dt) => Math.pow(factor, dt / 16.6667);

/* Particle counts scale with viewport area and are divided down by pixel
   density, so a 4K retina panel asks for fewer, not four times as many. */
export const particleBudget = (w, h, { divisor = 380, min = 480, max = 2600 } = {}) =>
  clamp(Math.round((w * h) / (divisor * dprScale())), min, max);

export const sizeCanvas = (canvas, ctx) => {
  const dpr = dprScale();
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return { w, h, dpr };
};

export const parseHex = (hex) => {
  let value = hex.replace("#", "");
  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const int = parseInt(value, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};

export const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;
