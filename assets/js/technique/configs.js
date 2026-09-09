import { BleachRenderer } from "./renderers/bleach.js";
import { JJKRenderer } from "./renderers/jjk.js";
import { NarutoRenderer } from "./renderers/naruto.js";

/* One config per show. The orchestrator knows nothing else about them. */
export const CONFIGS = {
  bleach: {
    key: "bleach",
    theme: "sakura",
    word: "Bankai",
    name: "Senbonzakura Kageyoshi",
    core: "#FF9EC4",
    halo: "rgba(255,158,196,.4)",
    /* 3 words across 2300ms -- 790ms apart, held long enough to read */
    incantMs: 2300,
    technique: 3200,
    disperseAt: 0.4,
    disperse: "shatter",
    sound: false,
    create: (options) => new BleachRenderer(options),
  },

  jjk: {
    key: "jjk",
    theme: "void",
    word: "Domain Expansion",
    name: "Infinite Void",
    core: "#7FD4FF",
    halo: "rgba(127,212,255,.45)",
    /* 4 words across 2900ms -- 727ms apart */
    incantMs: 2900,
    technique: 2800,
    disperseAt: 0.4,
    disperse: "implode",
    sound: false,
    create: (options) => new JJKRenderer(options),
  },

  naruto: {
    key: "naruto",
    theme: "sharingan",
    /* No incantation: the eye is the whole shot. INCANT is skipped and HOLD
       shortened, so the black before the awakening is a beat, not dead air. */
    word: null,
    name: null,
    core: "#FF4D4D",
    halo: "rgba(224,27,36,.45)",
    holdMs: 300,
    technique: 2400,
    disperseAt: 0.4,
    disperse: null,
    sound: true,
    create: (options) => new NarutoRenderer(options),
  },
};
