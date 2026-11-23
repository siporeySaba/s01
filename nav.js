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

// מונה כניסות (GoatCounter)
(function(){if(/^(localhost|127.|192.168.)/.test(location.hostname))return;var s=document.createElement('script');s.async=true;s.src='//gc.zgo.at/count.js';s.setAttribute('data-goatcounter','https://siporeysaba.goatcounter.com/count');s.onload=function(){try{window.goatcounter.count({path:'site-s01',title:'s01',event:true})}catch(e){}};document.head.appendChild(s)})();
