import { clamp, easeInCubic, easeOutCubic, easeOutExpo, lerp, rand, smoothstep } from "../util.js";
import { awaken, thump } from "../audio.js";

/* ==========================================================================
   Eternal Mangekyou Sharingan

   An eye, not weather. Everything is a vector path so it holds up frozen: the
   iris is a gradient with hand-struck striations, and the pattern is two
   three-blade sets built as point lists -- which is what lets them ink
   themselves in stroke-first, fill-second, instead of cross-fading on.
   ========================================================================== */

const TAU = Math.PI * 2;
const REF = 2400;

const T_IRIS = 400;
const T_PATTERN = 800;
const T_SPIN = 1200;
const T_RESOLVE = 1900;

const BLADE_STEPS = 20;
const STREAKS = 44;
const GRAIN_TILE = 128;

/* One blade, as a closed point list. The leading edge sweeps out ahead of the
   trailing one and they converge at the tip, so the silhouette is a sickle
   rather than a wedge. */
const blade = (r0, r1, sweep, width, steps) => {
  const points = [];

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const a = sweep * Math.pow(t, 1.3);
    const r = lerp(r0, r1, t);
    points.push([Math.cos(a) * r, Math.sin(a) * r]);
  }

  for (let i = steps; i >= 0; i -= 1) {
    const t = i / steps;
    const a = lerp(-width, sweep, Math.pow(t, 0.55));
    const r = lerp(r0, r1, t);
    points.push([Math.cos(a) * r, Math.sin(a) * r]);
  }

  return points;
};

export class NarutoRenderer {
  constructor({ ctx, canvas, width, height, dpr, duration }) {
    this.ctx = ctx;
    this.canvas = canvas;
    this.w = width;
    this.h = height;
    this.dpr = dpr;
    this.duration = duration;
    this.t = 0;
    this.washing = false;

    const scale = duration / REF;
    this.tIris = T_IRIS * scale;
    this.tPattern = T_PATTERN * scale;
    this.tSpin = T_SPIN * scale;
    this.tResolve = T_RESOLVE * scale;

    this.frame = 0;
    this.shakeClock = 0;
    this.shake = [0, 0];
    this.soundFired = false;
    this.thumpFired = false;

    this.grain = document.createElement("canvas");
    this.grain.width = GRAIN_TILE;
    this.grain.height = GRAIN_TILE;
    this.grainCtx = this.grain.getContext("2d");
    this.grainData = this.grainCtx.createImageData(GRAIN_TILE, GRAIN_TILE);
    this.regrain();

    this.geometry();
    this.streaks = Array.from({ length: STREAKS }, () => this.seedStreak({}, true));
  }

  geometry() {
    this.cx = this.w / 2;
    this.cy = this.h / 2;
    this.R = Math.min(this.w, this.h) * 0.22;
    this.pupil = this.R * 0.3;

    /* Sasuke's is two three-blade sets, the second offset 60 degrees and
       drawn shorter so it reads as a layer rather than a duplicate. */
    this.setA = blade(this.pupil * 1.05, this.R * 0.97, 1.15, 0.62, BLADE_STEPS);
    this.setB = blade(this.pupil * 1.02, this.R * 0.72, -1.28, 0.5, BLADE_STEPS);
  }

  seedStreak(streak, initial) {
    streak.angle = rand(0, TAU);
    streak.radius = initial ? rand(this.pupil, this.R * 1.4) : this.pupil * 1.1;
    streak.speed = rand(260, 1400);
    streak.len = rand(14, 90);
    streak.alpha = rand(0.16, 0.6);
    streak.width = rand(0.8, 2.6);
    return streak;
  }

  regrain() {
    const data = this.grainData.data;

    for (let i = 0; i < data.length; i += 4) {
      const value = (Math.random() * 255) | 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }

    this.grainCtx.putImageData(this.grainData, 0, 0);
    this.grainPattern = this.ctx.createPattern(this.grain, "repeat");
  }

  start() {
    this.t = 0;
  }

  disperse() {
    /* handled entirely by the CSS burn-out on the incantation */
  }

  beginWash() {
    this.washing = true;
  }

  resize(width, height, dpr) {
    this.w = width;
    this.h = height;
    this.dpr = dpr;
    this.geometry();
  }

