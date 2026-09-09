import { applyTheme } from "../theme.js";
import { clamp, sizeCanvas } from "./util.js";

/* ==========================================================================
   Sequence orchestrator

   One state machine, three configs. Every phase is driven by accumulated
   delta time rather than frame counts, so the timing is identical at 60Hz
   and 120Hz; the only thing rAF is asked for is "how long since last time".

   DISSOLVE -> INCANT -> HOLD -> TECHNIQUE -> WASH -> RETURN
   ========================================================================== */

const root = document.documentElement;

const DISSOLVE_MS = 700;
const INCANT_MS = 1200;
const HOLD_MS = 500;
const WASH_MS = 800;
const RETURN_MS = 900;

/* One glyph's reveal. The per-character stagger is compressed from the config
   value only as far as it has to be for the last glyph to land inside INCANT. */
const GLYPH_MS = 520;

/* Long frames (tab throttling, a GC pause) are clamped rather than integrated,
   so a stall slows the sequence down instead of teleporting through it. */
const MAX_DT = 50;

/* Block-level units that fade independently. Deliberately structural rather
   than a hand-listed set of ids, so editing the page copy cannot break it. */
const UNIT_SELECTOR = [
  ".nav",
  ".site-foot",
  ".wrap section > p",
  ".wrap section > h2",
  ".wrap section > h3",
  ".subblock > h3",
  ".entry",
  ".project",
  ".contact",
].join(",");

/* One span per code point, so "Mangekyō Sharingan" splits into glyphs and not
   into UTF-16 halves. Spaces keep their slot -- as a non-breaking space,
   written escaped so it stays visible in source -- so the tracking collapse
   stays evenly paced across the whole line. */
const splitGlyphs = (text) => {
  const fragment = document.createDocumentFragment();
  let index = 0;

  for (const character of text) {
    const span = document.createElement("span");
    span.className = "glyph";
    span.textContent = character === " " ? "\u00a0" : character;
    span.style.setProperty("--i", index);
    fragment.appendChild(span);
    index += 1;
  }

  return fragment;
};

export class Orchestrator {
  constructor({ configs, triggers, page }) {
    this.configs = configs;
    this.triggers = triggers;
    this.page = page;

    this.active = null;
    this.running = false;
    this.paused = false;
    this.raf = 0;
    this.safety = 0;

    this.canvas = null;
    this.ctx = null;
    this.renderer = null;
    this.incant = null;
    this.glyphs = [];
    this.units = [];
    this.origin = null;
    this.dispersed = false;

    this.frame = this.frame.bind(this);
    this.onKey = this.onKey.bind(this);
    this.onPointer = this.onPointer.bind(this);
    this.onVisibility = this.onVisibility.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  /* ---------------------------------------------------------------- play */

  play(key, trigger) {
    if (this.running) {
      return false;
    }

    const config = this.configs[key];

    if (!config) {
      return false;
    }

    this.active = config;
    this.origin = trigger || null;
    this.running = true;
    this.paused = false;
    this.dispersed = false;

    this.phases = [
      ["DISSOLVE", DISSOLVE_MS],
      ["INCANT", INCANT_MS],
      ["HOLD", HOLD_MS],
      ["TECHNIQUE", config.technique],
      ["WASH", WASH_MS],
      ["RETURN", RETURN_MS],
    ];

    this.phaseIndex = -1;
    this.phaseTime = 0;

    this.setTriggersDisabled(true);
    this.lockScroll();

    window.addEventListener("keydown", this.onKey, true);
    window.addEventListener("pointerdown", this.onPointer, true);
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVisibility);

    const total = this.phases.reduce((sum, phase) => sum + phase[1], 0);
    this.safety = window.setTimeout(() => this.finish(), total + 5000);

    this.advance();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);

