/* Theme application.

   A technique theme lasts for the visit and no longer. The site's own dark
   palette is what every load starts from, so there is nothing to persist and
   no pre-paint snippet to keep in sync. */

export const THEMES = ["default", "sakura", "void", "sharingan"];

const root = document.documentElement;
let shiftTimer = 0;

/* Clear the key earlier builds wrote, so anyone carrying a stored theme is
   not left wondering why their site is pink. */
try {
  localStorage.removeItem("pd-theme");
} catch (error) {
  /* storage unavailable; nothing to clear */
}

export const currentTheme = () => {
  const value = root.getAttribute("data-theme");
  return THEMES.includes(value) ? value : "default";
};

/* `duration` covers the blanket transition window in theme.css: 400ms normally,
   300ms for the reduced-motion crossfade. Passing 0 swaps with no transition. */
export const applyTheme = (name, { duration = 400 } = {}) => {
  const theme = THEMES.includes(name) ? name : "default";

  window.clearTimeout(shiftTimer);

  if (duration > 0) {
    root.classList.add("theme-shift");
    root.classList.toggle("theme-shift--fast", duration <= 300);
    /* Force a style flush so the class lands before the attribute changes,
       otherwise the browser batches both and skips the transition. */
    void root.offsetWidth;
  }

  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme === "sakura" || theme === "void" ? "light" : "dark";

  if (duration > 0) {
    shiftTimer = window.setTimeout(() => {
      root.classList.remove("theme-shift", "theme-shift--fast");
    }, duration + 40);
  }

  root.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  return theme;
};
