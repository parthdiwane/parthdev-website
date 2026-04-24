const themeToggleButtons = document.querySelectorAll("[data-theme-toggle]");

const syncThemeToggle = () => {
  if (!window.siteTheme || themeToggleButtons.length === 0) {
    return;
  }

  const isDark = window.siteTheme.getResolvedTheme() === "dark";

  themeToggleButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  });
};

syncThemeToggle();

themeToggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!window.siteTheme) {
      return;
    }

    window.siteTheme.toggleTheme();
    syncThemeToggle();
  });
});

window.addEventListener("themechange", syncThemeToggle);