  tick(dt) {
    this.t += dt;
    this.frame += 1;

    const ctx = this.ctx;
    const seconds = dt / 1000;

    if (!this.soundFired && this.t >= this.tIris) {
      this.soundFired = true;
      awaken();
    }

    if (!this.thumpFired && this.t >= this.tResolve) {
      this.thumpFired = true;
      thump();
    }

    this.updateShake(dt);
    this.updateStreaks(seconds);

    /* The ground is laid before the shake translate, so the screen edges are
       always covered no matter how far the eye is thrown. */
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.save();
    ctx.translate(this.shake[0], this.shake[1]);

    const open = this.aperture();

    this.drawGlow();
    this.drawEye(open);
    this.drawLids(open);
    this.drawFlash();

    ctx.restore();

    this.drawGrain();
  }

  /* 0 = closed, 1 = wide. The eye is shut for the awakening, snaps open on
     the iris beat and closes again on the resolve. */
  aperture() {
    if (this.t < this.tIris) {
      return 0.015;
    }

    if (this.t < this.tResolve) {
      const opening = clamp((this.t - this.tIris) / (this.tPattern - this.tIris + 60), 0, 1);
      return lerp(0.015, 1, easeOutExpo(opening));
    }

    const closing = clamp((this.t - this.tResolve) / (this.duration - this.tResolve), 0, 1);
    return 1 - easeInCubic(closing);
  }

  updateShake(dt) {
    if (this.t < this.tSpin || this.t > this.tResolve + 160) {
      if (this.shake[0] || this.shake[1]) {
        this.shake = [0, 0];
        this.pushShake();
      }
      return;
    }

    const decayed = 1 - clamp((this.t - this.tSpin) / (this.tResolve - this.tSpin), 0, 1);
    const amp = 5 * easeOutCubic(decayed) * decayed;

    /* Re-rolled on a fixed 22ms clock, not per frame, so the shake has the
       same texture at 60Hz and 120Hz instead of turning into noise. */
    this.shakeClock += dt;

    if (this.shakeClock >= 22) {
      this.shakeClock = 0;
      this.shake = [rand(-amp, amp), rand(-amp, amp)];
      this.pushShake();
    }
  }

  pushShake() {
    const root = document.documentElement;
    root.style.setProperty("--shake-x", `${this.shake[0].toFixed(2)}px`);
    root.style.setProperty("--shake-y", `${this.shake[1].toFixed(2)}px`);
  }

  updateStreaks(seconds) {
    if (this.t < this.tSpin) {
      return;
    }

    for (let i = 0; i < this.streaks.length; i += 1) {
      const streak = this.streaks[i];
      streak.radius += streak.speed * seconds;

      if (streak.radius > Math.hypot(this.w, this.h) * 0.6) {
        this.seedStreak(streak, false);
      }
    }
  }

  /* Beat 1: a dull red build behind a shut eye, leaking at the seam. */
  drawGlow() {
    const ctx = this.ctx;
    const build = smoothstep(0, this.tIris, this.t);
    const alive = this.t < this.tResolve ? 1 : 1 - smoothstep(this.tResolve, this.duration, this.t);

    if (alive <= 0) {
      return;
    }

    const radius = this.R * lerp(2.6, 4.4, build);
    const gradient = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, radius);
    const strength = lerp(0.1, 0.42, build) * alive;

