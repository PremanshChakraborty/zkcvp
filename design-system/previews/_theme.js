// Preview-only theme switcher. Not part of the design system.
(function () {
  var root = document.documentElement;

  function apply(mode) {
    if (mode === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", mode);

    document.querySelectorAll(".pv-theme button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    });
    try {
      localStorage.setItem("ds-preview-theme", mode);
    } catch (e) {}
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".pv-theme button");
    if (btn) apply(btn.dataset.mode);
  });

  var saved = "dark";
  try {
    saved = localStorage.getItem("ds-preview-theme") || "dark";
  } catch (e) {}
  apply(saved);
})();
