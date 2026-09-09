/* ==========================================================================
   Synthesised SFX for the sharingan. No sample files, nothing ripped: a sine
   sweep, a filtered noise burst and a sub thump, all built in Web Audio.

   The context is created inside the trigger's click handler (unlock) and only
   played from much later, so the autoplay policy is satisfied. Every entry
   point is wrapped -- if audio fails for any reason the visuals carry on.
   ========================================================================== */

const MUTE_KEY = "pd-sound";
const PEAK = 0.3;

let ctx = null;
let master = null;
let noise = null;

export const isMuted = () => {
  try {
    return localStorage.getItem(MUTE_KEY) === "off";
  } catch (error) {
    return false;
  }
};

export const setMuted = (muted) => {
  try {
    if (muted) {
      localStorage.setItem(MUTE_KEY, "off");
    } else {
      localStorage.removeItem(MUTE_KEY);
    }
  } catch (error) {
    /* storage unavailable; the toggle still works for this page view */
  }
};

const buildNoise = () => {
  const length = Math.floor(ctx.sampleRate * 0.5);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  return buffer;
};

/* Call synchronously from the user gesture so the context starts running. */
export const unlock = () => {
  if (isMuted()) {
    return;
  }

  try {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;

      if (!Ctor) {
        return;
      }

      ctx = new Ctor();

      /* Belt and braces against the three voices summing past the ceiling. */
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.14;

      master = ctx.createGain();
      master.gain.value = PEAK;
      master.connect(limiter);
      limiter.connect(ctx.destination);

      noise = buildNoise();
    }

    if (ctx.state === "suspended") {
      ctx.resume();
    }
  } catch (error) {
    ctx = null;
  }
};

const ready = () => {
  if (isMuted() || !ctx || !master || ctx.state !== "running") {
    return false;
  }
  return true;
};

/* Fired on the awakening: a 1400 -> 200Hz sine sweep over 180ms, layered with
   a downward-swept noise burst that decays over ~400ms. */
export const awaken = () => {
  if (!ready()) {
    return;
  }

  try {
    const t0 = ctx.currentTime + 0.001;

    const sweep = ctx.createOscillator();
    sweep.type = "sine";
    sweep.frequency.setValueAtTime(1400, t0);
    sweep.frequency.exponentialRampToValueAtTime(200, t0 + 0.18);

    const sweepGain = ctx.createGain();
    sweepGain.gain.setValueAtTime(0.0001, t0);
    sweepGain.gain.exponentialRampToValueAtTime(0.75, t0 + 0.012);
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);

    sweep.connect(sweepGain);
    sweepGain.connect(master);
    sweep.start(t0);
    sweep.stop(t0 + 0.26);

    const burst = ctx.createBufferSource();
    burst.buffer = noise;

    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 0.9;
    band.frequency.setValueAtTime(3200, t0);
    band.frequency.exponentialRampToValueAtTime(420, t0 + 0.4);

    const burstGain = ctx.createGain();
    burstGain.gain.setValueAtTime(0.0001, t0);
    burstGain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.008);
    burstGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);

    burst.connect(band);
    band.connect(burstGain);
    burstGain.connect(master);
    burst.start(t0);
    burst.stop(t0 + 0.46);
  } catch (error) {
    /* leave the visuals alone */
  }
};

/* Fired on the flash: a short sub-bass thump under the red wash. */
export const thump = () => {
  if (!ready()) {
    return;
  }

  try {
    const t0 = ctx.currentTime + 0.001;

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(64, t0);
    sub.frequency.exponentialRampToValueAtTime(30, t0 + 0.22);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.9, t0 + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);

    sub.connect(gain);
    gain.connect(master);
    sub.start(t0);
    sub.stop(t0 + 0.42);
  } catch (error) {
    /* leave the visuals alone */
  }
};

export const release = () => {
  try {
    ctx?.close();
  } catch (error) {
    /* nothing to do */
  }

  ctx = null;
  master = null;
  noise = null;
};
