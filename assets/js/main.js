const internalLinks = document.querySelectorAll('a[href^="#"]');
const revealElements = document.querySelectorAll(".reveal");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const siteHeader = document.getElementById("site-header");
const siteHeaderInner = document.getElementById("site-header-inner");
const siteNav = document.getElementById("site-nav");

revealElements.forEach((element) => {
  element.style.opacity = "0";
  element.style.transform = "translateY(24px)";
  element.style.transition = "opacity 700ms ease-out, transform 700ms ease-out";
});

internalLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const targetId = link.getAttribute("href");
    const target = document.querySelector(targetId);

    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", targetId);
  });
});

const syncHeaderState = () => {
  if (!siteHeader || !siteHeaderInner || !siteNav) {
    return;
  }

  const isCompact = window.scrollY > 24;

  siteHeaderInner.classList.toggle("py-4", !isCompact);
  siteHeaderInner.classList.toggle("py-2", isCompact);
  siteNav.classList.toggle("px-5", !isCompact);
  siteNav.classList.toggle("py-3", !isCompact);
  siteNav.classList.toggle("text-[0.92rem]", !isCompact);
  siteNav.classList.toggle("gap-x-6", !isCompact);
  siteNav.classList.toggle("px-4", isCompact);
  siteNav.classList.toggle("py-2", isCompact);
  siteNav.classList.toggle("text-[0.8rem]", isCompact);
  siteNav.classList.toggle("gap-x-4", isCompact);
};

syncHeaderState();
window.addEventListener("scroll", syncHeaderState, { passive: true });

if (reduceMotion) {
  revealElements.forEach((element) => {
    element.style.opacity = "1";
    element.style.transform = "none";
    element.style.transition = "none";
  });
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.14,
      rootMargin: "0px 0px -40px 0px",
    }
  );

  revealElements.forEach((element) => {
    observer.observe(element);
  });
}
