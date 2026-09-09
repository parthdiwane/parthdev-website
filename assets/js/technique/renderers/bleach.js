import { clamp, decay, easeOutCubic, parseHex, particleBudget, rand, rgba, smoothstep } from "../util.js";

/* ==========================================================================
   Senbonzakura Kageyoshi

   Thousands of blade-petals. The thing that sells them is that they are
   blades first and blossoms only at distance, so the geometry is an
   asymmetric scythe with a sharp tip, a lit leading edge and a spine -- and
   every petal fakes depth by squashing across its long axis as it turns,
   which lets it flash edge-on and briefly vanish.

   The shape is drawn once per colour into a sprite at init and blitted with a
   hand-composed matrix after that: one setTransform + one drawImage per
   petal, instead of a bezier tessellation per petal per frame.
   ========================================================================== */

const TAU = Math.PI * 2;

const PALETTE = ["#FFD6E3", "#FFC2D4", "#FFA0BC", "#E8628C"];
const SPARKLE = "#FFF4F8";
const END_BG = parseHex("#FFFFFF");

const LIGHTEN_MS = 800; /* the blossoms are what turn the screen white */
const THIN_MS = 620;

const supportsFilter = (ctx) => {
  try {
    ctx.filter = "blur(1px)";
    const ok = ctx.filter === "blur(1px)";
    ctx.filter = "none";
    return ok;
  } catch (error) {
    return false;
  }
};

/* One petal, filling the box (0,0)-(w,h). Upper edge sweeps wider than the
   lower one so the silhouette reads as a curved blade rather than a leaf. */
const petalPath = (ctx, w, h) => {
  const cy = h / 2;
  const hh = h / 2;

  ctx.beginPath();
  ctx.moveTo(w, cy);
  ctx.bezierCurveTo(w * 0.6, cy - hh * 0.99, w * 0.24, cy - hh * 0.88, 0, cy - hh * 0.12);
  ctx.bezierCurveTo(w * 0.15, cy + hh * 0.36, w * 0.55, cy + hh * 0.93, w, cy);
  ctx.closePath();
};

const makeSprite = (color, { width, height, blur, detail }) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  /* Inset so the silhouette never touches the bitmap edge; a petal clipped by
     the sprite bounds shows a hard cut once it is scaled up. */
  const pad = blur ? blur * 2.5 : 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  ctx.translate(pad, pad);

  if (blur && supportsFilter(ctx)) {
    ctx.filter = `blur(${blur}px)`;
  }

  petalPath(ctx, w, h);
  ctx.fillStyle = color;
  ctx.fill();

  if (detail) {
    /* Spine down the long axis, and a lit upper edge. Both baked in, so the
       "this is a blade" reading costs nothing at draw time. */
    ctx.filter = "none";

    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.lineWidth = Math.max(1, h * 0.075);
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.54);
    ctx.lineTo(w * 0.9, h * 0.5);
    ctx.stroke();

    ctx.globalAlpha = 0.42;
    ctx.lineWidth = Math.max(1, h * 0.055);
    ctx.beginPath();
    ctx.moveTo(w, h * 0.5);
    ctx.bezierCurveTo(w * 0.6, h * 0.5 - h * 0.49, w * 0.24, h * 0.5 - h * 0.44, 0, h * 0.5 - h * 0.06);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  return { canvas, w: width, h: height };
};

export class BleachRenderer {
  constructor({ ctx, canvas, width, height, dpr, duration }) {
    this.ctx = ctx;
    this.canvas = canvas;
    this.w = width;
    this.h = height;
    this.dpr = dpr;
    this.duration = duration;
    this.t = 0;
    this.washing = false;

    this.cx = width / 2;
    this.cy = height / 2;

    const colors = [...PALETTE, SPARKLE];

    this.sharp = colors.map((color) => makeSprite(color, { width: 128, height: 64, detail: true }));
    this.soft = colors.map((color) => makeSprite(color, { width: 56, height: 30, blur: 2.4 }));

    const budget = particleBudget(width, height, { divisor: 380, min: 620, max: 2600 });

    this.far = this.seed(Math.round(budget * 0.42), "far");
    this.mid = this.seed(Math.round(budget * 0.42), "mid");
    this.near = this.seed(Math.round(budget * 0.16), "near");
    this.bloom = 0;
  }

  seed(count, layer) {
    const list = [];

    for (let i = 0; i < count; i += 1) {
      list.push(this.makePetal(layer));
    }

    return list;
  }

  makePetal(layer) {
    const petal = { layer, dead: false };
    this.spawn(petal, true);
    return petal;
  }

