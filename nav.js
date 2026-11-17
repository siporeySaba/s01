// תפריט ראשי: פתיחה וסגירה בנייד
(() => {
  const btn = document.querySelector(".nav-toggle");
  const nav = document.getElementById("mainNav");
  if (!btn || !nav) return;
  const set = open => {
    nav.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.innerHTML = `<i class="fa-solid fa-${open ? "xmark" : "bars"}"></i>`;
  };
  btn.addEventListener("click", e => { e.stopPropagation(); set(!nav.classList.contains("open")); });
  document.addEventListener("click", e => { if (!nav.contains(e.target)) set(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") set(false); });
})();
