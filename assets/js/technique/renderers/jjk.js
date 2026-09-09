import { clamp, easeOutCubic, easeInQuad, lerp, particleBudget, rand, smoothstep } from "../util.js";

/* ==========================================================================
   Domain Expansion: Infinite Void

   A domain is a space, not a spray, so this is built as one: a refracting
   membrane that swallows the viewport, an interior with real depth (three
   parallax star layers on a barrel projection, volumetric shafts, a stream
   of information falling inward), then a white-out that ends on the theme.

   Beats scale with the configured duration; the numbers below are the
   authored 2800ms timing.
   ========================================================================== */

const TAU = Math.PI * 2;
const REF = 2800;

const BEAT_SPHERE = 600;
const BEAT_VOID = 2000;

const SHAFTS = 15;
const ABERRATION_MS = 120;

/* One reusable soft dot for the foreground stars; the two dimmer layers are
   fillRects, which is the cheapest mark canvas has. */
const makeStarSprite = () => {
  const size = 24;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);

  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(214,240,255,.7)");
  gradient.addColorStop(1, "rgba(127,212,255,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return canvas;
};

export class JJKRenderer {
  constructor({ ctx, canvas, width, height, dpr, duration, page }) {
    this.ctx = ctx;
    this.canvas = canvas;
    this.w = width;
    this.h = height;
    this.dpr = dpr;
    this.duration = duration;
    this.page = page;
    this.t = 0;
    this.washing = false;
    this.pulled = 0;

    const scale = duration / REF;
    this.beatSphere = BEAT_SPHERE * scale;
    this.beatVoid = BEAT_VOID * scale;

    this.starSprite = makeStarSprite();
    this.geometry();

    const budget = particleBudget(width, height, { divisor: 900, min: 280, max: 1000 });

    this.stars = [
      this.seedStars(Math.round(budget * 0.55), 0),
      this.seedStars(Math.round(budget * 0.3), 1),
      this.seedStars(Math.round(budget * 0.15), 2),
    ];

    this.shafts = Array.from({ length: SHAFTS }, () => ({
      angle: rand(0, TAU),
      width: rand(0.02, 0.17),
      speed: rand(-0.16, 0.16),
      alpha: rand(0.05, 0.16),
      pulse: rand(0, TAU),
    }));

    this.marks = Array.from({ length: Math.round(budget * 0.3) }, () => this.seedMark({}, true));

    this.aberration = 0;
    this.aberrationFired = false;
    this.buffers = null;
  }

  geometry() {
    this.cx = this.w / 2;
    this.cy = this.h / 2;
    this.maxR = Math.hypot(this.w, this.h) / 2;
    this.r2max = this.maxR * this.maxR;
  }

  seedStars(count, layer) {
    const list = [];

    for (let i = 0; i < count; i += 1) {
      list.push({
        angle: rand(0, TAU),
        radius: Math.sqrt(Math.random()) * this.maxR * 1.15,
        spin: rand(-0.05, 0.05) * (layer + 1),
        drift: rand(-9, 26) * (layer + 1),
        size: layer === 2 ? rand(1.6, 3.4) : rand(0.6, 1.5),
        alpha: layer === 2 ? rand(0.55, 1) : rand(0.18, 0.6),
        twinkle: rand(0, TAU),
        rate: rand(1.4, 3.6),
      });
    }

    return list;
  }

  seedMark(mark, initial) {
    mark.angle = rand(0, TAU);
    mark.radius = initial ? rand(30, this.maxR * 1.1) : this.maxR * rand(1, 1.15);
    mark.speed = rand(45, 190);
    mark.len = rand(3, 14);
    mark.alpha = rand(0.06, 0.1);
    mark.tick = Math.random() < 0.3;
    return mark;
  }

  /* Barrel projection: radius compresses toward the rim, so the interior
     reads as the inside of a glass sphere rather than a flat plane. */
  project(radius) {
    const norm = clamp((radius * radius) / this.r2max, 0, 1.4);
    return radius * (1 - 0.3 * norm);
  }

