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
    stagger: 45,
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
    stagger: 45,
    technique: 2800,
    disperseAt: 0.4,
    disperse: "implode",
    sound: false,
    create: (options) => new JJKRenderer(options),
  },

  naruto: {
    key: "naruto",
    theme: "sharingan",
    /* single line, and harsher: 30ms between glyphs instead of 45 */
    word: null,
    name: "Eternal Mangekyō Sharingan",
    core: "#FF4D4D",
    halo: "rgba(224,27,36,.45)",
    stagger: 30,
    technique: 2400,
    disperseAt: 0.4,
    disperse: "burn",
    sound: true,
    create: (options) => new NarutoRenderer(options),
  },
};
