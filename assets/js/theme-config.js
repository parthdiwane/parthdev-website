/* Tailwind bridge for the writings/ pages. The palette itself lives in
   theme.css; this only wires the CSS variables into Tailwind's colour names.

   `data-theme` is owned by the technique themes (see assets/js/theme.js), so
   this file must not write to it. */
(() => {
  const root = document.documentElement;
  root.classList.add("dark");

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