    return true;
  }

  /* --------------------------------------------------------------- loop */

  frame(now) {
    this.raf = requestAnimationFrame(this.frame);

    const dt = clamp(now - this.last, 0, MAX_DT);
    this.last = now;

    try {
      this.step(dt);
    } catch (error) {
      console.error("[technique] sequence failed", error);
      this.finish();
    }
  }

  step(dt) {
    /* A frame queued before finish() ran would otherwise walk off the end of
       the phase list, or read this.active after cleanup nulled it. */
    if (!this.running) {
      return;
    }

    this.phaseTime += dt;

    /* A single long frame can span more than one phase; walk them all so the
       state machine can never end up behind the clock. */
    while (this.phaseIndex < this.phases.length) {
      const duration = this.phases[this.phaseIndex][1];

      if (this.phaseTime < duration) {
        break;
      }

      this.phaseTime -= duration;

      if (!this.advance()) {
        return;
      }
    }

    const [name, duration] = this.phases[this.phaseIndex];

    if (name === "TECHNIQUE") {
      if (!this.dispersed && this.phaseTime / duration >= this.active.disperseAt) {
        this.disperse();
      }
      this.renderer?.tick(dt);
    } else if (name === "WASH") {
      this.renderer?.tick(dt);
    }
  }

  /* Returns false once the sequence has run off the end of the phase list. */
  advance() {
    this.phaseIndex += 1;

    if (this.phaseIndex >= this.phases.length) {
      this.finish();
      return false;
    }

    this.enter(this.phases[this.phaseIndex][0]);
    return true;
  }

  enter(name) {
    const config = this.active;

    if (name === "DISSOLVE") {
      this.units = this.collectUnits();
      this.stagger(this.units, DISSOLVE_MS, 25, 340, "cubic-bezier(.4,0,.6,.15)");
      this.buildIncant(config);
      /* Next frame, so the delays are in place before the class flips. */
      requestAnimationFrame(() => root.classList.add("is-dissolved"));
      return;
    }

    if (name === "INCANT") {
      /* The markup is built during DISSOLVE so layout and font work are paid
         for early; `is-live` is what actually releases the reveal. */
      this.incant?.classList.add("is-live");
      return;
    }

    if (name === "HOLD") {
      /* Built a phase early so the first technique frame is not also the
         frame that allocates every offscreen buffer. */
      this.createRenderer(config);
      return;
    }

    if (name === "TECHNIQUE") {
      this.renderer?.start();
      return;
    }

    if (name === "WASH") {
      applyTheme(config.theme, { duration: 400 });
      this.renderer?.beginWash?.();

      if (this.canvas) {
        this.canvas.style.setProperty("--wash-dur", `${WASH_MS}ms`);
        this.canvas.classList.add("is-washing");
      }
      return;
    }

    if (name === "RETURN") {
      this.destroyRenderer();
      this.removeIncant();
      /* Bottom to top this time, so the page inhales rather than repeating
         the same downward wipe. */
      this.stagger(this.units.slice().reverse(), RETURN_MS, 28, 480, "cubic-bezier(.2,.7,.3,1)");
      requestAnimationFrame(() => root.classList.remove("is-dissolved"));
    }
  }

  /* ------------------------------------------------------------ dissolve */

  collectUnits() {
    const seen = new Set();
    const units = [];

    document.querySelectorAll(UNIT_SELECTOR).forEach((element) => {
      if (seen.has(element)) {
        return;
      }

      /* Skip anything an ancestor unit already covers -- fading both would
         square the opacity falloff on the nested one. */
      const owner = element.parentElement?.closest(".entry, .project, .contact");

      if (owner) {
        return;
      }

      seen.add(element);
      units.push(element);
    });

    return units.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  }

  /* Spreads `elements` across `window` ms: `step` per element, but compressed
     if the list is long enough that the tail would overrun the phase. */
  stagger(elements, window_, step, fade, ease) {
    const count = elements.length;
    const gap = Math.min(step, (window_ - fade) / Math.max(1, count - 1));

    elements.forEach((element, index) => {
      element.classList.add("dissolve-unit");
      element.style.setProperty("--dsv-dur", `${fade}ms`);
      element.style.setProperty("--dsv-delay", `${Math.round(index * gap)}ms`);
      element.style.setProperty("--dsv-ease", ease);
    });
  }

  /* ----------------------------------------------------------- incantation */

  buildIncant(config) {
    const host = document.createElement("div");
    host.className = "incant";
    host.setAttribute("aria-hidden", "true");
    host.style.setProperty("--inc-core", config.core);
    host.style.setProperty("--inc-halo", config.halo);

    const stack = document.createElement("div");
    stack.className = "incant__stack";

    const lines = config.word ? [config.word, config.name] : [config.name];
    const longest = Math.max(...lines.map((line) => [...line].length));
    const gap = Math.min(config.stagger, (INCANT_MS - GLYPH_MS) / Math.max(1, longest - 1));

    host.style.setProperty("--glyph-dur", `${GLYPH_MS}ms`);
    host.style.setProperty("--glyph-stagger", `${gap.toFixed(2)}ms`);

    lines.forEach((text, lineIndex) => {
      const line = document.createElement("p");
      line.className =
        "incant__line " + (config.word && lineIndex === 0 ? "incant__line--word" : "incant__line--name");
      line.appendChild(splitGlyphs(text));
      stack.appendChild(line);
    });

    host.appendChild(stack);
    document.body.appendChild(host);

    this.incant = host;
    this.glyphs = Array.from(host.querySelectorAll(".glyph"));
  }

  disperse() {
    this.dispersed = true;

    if (!this.incant) {
      return;
    }

    const mode = this.active.disperse;

    /* Read every rect before writing anything back, so this costs one layout
       instead of one per glyph. */
    const rects = this.glyphs.map((glyph) => glyph.getBoundingClientRect());

    if (mode === "implode") {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;

      this.glyphs.forEach((glyph, index) => {
        const rect = rects[index];
        glyph.style.setProperty("--dx", `${((cx - (rect.left + rect.width / 2)) * 0.92).toFixed(1)}px`);
        glyph.style.setProperty("--dy", `${((cy - (rect.top + rect.height / 2)) * 0.92).toFixed(1)}px`);
      });
    }

    this.incant.classList.add(`incant--${mode}`);
    this.renderer?.disperse?.(rects.filter((rect) => rect.width > 0.5));
  }

  removeIncant() {
    this.incant?.remove();
    this.incant = null;
    this.glyphs = [];
  }

  /* -------------------------------------------------------------- canvas */

  createRenderer(config) {
    const canvas = document.createElement("canvas");
    canvas.className = "technique-canvas";
    canvas.setAttribute("aria-hidden", "true");

    const ctx = canvas.getContext("2d", { alpha: true });

    if (!ctx) {
      return;
    }

    document.body.appendChild(canvas);
    const { w, h, dpr } = sizeCanvas(canvas, ctx);

    this.canvas = canvas;
    this.ctx = ctx;
    this.renderer = config.create({
      ctx,
      canvas,
      width: w,
      height: h,
      dpr,
      duration: config.technique,
      wash: WASH_MS,
      page: this.page,
    });
  }

  /* `fade` lets the canvas finish an opacity transition before it leaves the
     DOM; the renderer always stops drawing immediately either way. */
  destroyRenderer(fade = 0) {
    try {
      this.renderer?.destroy();
    } catch (error) {
      console.error("[technique] renderer teardown failed", error);
    }

    this.renderer = null;

    const canvas = this.canvas;
    this.canvas = null;
    this.ctx = null;

    if (!canvas) {
      return;
    }

    if (fade > 0) {
      window.setTimeout(() => canvas.remove(), fade);
    } else {
      canvas.remove();
    }
  }

  /* --------------------------------------------------------------- input */

  onKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      this.skip();
    }
  }

  onPointer() {
    this.skip();
  }

  onVisibility() {
    if (document.hidden) {
      if (!this.running || this.paused) {
        return;
      }
      this.paused = true;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      root.classList.add("is-paused");
    } else {
      if (!this.running || !this.paused) {
        return;
      }
      this.paused = false;
      root.classList.remove("is-paused");
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  onResize() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    const { w, h, dpr } = sizeCanvas(this.canvas, this.ctx);
    this.renderer?.resize?.(w, h, dpr);
  }

  /* ---------------------------------------------------------------- exit */

  skip() {
    if (!this.running) {
      return;
    }

    if (this.canvas) {
      this.canvas.style.transition = "opacity 180ms linear";
      this.canvas.style.opacity = "0";
    }

    this.finish({ restore: 260, fadeCanvas: 200 });
  }

  /* The single teardown path. Everything play() touched is undone here --
     canvas, incantation, scroll lock, inline styles, disabled triggers --
     whether the sequence completed, was skipped, or threw. */
  finish({ restore = 0, fadeCanvas = 0 } = {}) {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.paused = false;

    cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.clearTimeout(this.safety);

    window.removeEventListener("keydown", this.onKey, true);
    window.removeEventListener("pointerdown", this.onPointer, true);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);

    /* The theme is applied here too in case we are unwinding from an error
       before WASH ever ran -- the click should still have done something. */
    applyTheme(this.active.theme, { duration: restore ? 200 : 400 });

    this.destroyRenderer(fadeCanvas);
    this.removeIncant();

    if (restore) {
      this.stagger(this.units, restore, 0, restore, "ease-out");
    }

    root.classList.remove("is-dissolved", "is-paused");

    const cleanup = () => {
      this.units.forEach((element) => {
        element.classList.remove("dissolve-unit");
        element.style.removeProperty("--dsv-dur");
        element.style.removeProperty("--dsv-delay");
        element.style.removeProperty("--dsv-ease");
      });

      root.classList.remove("is-sequence");
      root.style.removeProperty("--shake-x");
      root.style.removeProperty("--shake-y");
      this.page?.classList.remove("page--ghost");
      this.page?.style.removeProperty("--ghost-o");
      this.page?.style.removeProperty("--ghost-blur");
      this.page?.style.removeProperty("--ghost-scale");
      root.style.removeProperty("--dsv-floor");

      this.unlockScroll();
      this.setTriggersDisabled(false);
      this.origin?.focus({ preventScroll: true });

      this.units = [];
      this.active = null;
      this.origin = null;
    };

    if (restore) {
      window.setTimeout(cleanup, restore + 40);
    } else {
      cleanup();
    }
  }

  /* --------------------------------------------------------------- chrome */

  setTriggersDisabled(disabled) {
    this.triggers.forEach((trigger) => {
      trigger.disabled = disabled;
    });
  }

  lockScroll() {
    this.scrollY = window.scrollY;
    const gutter = window.innerWidth - root.clientWidth;

    root.style.setProperty("--lock-top", `${-this.scrollY}px`);
    root.style.setProperty("--scrollbar-w", `${gutter}px`);
    root.classList.add("is-sequence");
  }

  unlockScroll() {
    root.classList.remove("is-sequence");
    root.style.removeProperty("--lock-top");
    root.style.removeProperty("--scrollbar-w");

    /* html has scroll-behavior:smooth; restoring the offset must be a jump,
       not a half-second glide back to where the user already was. */
    const behavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, this.scrollY || 0);
    root.style.scrollBehavior = behavior;
  }
}

export { DISSOLVE_MS, INCANT_MS, HOLD_MS, WASH_MS, RETURN_MS };