    gradient.addColorStop(0, `rgba(198,22,32,${strength.toFixed(3)})`);
    gradient.addColorStop(0.45, `rgba(126,8,16,${(strength * 0.45).toFixed(3)})`);
    gradient.addColorStop(1, "rgba(60,0,6,0)");

    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = "source-over";
  }

  drawEye(open) {
    const ctx = this.ctx;

    if (open <= 0.02) {
      return;
    }

    const grow = clamp((this.t - this.tIris) / (this.tPattern - this.tIris), 0, 1);
    const scale = this.t < this.tIris ? 0 : easeOutExpo(grow);

    if (scale <= 0.001) {
      return;
    }

    const R = this.R * scale;
    const pupil = this.pupil * scale;
    const bright = smoothstep(this.tSpin, this.tResolve, this.t);

    ctx.save();
    ctx.translate(this.cx, this.cy);

    /* iris */
    const iris = ctx.createRadialGradient(0, 0, pupil * 0.6, 0, 0, R);
    iris.addColorStop(0, bright > 0 ? `rgb(${226 + bright * 29},${lerp(58, 120, bright) | 0},${lerp(58, 96, bright) | 0})` : "#E23B3B");
    iris.addColorStop(0.55, "#C1121F");
    iris.addColorStop(1, "#7A0912");

    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.fillStyle = iris;
    ctx.fill();

    /* striations, so the iris reads as drawn rather than as a gradient */
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = "#5C060D";
    ctx.lineWidth = Math.max(0.6, R * 0.012);
    ctx.beginPath();

    for (let i = 0; i < 68; i += 1) {
      const a = (i / 68) * TAU + i * 0.017;
      const inner = pupil * lerp(1.05, 1.5, (i % 5) / 5);
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * R * 0.99, Math.sin(a) * R * 0.99);
    }

    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    this.drawPattern(R, pupil);
    this.drawStreaks(R, pupil);

    /* pupil, then the dark limbal rim over everything */
    ctx.beginPath();
    ctx.arc(0, 0, pupil, 0, TAU);
    ctx.fillStyle = "#080606";
    ctx.fill();

    ctx.lineWidth = Math.max(1.2, R * 0.055);
    ctx.strokeStyle = "#4A050B";
    ctx.beginPath();
    ctx.arc(0, 0, R - ctx.lineWidth / 2, 0, TAU);
    ctx.stroke();

    /* a single specular highlight -- the thing that makes it an eye */
    ctx.globalAlpha = 0.5 + bright * 0.3;
    ctx.fillStyle = "#FFE9E9";
    ctx.beginPath();
    ctx.ellipse(-R * 0.34, -R * 0.4, R * 0.15, R * 0.1, -0.6, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  /* The pattern inks itself on: each blade strokes its outline first, then
     floods, staggered across the 400ms pattern beat. */
  drawPattern(R, pupil) {
    const ctx = this.ctx;
    const span = this.tSpin - this.tPattern;
    const raw = clamp((this.t - this.tPattern) / span, 0, 1);
    const scale = R / this.R;

    if (raw <= 0) {
      return;
    }

    let spin = 0;

    if (this.t > this.tSpin) {
      const p = clamp((this.t - this.tSpin) / (this.tResolve - this.tSpin), 0, 1);
      spin = easeOutCubic(p) * 2.5 * TAU;
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.985, 0, TAU);
    ctx.clip();

    ctx.fillStyle = "#0A0507";
    ctx.strokeStyle = "#0A0507";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, R * 0.028);

    const sets = [
      { points: this.setA, count: 3, offset: 0, spin, order: 0 },
      { points: this.setB, count: 3, offset: Math.PI / 3, spin: spin * -0.35, order: 3 },
    ];

    for (const set of sets) {
      for (let i = 0; i < set.count; i += 1) {
        const index = set.order + i;
        /* six blades laid down inside the beat, each taking 230ms */
        const start = index * 0.085;
        const p = clamp((raw - start) / 0.575, 0, 1);

        if (p <= 0) {
          continue;
        }

        ctx.save();
        ctx.rotate(set.offset + (i / set.count) * TAU + set.spin);
        ctx.scale(scale, scale);

        const points = set.points;
        const drawn = Math.max(2, Math.round(points.length * clamp(p / 0.5, 0, 1)));

        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);

        for (let k = 1; k < drawn; k += 1) {
          ctx.lineTo(points[k][0], points[k][1]);
        }

        if (p >= 0.5) {
          ctx.closePath();
          ctx.globalAlpha = smoothstep(0.5, 0.86, p);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.stroke();
        ctx.restore();
      }
    }

    /* ring around the pupil that ties the two sets together */
    if (raw > 0.55) {
      ctx.globalAlpha = smoothstep(0.55, 0.85, raw);
      ctx.lineWidth = Math.max(1, R * 0.035);
      ctx.beginPath();
      ctx.arc(0, 0, pupil * 1.55, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  drawStreaks(R, pupil) {
    if (this.t < this.tSpin) {
      return;
    }

    const ctx = this.ctx;
    const life = 1 - smoothstep(this.tResolve, this.duration, this.t);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    for (let i = 0; i < this.streaks.length; i += 1) {
      const streak = this.streaks[i];

      if (streak.radius < pupil) {
        continue;
      }

      const cos = Math.cos(streak.angle);
      const sin = Math.sin(streak.angle);
      const falloff = clamp(1 - (streak.radius - R) / (R * 5), 0, 1);

      ctx.globalAlpha = streak.alpha * falloff * life;
      ctx.strokeStyle = streak.radius < R ? "#FFD2D2" : "#FF3B30";
      ctx.lineWidth = streak.width;
      ctx.beginPath();
      ctx.moveTo(cos * streak.radius, sin * streak.radius);
      ctx.lineTo(cos * (streak.radius + streak.len), sin * (streak.radius + streak.len));
      ctx.stroke();
    }

    ctx.restore();
  }

  drawLids(open) {
    const ctx = this.ctx;
    const aperture = this.R * 1.18 * open;
    const halfWidth = this.R * 1.85;

    ctx.fillStyle = "#000000";

    /* upper */
    ctx.beginPath();
    ctx.moveTo(-2, -2);
    ctx.lineTo(this.w + 2, -2);
    ctx.lineTo(this.w + 2, this.cy);
    ctx.quadraticCurveTo(this.cx, this.cy - aperture * 2, -2, this.cy);
    ctx.closePath();
    ctx.fill();

    /* lower */
    ctx.beginPath();
    ctx.moveTo(-2, this.h + 2);
    ctx.lineTo(this.w + 2, this.h + 2);
    ctx.lineTo(this.w + 2, this.cy);
    ctx.quadraticCurveTo(this.cx, this.cy + aperture * 2, -2, this.cy);
    ctx.closePath();
    ctx.fill();

    /* lash line, plus a rim lit by whatever is behind the lids */
    const glow = this.t < this.tIris ? 1 : 0.45;

    ctx.lineWidth = Math.max(1.4, this.R * 0.035);
    ctx.strokeStyle = "#050304";
    ctx.beginPath();
    ctx.moveTo(this.cx - halfWidth, this.cy);
    ctx.quadraticCurveTo(this.cx, this.cy - aperture * 2, this.cx + halfWidth, this.cy);
    ctx.moveTo(this.cx - halfWidth, this.cy);
    ctx.quadraticCurveTo(this.cx, this.cy + aperture * 2, this.cx + halfWidth, this.cy);
    ctx.stroke();

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = glow;
    ctx.lineWidth = Math.max(1, this.R * 0.016);
    ctx.strokeStyle = "rgba(224,27,36,.55)";
    ctx.beginPath();
    ctx.moveTo(this.cx - halfWidth * 0.92, this.cy);
    ctx.quadraticCurveTo(this.cx, this.cy - aperture * 2, this.cx + halfWidth * 0.92, this.cy);
    ctx.moveTo(this.cx - halfWidth * 0.92, this.cy);
    ctx.quadraticCurveTo(this.cx, this.cy + aperture * 2, this.cx + halfWidth * 0.92, this.cy);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /* Beat 4: the flash blows out, then pulls back into the closing eye. */
  drawFlash() {
    if (this.t < this.tResolve) {
      return;
    }

    const ctx = this.ctx;
    const span = this.duration - this.tResolve;
    const p = clamp((this.t - this.tResolve) / span, 0, 1);
    const punch = p < 0.22 ? p / 0.22 : 1 - (p - 0.22) / 0.78;
    const strength = clamp(punch, 0, 1);

    if (strength <= 0.002) {
      return;
    }

    const radius = lerp(Math.hypot(this.w, this.h) * 0.75, this.R * 0.9, easeOutCubic(p));
    const gradient = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, radius);

    gradient.addColorStop(0, `rgba(255,236,236,${(strength * 0.95).toFixed(3)})`);
    gradient.addColorStop(0.35, `rgba(224,27,36,${(strength * 0.8).toFixed(3)})`);
    gradient.addColorStop(1, "rgba(120,0,8,0)");

    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = "source-over";
  }

  /* Regenerated every third frame -- grain that changes every frame strobes. */
  drawGrain() {
    if (this.frame % 3 === 0) {
      this.regrain();
    }

    if (!this.grainPattern) {
      return;
    }

    const ctx = this.ctx;
    const strength = this.t < this.tIris ? 0.075 : 0.032;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = strength;
    ctx.fillStyle = this.grainPattern;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  destroy() {
    const root = document.documentElement;
    root.style.removeProperty("--shake-x");
    root.style.removeProperty("--shake-y");

    this.streaks = [];
    this.grainPattern = null;
    this.grainData = null;
    this.grainCtx = null;
    this.grain = null;
    this.ctx = null;
    this.canvas = null;
  }
}
