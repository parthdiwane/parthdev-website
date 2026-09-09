import { applyTheme, currentTheme } from "../theme.js";
import { CONFIGS } from "./configs.js";
import { Orchestrator } from "./orchestrator.js";
import { isMuted, setMuted, unlock, release as releaseAudio } from "./audio.js";

const triggers = Array.from(document.querySelectorAll("[data-technique]"));
const page = document.querySelector(".page");
const releaseButton = document.querySelector("[data-theme-release]");
const soundButton = document.querySelector("[data-sound-toggle]");

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const orchestrator = triggers.length ? new Orchestrator({ configs: CONFIGS, triggers, page }) : null;

/* Signals to the stylesheet that the sequence machinery is live, and stands
   the <head> fallback release handler down now that this one exists. */
document.documentElement.classList.add("js-technique");
window.__pdThemeReady = true;

triggers.forEach((trigger) => {
  const config = CONFIGS[trigger.dataset.technique];

  if (!config) {
    return;
  }

  trigger.addEventListener("click", () => {
    if (motionQuery.matches) {
      /* Skip the whole sequence and cross-fade straight to the end theme. */
      applyTheme(config.theme, { duration: 300 });
      return;
    }

    /* Has to happen inside the gesture: the sound plays two and a half
       seconds later, long after the autoplay window would have closed. */
    if (config.sound) {
      unlock();
    }

    orchestrator?.play(config.key, trigger);
  });
});

if (releaseButton) {
  releaseButton.addEventListener("click", () => {
    applyTheme("default", { duration: motionQuery.matches ? 300 : 400 });
    releaseAudio();
  });
}

if (soundButton) {
  const sync = () => {
    const muted = isMuted();
    soundButton.textContent = muted ? "sound off" : "sound on";
    soundButton.setAttribute("aria-pressed", String(muted));
    soundButton.setAttribute(
      "aria-label",
      muted ? "Sound is off. Turn technique sound on." : "Sound is on. Turn technique sound off."
    );
  };

  soundButton.addEventListener("click", () => {
    const next = !isMuted();
    setMuted(next);

    if (next) {
      releaseAudio();
    }

    sync();
  });

  sync();
}

/* Keeps the release control honest if the theme is changed from elsewhere. */
document.documentElement.addEventListener("themechange", () => {
  if (releaseButton) {
    releaseButton.setAttribute("aria-label", `Release the ${currentTheme()} theme and restore the site's own palette.`);
  }
});
