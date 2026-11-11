import { loadEpisodes } from "./data.js";

/* =======================
   קבועים ועזרים
======================= */
const WHATSAPP_GROUP = "https://chat.whatsapp.com/Bw6tW2DqX1mJNGeKQE0V6N";
const COMING_SOON_IMG = "img/coming-soon.jpg";
const SERIES_LABEL = { stories: "סיפורי צדיקים", parasha: "פרשת שבוע", shorts: "שורטים" };
// שורטים מוצגים רק בלשונית שלהם, כדי לא להציף את הרשימה הראשית (אחד ביום)
const isShort = ep => ep.series === "shorts";
const NEW_DAYS = 7;

const $ = id => document.getElementById(id);

function esc(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// תומך ב-watch?v=, youtu.be/, shorts/, embed/, live/
function getVideoId(url = "") {
  const m = String(url).match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
}

function parseDate(s) {
  if (!s) return null;
  const d = new Date(String(s).replace(" ", "T"));
  return isNaN(d) ? null : d;
}
// כותרת לתצוגה בלי "סיפורי סבא" / "סבא בפרשה" (בהתחלה או בסוף) ובלי #shorts: הסדרה כבר מופיעה בתגית
const shortTitle = t => String(t || "")
  .replace(/#shorts/gi, "")
  .replace(/^\s*(סיפורי סבא|סבא בפרשה)\s*[|\-–:]\s*/, "")
  .replace(/\s*[|\-–]\s*(סיפורי סבא|סבא בפרשה)\s*$/, "")
  .trim();
const time = ep => parseDate(ep.publishAt)?.getTime() || 0;

const dateFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" });
const formatDate = ep => { const d = parseDate(ep.publishAt); return d ? dateFmt.format(d) : ""; };

function getViewed() {
  try { return JSON.parse(localStorage.getItem("viewedEpisodes") || "[]"); } catch { return []; }
}
function markViewed(id) {
  try {
    const v = getViewed();
    if (!v.includes(String(id))) { v.push(String(id)); localStorage.setItem("viewedEpisodes", JSON.stringify(v)); }
  } catch {}
}

function getStatus(ep, viewed = getViewed()) {
  const t = time(ep);
  const now = Date.now();
  if (t && t > now) return "locked";
  if (viewed.includes(String(ep.id))) return "viewed";
  if (t && (now - t) / 864e5 <= NEW_DAYS) return "new";
  return "available";
}

function thumb(ep, quality = "hqdefault") {
  const vid = getVideoId(ep.link);
  return vid ? `https://i.ytimg.com/vi/${vid}/${quality}.jpg` : COMING_SOON_IMG;
}

function countdown(ep) {
  const diff = time(ep) - Date.now();
  if (diff <= 0) return "זמין עכשיו";
  const d = Math.floor(diff / 864e5);
  const h = Math.floor(diff / 36e5) % 24;
  const m = Math.floor(diff / 6e4) % 60;
  if (d > 0) return `עוד ${d} ימים ו-${h} שעות`;
  if (h > 0) return `עוד ${h} שעות ו-${m} דקות`;
  return `עוד ${m} דקות`;
}

/* =======================
   דף הבית
======================= */
let all = [];
const state = { filter: "all", query: "" };

function cardHTML(ep, viewed) {
  const status = getStatus(ep, viewed);
  const badge = status === "new" ? `<span class="badge badge-new">חדש</span>`
              : status === "viewed" ? `<span class="badge badge-viewed"><i class="fa-solid fa-check"></i> נצפה</span>` : "";
  const pdf = ep.pdf ? `<span class="badge badge-pdf" title="יש קובץ להקראה"><i class="fa-solid fa-book-open"></i> PDF להקראה</span>` : "";
  const series = SERIES_LABEL[ep.series] || "";
  return `
    <article class="card ep-card">
      <a class="ep-link" href="episode.html?id=${encodeURIComponent(ep.id)}" aria-label="${esc(ep.title)}">
        <div class="thumb">
          <img src="${thumb(ep)}" alt="" loading="lazy">
          <span class="play"><i class="fa-solid fa-play"></i></span>
          <div class="badges">${badge}${pdf}</div>
        </div>
        <div class="ep-body">
          <div class="ep-meta">
            ${series ? `<span class="chip chip-${esc(ep.series)}">${series}</span>` : ""}
            <span class="meta-date">${formatDate(ep)}</span>
          </div>
          <h3 class="ep-title">${esc(shortTitle(ep.title))}</h3>
          <p class="ep-desc">${esc(ep.shortDesc)}</p>
        </div>
      </a>
    </article>`;
}

function renderUpcoming() {
  const box = $("upcoming");
  const list = $("upcomingList");
  if (!box) return;
  const future = all.filter(ep => getStatus(ep) === "locked" && !isShort(ep)).sort((a, b) => time(a) - time(b));
  box.hidden = future.length === 0;
  list.innerHTML = future.map(ep => `
    <div class="upcoming-item">
      <img src="${COMING_SOON_IMG}" alt="">
      <div>
        <span class="chip chip-${esc(ep.series)}">${SERIES_LABEL[ep.series] || ""}</span>
        <b>${esc(shortTitle(ep.title))}</b>
        <span class="countdown"><i class="fa-regular fa-clock"></i> ${countdown(ep)}</span>
      </div>
    </div>`).join("");
}

function renderGrid() {
  const container = $("episodes");
  const viewed = getViewed();
  const q = state.query.trim().toLowerCase();

  const list = all
    .filter(ep => getStatus(ep, viewed) !== "locked")
    .filter(ep => state.filter === "all" ? !isShort(ep)
                : state.filter === "pdf" ? !!ep.pdf
                : ep.series === state.filter)
    .filter(ep => !q || `${ep.title} ${ep.shortDesc} ${ep.fullDesc}`.toLowerCase().includes(q))
    .sort((a, b) => time(b) - time(a));

  container.innerHTML = list.map(ep => cardHTML(ep, viewed)).join("");
  $("empty").hidden = list.length > 0;
  $("count").textContent = list.length ? `(${list.length})` : "";
}

function setupHero() {
  const latest = all.filter(ep => getStatus(ep) !== "locked" && !isShort(ep)).sort((a, b) => time(b) - time(a))[0];
  const cta = $("heroCta");
  if (!latest || !cta) return;
  cta.href = `episode.html?id=${encodeURIComponent(latest.id)}`;
  cta.querySelector("span").textContent = `לפרק החדש: ${shortTitle(latest.title)}`;
  cta.hidden = false;
}

function initIndex() {
  document.querySelectorAll(".tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.filter = btn.dataset.filter;
      renderGrid();
    });
  });
  $("search").addEventListener("input", e => { state.query = e.target.value; renderGrid(); });

  setupHero();
  renderUpcoming();
  renderGrid();

  // רענון הספירה לאחור, ופתיחה אוטומטית של פרק כשמגיע זמנו
  let lockedCount = all.filter(ep => getStatus(ep) === "locked").length;
  setInterval(() => {
    const now = all.filter(ep => getStatus(ep) === "locked").length;
    renderUpcoming();
    if (now !== lockedCount) { lockedCount = now; setupHero(); renderGrid(); }
  }, 30000);
}

