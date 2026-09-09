/* Theme application + persistence.

   The matching pre-paint snippet is inlined in each page's <head>; it must
   stay in sync with THEMES and STORAGE_KEY below. Everything here assumes the
   attribute is already present, so there is never a flash of the old palette. */

export const STORAGE_KEY = "pd-theme";
export const THEMES = ["default", "sakura", "void", "sharingan"];

const root = document.documentElement;
let shiftTimer = 0;

export const currentTheme = () => {
  const value = root.getAttribute("data-theme");
  return THEMES.includes(value) ? value : "default";
};

/* `duration` covers the blanket transition window in theme.css: 400ms normally,
   300ms for the reduced-motion crossfade. Passing 0 swaps with no transition. */
export const applyTheme = (name, { duration = 400, persist = true } = {}) => {
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

  if (persist) {
    try {
      if (theme === "default") {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, theme);
      }
    } catch (error) {
      /* Private browsing / disabled storage. The theme still applies. */
    }
  }

  if (duration > 0) {
    shiftTimer = window.setTimeout(() => {
      root.classList.remove("theme-shift", "theme-shift--fast");
    }, duration + 40);
  }

  root.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  return theme;
};
