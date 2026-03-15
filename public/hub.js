// hub.js — Daniel's Hub landing page only
// Does NOT conflict with the existing theme.js used by subpages.

function hubToggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";
  html.setAttribute("data-theme", next);
  localStorage.setItem("hub-theme", next);
  document.getElementById("themeIcon").textContent = next === "dark" ? "☽" : "☀";
}

(function init() {
  // Restore saved theme
  const saved = localStorage.getItem("hub-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved ?? (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
  const icon = document.getElementById("themeIcon")
  if (icon) icon.textContent = theme === "dark" ? "☽" : "☀";

  // Set --i on each card for staggered animation delay
  const cards = document.querySelectorAll(".hub-card");
  cards.forEach((card, i) => card.style.setProperty("--i", i));
})();
