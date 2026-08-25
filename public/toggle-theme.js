const primaryColorScheme = "light"; // "light" | "dark"

// Get theme data from local storage
const currentTheme = localStorage.getItem("theme");

function getPreferTheme() {
  // return theme value in local storage if it is set
  if (currentTheme) return currentTheme;

  // return primary color scheme if it is set
  if (primaryColorScheme) return primaryColorScheme;

  // return user device's prefer color scheme
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

let themeValue = getPreferTheme();

function setPreference() {
  localStorage.setItem("theme", themeValue);
  reflectPreference();
}

// Flip the theme with a circular reveal that radiates from the sun/moon icon,
// using the View Transitions API. Falls back to an instant switch when the API
// is unavailable or the user prefers reduced motion.
function toggleTheme() {
  const nextTheme = themeValue === "light" ? "dark" : "light";
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (!document.startViewTransition || prefersReducedMotion) {
    themeValue = nextTheme;
    setPreference();
    return;
  }

  // Anchor the reveal at the centre of the toggle button (the icon).
  const btn = document.querySelector("#theme-btn");
  const rect = btn.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  // Anchor for the reveal, shared with CSS so the new layer starts clipped to a
  // zero-radius circle at the icon — that pre-clipped base state is what kills
  // the one-frame flash of the full new theme. Scope styling to this toggle so
  // it never affects page-navigation transitions.
  const root = document.documentElement;
  root.style.setProperty("--vt-x", `${x}px`);
  root.style.setProperty("--vt-y", `${y}px`);
  root.classList.add("theme-anim");

  const transition = document.startViewTransition(() => {
    themeValue = nextTheme;
    setPreference();
  });

  transition.finished.finally(() => {
    root.classList.remove("theme-anim");
    root.style.removeProperty("--vt-x");
    root.style.removeProperty("--vt-y");
  });

  transition.ready.then(() => {
    // Grow the NEW theme outward from the icon, like a drop of paint spreading:
    // creeps out slowly, then accelerates.
    root.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 900,
        easing: "cubic-bezier(0.7, 0, 0.84, 0)",
        fill: "forwards",
        pseudoElement: "::view-transition-new(root)",
      }
    );
  });
}

function reflectPreference() {
  document.firstElementChild.setAttribute("data-theme", themeValue);

  document.querySelector("#theme-btn")?.setAttribute("aria-label", themeValue);

  // Get a reference to the body element
  const body = document.body;

  // Check if the body element exists before using getComputedStyle
  if (body) {
    // Get the computed styles for the body element
    const computedStyles = window.getComputedStyle(body);

    // Get the background color property
    const bgColor = computedStyles.backgroundColor;

    // Set the background color in <meta theme-color ... />
    document
      .querySelector("meta[name='theme-color']")
      ?.setAttribute("content", bgColor);
  }
}

// set early so no page flashes / CSS is made aware
reflectPreference();

window.onload = () => {
  function setThemeFeature() {
    // set on load so screen readers can get the latest value on the button
    reflectPreference();

    // now this script can find and listen for clicks on the control
    document
      .querySelector("#theme-btn")
      ?.addEventListener("click", toggleTheme);
  }

  setThemeFeature();

  // Runs on view transitions navigation
  document.addEventListener("astro:after-swap", setThemeFeature);
};

// sync with system changes
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", ({ matches: isDark }) => {
    themeValue = isDark ? "dark" : "light";
    setPreference();
  });
