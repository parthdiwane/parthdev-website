(() => {
  const storageKey = "theme-preference";
  const root = document.documentElement;
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const resolveTheme = (theme) => {
    if (theme === "dark") {
      return "dark";
    }

    if (theme === "light") {
      return "light";
    }

    return mediaQuery.matches ? "dark" : "light";
  };

  const getStoredTheme = () => {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  };

  const applyTheme = (theme) => {
    const resolvedTheme = resolveTheme(theme);
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.colorScheme = resolvedTheme;
    root.dataset.theme = resolvedTheme;
  };

  const setTheme = (theme) => {
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      // Ignore storage write failures and keep applying in memory.
    }

    applyTheme(theme);
  };

  const syncWithSystemTheme = () => {
    if (getStoredTheme()) {
      return;
    }

    applyTheme("system");
    window.dispatchEvent(new CustomEvent("themechange"));
  };

  applyTheme(getStoredTheme() || "system");
  mediaQuery.addEventListener("change", syncWithSystemTheme);

  window.siteTheme = {
    getTheme: () => getStoredTheme() || "system",
    getResolvedTheme: () => root.dataset.theme || resolveTheme(getStoredTheme() || "system"),
    setTheme,
    toggleTheme: () => {
      setTheme(resolveTheme(getStoredTheme() || "system") === "dark" ? "light" : "dark");
      window.dispatchEvent(new CustomEvent("themechange"));
    },
  };

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
        boxShadow: {
          panel: "var(--shadow-panel)",
        },
        backgroundImage: {
          shell: "var(--bg-shell)",
          panel: "var(--bg-panel)",
        },
      },
    },
  };
})();