  start() {
    this.t = 0;

    /* Give the page back at a whisper so the membrane has something real to
       swallow. The dissolve floor is restored the moment the bubble closes. */
    if (this.page) {
      document.documentElement.style.setProperty("--dsv-floor", "1");
      this.page.classList.add("page--ghost");
      this.page.style.setProperty("--ghost-o", "0");
    }
  }

  disperse() {
    /* The incantation is pulled into the vanishing point; the information
       stream surges inward with it. */
    this.pulled = 1;
  }

  beginWash() {
    this.washing = true;
  }

  resize(width, height, dpr) {
    this.w = width;
    this.h = height;
    this.dpr = dpr;
    this.geometry();
    this.buffers = null;
  }

  tick(dt) {
    this.t += dt;

    const ctx = this.ctx;
    const seconds = dt / 1000;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const forming = clamp(this.t / this.beatSphere, 0, 1);
    const bubbleR = easeOutCubic(forming) * this.maxR * 1.06;

    this.ghost(forming);
    this.advance(seconds);

    /* Beat 1 clips the interior to the growing sphere; after that the sphere
       is the viewport and clipping costs nothing but a save/restore. */
    const clipped = forming < 1;

    if (clipped) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, Math.max(bubbleR, 0.001), 0, TAU);
      ctx.clip();
    }

    this.drawInterior(forming);

    if (clipped) {
      ctx.restore();
      this.drawMembrane(bubbleR, forming);
    }

    this.drawWhiteout(dt);
  }

  /* Beat 1: the page comes back warped and dim, expands as the bubble pushes
     through it, and is gone by the time the sphere fills the frame. */
  ghost(forming) {
    if (!this.page) {
      return;
    }

    if (forming >= 1) {
      if (this.page.classList.contains("page--ghost")) {
        this.page.classList.remove("page--ghost");
        document.documentElement.style.setProperty("--dsv-floor", "0");
      }
      return;
    }

    const rise = smoothstep(0, 0.28, forming);
    const eaten = 1 - smoothstep(0.55, 1, forming);

    this.page.style.setProperty("--ghost-o", (rise * eaten * 0.17).toFixed(3));
    this.page.style.setProperty("--ghost-blur", `${(forming * 5.5).toFixed(2)}px`);
    this.page.style.setProperty("--ghost-scale", (1 + forming * 0.16).toFixed(3));
  }

  advance(seconds) {
    const surge = this.pulled > 0 ? 1 + this.pulled * 4 : 1;

    if (this.pulled > 0) {
      this.pulled = Math.max(0, this.pulled - seconds * 1.6);
    }

    for (let layer = 0; layer < 3; layer += 1) {
      const list = this.stars[layer];

      for (let i = 0; i < list.length; i += 1) {
        const star = list[i];
        star.angle += star.spin * seconds;
        star.radius += star.drift * seconds;
        star.twinkle += star.rate * seconds;

        if (star.radius > this.maxR * 1.2) {
          star.radius = rand(10, 60);
        } else if (star.radius < 6) {
          star.radius = this.maxR * 1.15;
        }
      }
    }

    for (let i = 0; i < this.shafts.length; i += 1) {
      const shaft = this.shafts[i];
      shaft.angle += shaft.speed * seconds;
      shaft.pulse += seconds * 0.8;
    }

    for (let i = 0; i < this.marks.length; i += 1) {
      const mark = this.marks[i];
      mark.radius -= mark.speed * surge * seconds;

      if (mark.radius < 26) {
        this.seedMark(mark, false);
      }
    }
  }

  drawInterior(forming) {
    const ctx = this.ctx;
    const inside = smoothstep(0.25, 1, forming);

    /* Deep cosmic ground, brighter at the vanishing point. */
    const gradient = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, this.maxR);
    gradient.addColorStop(0, `rgba(16,52,86,${(0.95 * inside).toFixed(3)})`);
    gradient.addColorStop(0.45, `rgba(6,18,36,${(0.97 * inside).toFixed(3)})`);
    gradient.addColorStop(1, `rgba(2,6,14,${(0.99 * inside).toFixed(3)})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.w, this.h);

    this.drawShafts(inside);
    this.drawStars(inside);
    this.drawMarks(inside);
  }

  drawShafts(inside) {
    const ctx = this.ctx;

    /* One gradient per frame, shared by every wedge; only globalAlpha varies,
       so fifteen volumetric shafts cost fifteen fills and nothing else. */
    const gradient = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, this.maxR * 1.1);
    gradient.addColorStop(0, "rgba(190,233,255,1)");
    gradient.addColorStop(0.3, "rgba(79,195,247,.55)");
    gradient.addColorStop(1, "rgba(56,169,232,0)");

    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = gradient;

    for (let i = 0; i < this.shafts.length; i += 1) {
      const shaft = this.shafts[i];

      ctx.globalAlpha = shaft.alpha * inside * (0.7 + Math.sin(shaft.pulse) * 0.3);
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.arc(this.cx, this.cy, this.maxR * 1.1, shaft.angle, shaft.angle + shaft.width);
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  drawStars(inside) {
    const ctx = this.ctx;

    ctx.globalCompositeOperation = "lighter";

    for (let layer = 0; layer < 3; layer += 1) {
      const list = this.stars[layer];

      if (layer < 2) {
        ctx.fillStyle = layer === 0 ? "#9fd8f5" : "#d6f0ff";

        for (let i = 0; i < list.length; i += 1) {
          const star = list[i];
          const radius = this.project(star.radius);
          const alpha = star.alpha * inside * (0.65 + Math.sin(star.twinkle) * 0.35);

          ctx.globalAlpha = alpha;
          ctx.fillRect(
            this.cx + Math.cos(star.angle) * radius,
            this.cy + Math.sin(star.angle) * radius,
            star.size,
            star.size
          );
        }

        continue;
      }

      for (let i = 0; i < list.length; i += 1) {
        const star = list[i];
        const radius = this.project(star.radius);
        const size = star.size * 4.5;

        ctx.globalAlpha = star.alpha * inside * (0.6 + Math.sin(star.twinkle) * 0.4);
        ctx.drawImage(
          this.starSprite,
          this.cx + Math.cos(star.angle) * radius - size / 2,
          this.cy + Math.sin(star.angle) * radius - size / 2,
          size,
          size
        );
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /* The infinite-information motif: dashes and ticks falling inward, batched
     into two strokes. Texture, not text -- it should never read as legible. */
  drawMarks(inside) {
    const ctx = this.ctx;

    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(198,236,255,1)";
    ctx.lineWidth = 1;

    for (const wantTick of [false, true]) {
      ctx.globalAlpha = 0.09 * inside;
      ctx.beginPath();

      for (let i = 0; i < this.marks.length; i += 1) {
        const mark = this.marks[i];

        if (mark.tick !== wantTick) {
          continue;
        }

        const cos = Math.cos(mark.angle);
        const sin = Math.sin(mark.angle);
        const near = this.project(mark.radius);
        const far = this.project(mark.radius + mark.len);

        if (wantTick) {
          /* short bar across the flow */
          const x = this.cx + cos * near;
          const y = this.cy + sin * near;
          ctx.moveTo(x - sin * 3, y + cos * 3);
          ctx.lineTo(x + sin * 3, y - cos * 3);
        } else {
          ctx.moveTo(this.cx + cos * near, this.cy + sin * near);
          ctx.lineTo(this.cx + cos * far, this.cy + sin * far);
        }
      }

      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /* The membrane: a bright rim with a refractive falloff inside it, plus a
     chromatic fringe from three offset copies -- which is what makes the edge
     read as glass rather than as a stroked circle. */
  drawMembrane(radius, forming) {
    const ctx = this.ctx;

    if (radius < 1) {
      return;
    }

    const fade = 1 - smoothstep(0.82, 1, forming);
    const band = Math.max(6, radius * 0.16);
    const inner = Math.max(0.001, radius - band);

    const gradient = ctx.createRadialGradient(this.cx, this.cy, inner, this.cx, this.cy, radius + band * 0.4);
    gradient.addColorStop(0, "rgba(127,212,255,0)");
    gradient.addColorStop(0.62, `rgba(127,212,255,${(0.35 * fade).toFixed(3)})`);
    gradient.addColorStop(0.86, `rgba(226,246,255,${(0.95 * fade).toFixed(3)})`);
    gradient.addColorStop(1, "rgba(127,212,255,0)");

    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.lineWidth = 1.6;
    ctx.globalAlpha = fade;

    const fringe = [
      ["rgba(255,120,150,.5)", -2.2],
      ["rgba(235,255,255,.95)", 0],
      ["rgba(110,190,255,.6)", 2.2],
    ];

    for (const [color, offset] of fringe) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, Math.max(0.5, radius + offset), 0, TAU);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /* Beat 3: light from the vanishing point overwhelms the domain. */
  drawWhiteout(dt) {
    const ctx = this.ctx;

    if (this.t < this.beatVoid && this.aberration <= 0) {
      return;
    }

    const span = Math.max(1, this.duration - this.beatVoid);
    const progress = clamp((this.t - this.beatVoid) / span, 0, 1);
    const core = easeInQuad(progress) * this.maxR * 2.3;

    if (core > 1) {
      const gradient = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, core);
      const bleach = smoothstep(0.35, 1, progress);

      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(lerp(0.24, 0.6, bleach), `rgba(184,230,255,${(0.85 + bleach * 0.15).toFixed(3)})`);
      gradient.addColorStop(lerp(0.55, 0.9, bleach), `rgba(56,169,232,${(0.6 + bleach * 0.4).toFixed(3)})`);
      gradient.addColorStop(1, `rgba(56,169,232,${(bleach * 0.9).toFixed(3)})`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.w, this.h);

      /* Once the core is past the corners the screen is white; hold it there
         so the wash has a clean surface to fade out of. */
      if (bleach > 0.55) {
        ctx.globalAlpha = smoothstep(0.55, 1, bleach);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, this.w, this.h);
        ctx.globalAlpha = 1;
      }
    }

    /* One 120ms pulse, fired the frame the core reaches the edge. */
    if (!this.aberrationFired && core >= this.maxR) {
      this.aberrationFired = true;
      this.aberration = ABERRATION_MS;
    }

    if (this.aberration > 0) {
      this.applyAberration(this.aberration / ABERRATION_MS);
      this.aberration = Math.max(0, this.aberration - dt);
    }
  }

  /* True channel split: isolate R, G and B into a scratch buffer via multiply,
     then re-add them at ±offset. Half resolution, and only for ~7 frames. */
  applyAberration(strength) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    if (!this.buffers) {
      const make = () => {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width / 2));
        canvas.height = Math.max(1, Math.round(height / 2));
        return { canvas, ctx: canvas.getContext("2d") };
      };

      this.buffers = { src: make(), work: make() };
    }

    const { src, work } = this.buffers;
    const sw = src.canvas.width;
    const sh = src.canvas.height;

    src.ctx.globalCompositeOperation = "copy";
    src.ctx.drawImage(this.canvas, 0, 0, sw, sh);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";

    const shift = 3 * this.dpr * Math.sin(strength * Math.PI);
    const channels = [
      ["#ff0000", shift],
      ["#00ff00", 0],
      ["#0000ff", -shift],
    ];

    for (const [tint, offset] of channels) {
      work.ctx.globalCompositeOperation = "copy";
      work.ctx.drawImage(src.canvas, 0, 0);
      work.ctx.globalCompositeOperation = "multiply";
      work.ctx.fillStyle = tint;
      work.ctx.fillRect(0, 0, sw, sh);

      ctx.drawImage(work.canvas, offset, 0, width, height);
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  destroy() {
    if (this.page) {
      this.page.classList.remove("page--ghost");
      this.page.style.removeProperty("--ghost-o");
      this.page.style.removeProperty("--ghost-blur");
      this.page.style.removeProperty("--ghost-scale");
    }

    document.documentElement.style.removeProperty("--dsv-floor");

    this.stars = [];
    this.shafts = [];
    this.marks = [];
    this.buffers = null;
    this.ctx = null;
    this.canvas = null;
  }
}
