const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const navLinks = Array.from(document.querySelectorAll('.nav__link[href^="#"]'));
const revealElements = Array.from(document.querySelectorAll(".reveal"));
const preloader = document.getElementById("preloader");
const preloaderBar = document.getElementById("preloader-bar");

/* ---------- terminal-style character scramble ---------- */

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!<>-_/\\[]{}=+*^?#$%&";
const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

/* Walks an element's text nodes and settles them left-to-right, leaving
   the not-yet-settled characters churning through random glyphs. */
const scramble = (element) => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const parts = [];
  let node;

  while ((node = walker.nextNode())) {
    if (node.nodeValue.trim()) {
      parts.push({ node, text: node.nodeValue });
    }
  }

  const total = parts.reduce((sum, part) => sum + part.text.length, 0);

  if (!total) {
    return;
  }

  /* Finish in roughly 130 frames (~2s) regardless of how much text there is. */
  const perFrame = total / 130;
  let progress = 0;

  const step = () => {
    progress += perFrame;
    const settled = Math.floor(progress);
    let offset = 0;

    parts.forEach(({ node: textNode, text }) => {
      let output = "";

      for (let i = 0; i < text.length; i += 1) {
        const character = text[i];
        output += offset + i < settled || character.trim() === "" ? character : randomGlyph();
      }

      textNode.nodeValue = output;
      offset += text.length;
    });

    if (settled < total) {
      requestAnimationFrame(step);
      return;
    }

    parts.forEach(({ node: textNode, text }) => {
      textNode.nodeValue = text;
    });
  };

  step();
};

/* ---------- reveal on scroll ---------- */

const show = (element) => {
  element.classList.add("is-visible");

  if (!reduceMotion) {
    scramble(element);
  }
};

const startReveals = () => {
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        show(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
  );

  revealElements.forEach((element) => observer.observe(element));
};

/* ---------- preloader ---------- */

const BAR_WIDTH = 28;

const drawBar = (percent) => {
  const filled = Math.round((percent / 100) * BAR_WIDTH);
  const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
  preloaderBar.textContent = `[${bar}] ${String(Math.round(percent)).padStart(3, " ")}%`;
};

const finish = () => {
  document.body.classList.remove("is-loading");
  preloader.classList.add("is-done");
  startReveals();
  window.setTimeout(() => preloader.remove(), 500);
};

if (!preloader || !preloaderBar) {
  startReveals();
} else if (reduceMotion) {
  finish();
} else {
  let percent = 0;
  drawBar(0);

  /* Uneven increments so it reads like a real terminal job, not a CSS animation. */
  const tick = () => {
    percent = Math.min(100, percent + Math.random() * 6 + 1.5);
    drawBar(percent);

    if (percent < 100) {
      window.setTimeout(tick, Math.random() * 110 + 55);
      return;
    }

    window.setTimeout(finish, 500);
  };

  window.setTimeout(tick, 120);
}

/* ---------- nav ---------- */

navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));

    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", link.getAttribute("href"));
  });
});

const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

const syncActiveLink = () => {
  const marker = window.scrollY + window.innerHeight * 0.35;
  let activeId = sections.length ? sections[0].id : null;

  sections.forEach((section) => {
    if (section.offsetTop <= marker) {
      activeId = section.id;
    }
  });

  navLinks.forEach((link) => {
    if (link.getAttribute("href") === `#${activeId}`) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
};

syncActiveLink();
window.addEventListener("scroll", syncActiveLink, { passive: true });
window.addEventListener("resize", syncActiveLink);
