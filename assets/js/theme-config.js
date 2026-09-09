/* Dark-only. Kept for the writings/ pages, which use the Tailwind CDN. */
(() => {
  const root = document.documentElement;
  root.classList.add("dark");
  root.style.colorScheme = "dark";
  root.dataset.theme = "dark";

  window.tailwind = window.tailwind || {};
  window.tailwind.config = {
    darkMode: "class",
    theme: {
      extend: {
        fontFamily: {
          serif: ['"Cormorant Garamond"', "Georgia", "serif"],
        },
        colors: {
          ink: "var(--ink)",
          mist: "var(--mist)",
          bone: "var(--bone)",
          boneSoft: "var(--bone-soft)",
          line: "var(--line)",
          lineStrong: "var(--line-strong)",
          surfaceMuted: "var(--surface-muted)",
          inverse: "var(--inverse)",
          inverseText: "var(--inverse-text)",
        },
        boxShadow: { panel: "var(--shadow-panel)" },
        backgroundImage: { shell: "var(--bg-shell)", panel: "var(--bg-panel)" },
      },
    },
  };
})();