  /* `burst` is the opening blast out of the centre point; afterwards petals
     re-enter from an edge so the drift keeps its density. */
  spawn(petal, burst) {
    const layer = petal.layer;
    const sparkle = Math.random() < 0.05;

    petal.sprite = sparkle ? 4 : (Math.random() * PALETTE.length) | 0;
    petal.angle = rand(0, TAU);
    petal.spin = rand(0, TAU);
    petal.phase = rand(0, TAU);
    petal.dead = false;

    if (layer === "far") {
      petal.len = rand(4, 8.5);
      petal.alpha = rand(0.28, 0.46);
      petal.spinRate = rand(-1.4, 1.4);
      petal.flipRate = rand(0.7, 1.9) * (Math.random() < 0.5 ? -1 : 1);
      petal.swayAmp = rand(6, 16);
    } else if (layer === "mid") {
      petal.len = rand(7, 14);
      petal.alpha = rand(0.78, 1);
      petal.spinRate = rand(-2.4, 2.4);
      petal.flipRate = rand(1.2, 3.4) * (Math.random() < 0.5 ? -1 : 1);
      petal.swayAmp = rand(10, 26);
    } else {
      petal.len = rand(13, 27);
      petal.alpha = rand(0.5, 0.85);
      petal.spinRate = rand(-1.1, 1.1);
      petal.flipRate = rand(0.9, 2.6) * (Math.random() < 0.5 ? -1 : 1);
      petal.swayAmp = rand(14, 34);
    }

    petal.wid = petal.len * rand(0.3, 0.42);
    petal.swayFreq = rand(1.6, 3.6);
    petal.swirl = Math.random() < 0.5 ? -1 : 1;

    if (burst) {
      const angle = rand(0, TAU);
      const speed = (layer === "near" ? rand(1500, 2900) : rand(700, 2100)) * rand(0.6, 1);

      petal.birth = Math.pow(Math.random(), 1.7) * 520;
      petal.x = this.cx + Math.cos(angle) * rand(0, 16);
      petal.y = this.cy + Math.sin(angle) * rand(0, 16);
      petal.vx = Math.cos(angle) * speed;
      petal.vy = Math.sin(angle) * speed;
      return;
    }

    petal.birth = -1;

    /* Near petals re-enter fast enough to cross the viewport in ~400ms; the
       other layers just drift back in. */
    const fast = layer === "near" && Math.random() < 0.45;
    const speed = fast ? this.w / 0.4 : rand(60, 260);
    const edge = (Math.random() * 4) | 0;
    const inward = rand(-0.5, 0.5);

    if (edge === 0) {
      petal.x = -40;
      petal.y = rand(0, this.h);
      petal.vx = speed;
      petal.vy = speed * inward;
    } else if (edge === 1) {
      petal.x = this.w + 40;
      petal.y = rand(0, this.h);
      petal.vx = -speed;
      petal.vy = speed * inward;
    } else if (edge === 2) {
      petal.x = rand(0, this.w);
      petal.y = -40;
      petal.vx = speed * inward;
      petal.vy = speed;
    } else {
      petal.x = rand(0, this.w);
      petal.y = this.h + 40;
      petal.vx = speed * inward;
      petal.vy = -speed;
    }
  }

  start() {
    this.t = 0;
    this.bloom = 1;
  }

  /* Each incantation word hands back its rect and breaks into a cluster of
     petals thrown off its own position. */
  disperse(rects) {
    rects.forEach((rect) => {
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      /* a word throws off a cluster proportional to its own width */
      const count = clamp(Math.round(rect.width / 4), 12, 110);

      for (let i = 0; i < count; i += 1) {
        const petal = this.makePetal(Math.random() < 0.3 ? "near" : "mid");
        const angle = rand(0, TAU);
        const speed = rand(90, 460);

        petal.birth = -1;
        petal.x = x + rand(-rect.width * 0.4, rect.width * 0.4);
        petal.y = y + rand(-rect.height * 0.3, rect.height * 0.3);
        petal.vx = Math.cos(angle) * speed;
        petal.vy = Math.sin(angle) * speed - rand(20, 120);

        (petal.layer === "near" ? this.near : this.mid).push(petal);
      }
    });
  }

  beginWash() {
    this.washing = true;
  }

  resize(width, height, dpr) {
    this.w = width;
    this.h = height;
    this.dpr = dpr;
    this.cx = width / 2;
    this.cy = height / 2;
  }