/* =======================
   דף פרק
======================= */
let current = null;

function toast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

function shareText(ep) {
  return `📖 סיפורי סבא\n\n${ep.title}\n\n🎧 לצפייה:\n${location.href}\n\n📲 רוצים לקבל את הפרקים החדשים לפני כולם? הצטרפו לקבוצת הוואטסאפ:\n${WHATSAPP_GROUP}`;
}

async function shareEpisode() {
  if (!current) return;
  if (navigator.share) {
    try { await navigator.share({ title: current.title, text: shareText(current) }); } catch {}
    return;
  }
  try {
    await navigator.clipboard.writeText(shareText(current));
    toast("הקישור הועתק ✓");
  } catch {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText(current))}`, "_blank");
  }
}

function showMissing(title, text) {
  $("episode").innerHTML = `
    <div class="card notice">
      <h1>${title}</h1>
      <p>${text}</p>
      <a class="btn btn-primary" href="index.html">לכל הפרקים</a>
    </div>`;
  document.querySelector(".episode-side").hidden = true;
}

function initEpisode() {
  const id = new URLSearchParams(location.search).get("id");
  const ep = all.find(e => String(e.id) === String(id));

  if (!ep) return showMissing("הפרק לא נמצא", "אולי הקישור השתנה. כל הפרקים מחכים לכם בעמוד הראשי.");
  if (getStatus(ep) === "locked") {
    return showMissing("🔒 הפרק עדיין לא זמין", `סבא עדיין מכין אותו... הפרק ייפתח ${dateFmt.format(parseDate(ep.publishAt))} (${countdown(ep)}).`);
  }

  current = ep;
  document.title = `${ep.title} · סיפורי סבא`;

  $("title").textContent = shortTitle(ep.title);
  $("date").textContent = formatDate(ep);
  const chip = $("seriesChip");
  chip.textContent = SERIES_LABEL[ep.series] || "";
  chip.classList.add(`chip-${ep.series}`);
  chip.hidden = !SERIES_LABEL[ep.series];

  const desc = ep.fullDesc || ep.shortDesc || "";
  $("desc").innerHTML = desc ? esc(desc).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>') : "";
  $("desc").hidden = !desc;

  const vid = getVideoId(ep.link);
  const wrapper = document.querySelector(".video-wrapper");
  if (vid) {
    $("video").src = `https://www.youtube-nocookie.com/embed/${vid}?rel=0&modestbranding=1`;
    $("video").addEventListener("load", () => wrapper.classList.remove("skeleton"), { once: true });
  } else {
    wrapper.hidden = true;
  }

  $("ytBtn").href = ep.link || "#";
  $("ytBtn").hidden = !ep.link;
  $("waBtn").href = `https://wa.me/?text=${encodeURIComponent(shareText(ep))}`;
  $("shareBtn").addEventListener("click", shareEpisode);

  if (ep.pdf) {
    $("pdfSection").hidden = false;
    $("pdfLink").href = ep.pdf;
    $("pdfName").textContent = "הורדת הסיפור (PDF)";
  }

  // ניווט בתוך הסדרה, לפי תאריך פרסום
  const series = all
    .filter(e => (e.series || "").trim() === (ep.series || "").trim() && getStatus(e) !== "locked")
    .sort((a, b) => time(a) - time(b));
  const i = series.findIndex(e => String(e.id) === String(ep.id));
  const prev = series[i - 1];
  const next = series[i + 1];
  $("nav").innerHTML = `
    ${prev ? `<a class="nav-card" href="episode.html?id=${encodeURIComponent(prev.id)}"><small><i class="fa-solid fa-arrow-right"></i> הפרק הקודם</small><b>${esc(shortTitle(prev.title))}</b></a>` : "<span></span>"}
    ${next ? `<a class="nav-card next" href="episode.html?id=${encodeURIComponent(next.id)}"><small>הפרק הבא <i class="fa-solid fa-arrow-left"></i></small><b>${esc(shortTitle(next.title))}</b></a>` : ""}`;

  // עוד פרקים מהסדרה (החדשים קודם)
  const more = series.filter(e => e.id !== ep.id).sort((a, b) => time(b) - time(a)).slice(0, 8);
  $("moreTitle").textContent = `עוד ב${SERIES_LABEL[ep.series] || "סדרה"}`;
  $("more").innerHTML = more.map(e => `
    <a class="more-item" href="episode.html?id=${encodeURIComponent(e.id)}">
      <img src="${thumb(e, "mqdefault")}" alt="" loading="lazy">
      <div><b>${esc(shortTitle(e.title))}</b><small>${formatDate(e)}</small></div>
    </a>`).join("");

  markViewed(ep.id);
}

/* =======================
   התקנת אפליקציה
======================= */
let installEvent = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  installEvent = e;
  const btn = $("installApp");
  if (btn) btn.hidden = false;
});
$("installApp")?.addEventListener("click", async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  $("installApp").hidden = true;
});
window.addEventListener("appinstalled", () => { const b = $("installApp"); if (b) b.hidden = true; });

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(err => console.error("SW error:", err));
}

/* =======================
   הפעלה
======================= */
async function init() {
  all = await loadEpisodes();
  if (document.body.classList.contains("page-index")) initIndex();
  if (document.body.classList.contains("page-episode")) initEpisode();
}
init();