  tick(dt) {
    this.t += dt;

    const seconds = dt / 1000;
    const drag = decay(0.972, dt);

    /* Last beat: stop recycling, thin the petals out, and let the background
       climb to the end theme so the wash reads as the blossoms doing it. */
    const lighten = smoothstep(this.duration - LIGHTEN_MS, this.duration - 40, this.t);
    const thinning = smoothstep(this.duration - THIN_MS, this.duration, this.t);
    const recycle = thinning < 0.08;
    const fade = 1 - easeOutCubic(thinning);

    this.step(this.far, seconds, dt, drag, recycle);
    this.step(this.mid, seconds, dt, drag, recycle);
    this.step(this.near, seconds, dt, drag, recycle);

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (lighten > 0) {
      ctx.fillStyle = rgba(END_BG, lighten);
      ctx.fillRect(0, 0, this.w, this.h);
    }

    this.drawBloom(dt);

    ctx.globalCompositeOperation = "source-over";
    this.draw(this.far, this.soft, fade, false);
    this.draw(this.mid, this.sharp, fade, false);

    /* Bloom where the close petals overlap, and only there. */
    ctx.globalCompositeOperation = "lighter";
    this.draw(this.near, this.sharp, fade * 0.85, true);

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  step(list, seconds, dt, drag, recycle) {
    const cx = this.cx;
    const cy = this.cy;
    const blend = 1 - decay(0.94, dt);

    for (let i = 0; i < list.length; i += 1) {
      const p = list[i];

      if (p.birth > 0) {
        p.birth -= dt;
        continue;
      }

      p.vx *= drag;
      p.vy *= drag;
      p.vy += 34 * seconds;

      const dx = p.x - cx;
      const dy = p.y - cy;
      const r = Math.hypot(dx, dy) || 1;
      const swirl = (p.swirl * 260) / (1 + r * 0.004);

      p.vx += (-dy / r) * swirl * seconds;
      p.vy += (dx / r) * swirl * seconds;

      p.phase += p.swayFreq * seconds;

      p.x += (p.vx + Math.sin(p.phase) * p.swayAmp) * seconds;
      p.y += p.vy * seconds;

      p.angle += p.spinRate * seconds;
      p.spin += p.flipRate * seconds;

      /* Near petals lead with the tip, the way a thrown blade does. */
      if (p.layer === "near") {
        let diff = Math.atan2(p.vy, p.vx) - p.angle;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        p.angle += diff * blend * 0.5;
      }

      const margin = 60;

      if (p.x < -margin || p.x > this.w + margin || p.y < -margin || p.y > this.h + margin) {
        if (recycle) {
          this.spawn(p, false);
        } else {
          p.dead = true;
        }
      }
    }
  }

  draw(list, sprites, fade, trails) {
    if (fade <= 0.004) {
      return;
    }

    const ctx = this.ctx;
    const dpr = this.dpr;

    for (let i = 0; i < list.length; i += 1) {
      const p = list[i];

      if (p.birth > 0 || p.dead) {
        continue;
      }

      const sprite = sprites[p.sprite];
      const cos = Math.cos(p.angle);
      const sin = Math.sin(p.angle);

      /* cos(spin) squashes the petal across its long axis: it turns, flattens
         to an edge, flips and comes back. The glint compensates the alpha so
         the edge still catches light instead of blinking out. */
      const q = Math.cos(p.spin);
      const flip = q < 0 ? -1 : 1;
      const squash = Math.max(Math.abs(q), 0.06);
      const glint = 1 + (1 - squash) * 0.35;

      const sx = (p.len / sprite.w) * dpr;
      const sy = ((p.wid * squash * flip) / sprite.h) * dpr;

      ctx.globalAlpha = clamp(p.alpha * fade * glint, 0, 1);
      ctx.setTransform(cos * sx, sin * sx, -sin * sy, cos * sy, p.x * dpr, p.y * dpr);
      ctx.drawImage(sprite.canvas, -sprite.w / 2, -sprite.h / 2, sprite.w, sprite.h);

      if (!trails) {
        continue;
      }

      /* Motion blur on the near layer: a short trail of stamps behind the
         petal, spaced by its own velocity. */
      const speed = Math.hypot(p.vx, p.vy);

      if (speed < 420) {
        continue;
      }

      const step = Math.min(speed * 0.0016, 26);

      for (let k = 1; k <= 3; k += 1) {
        const back = step * k;
        ctx.globalAlpha = clamp(p.alpha * fade * (0.22 - k * 0.05), 0, 1);
        ctx.setTransform(
          cos * sx,
          sin * sx,
          -sin * sy,
          cos * sy,
          (p.x - (p.vx / speed) * back) * dpr,
          (p.y - (p.vy / speed) * back) * dpr
        );
        ctx.drawImage(sprite.canvas, -sprite.w / 2, -sprite.h / 2, sprite.w, sprite.h);
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
  }

  /* The emission point itself: a short bloom where the blade comes apart. */
  drawBloom(dt) {
    if (this.bloom <= 0.002) {
      return;
    }

    this.bloom = Math.max(0, this.bloom - dt / 320);

    const ctx = this.ctx;
    const radius = 40 + (1 - this.bloom) * 280;
    const gradient = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, radius);

    gradient.addColorStop(0, `rgba(255,244,248,${(this.bloom * 0.9).toFixed(3)})`);
    gradient.addColorStop(0.4, `rgba(255,162,190,${(this.bloom * 0.45).toFixed(3)})`);
    gradient.addColorStop(1, "rgba(255,158,196,0)");

    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = gradient;
    ctx.fillRect(this.cx - radius, this.cy - radius, radius * 2, radius * 2);
    ctx.globalCompositeOperation = "source-over";
  }

  destroy() {
    this.far = [];
    this.mid = [];
    this.near = [];
    this.sharp = [];
    this.soft = [];
    this.ctx = null;
    this.canvas = null;
  }
}
