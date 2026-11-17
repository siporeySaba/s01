// בונה דפים סטטיים לכל פרק (ep/<videoId>.html), sitemap.xml ורשימת פרקים מוכנה בדף הבית,
// כדי שגוגל יראה את התוכן בלי להריץ JavaScript.
// קורא את הפרקים מ-Firestore דרך ה-REST הציבורי (קריאה בלבד), כך שאפשר להריץ גם מקומית:
//   node scripts/build-pages.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from "node:fs";

const SITE = "https://siporeysaba.com/"; // לעדכן כשיהיה דומיין משלנו
const ROOT = new URL("../", import.meta.url);
const PROJECT = "siporeysaba-100";
const SERIES_LABEL = { stories: "סיפורי צדיקים", parasha: "פרשת שבוע", shorts: "שורטים" };

// ---------- עזרים ----------
const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const videoId = (url = "") => (String(url).match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([A-Za-z0-9_-]{11})/) || [])[1] || "";
const shortTitle = t => String(t || "")
  .replace(/#shorts/gi, "")
  .replace(/^\s*(סיפורי סבא|סבא בפרשה)\s*[|\-–:]\s*/, "")
  .replace(/\s*[|\-–]\s*(סיפורי סבא|סבא בפרשה)\s*$/, "")
  .replace(/^\s*פרק\s*\d+\s*[-–:]?\s*/, "") // "פרק 13 - ..." מהעונה הראשונה
  .trim();

// publishAt נשמר בשעון ישראל בלי אזור זמן: "2026-11-10T18:00"
function israelDate(s) {
  if (!s) return null;
  const naive = new Date(String(s).replace(" ", "T").slice(0, 16) + ":00Z");
  if (isNaN(naive)) return null;
  const off = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", timeZoneName: "longOffset" })
    .formatToParts(naive).find(p => p.type === "timeZoneName").value.replace("GMT", "") || "+00:00";
  const iso = naive.toISOString().slice(0, 19) + off;
  return { iso, date: new Date(iso) };
}
const heDate = d => new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jerusalem" }).format(d);

// התיאור מיוטיוב בלי החתימה הקבועה, קישורים, חותמות זמן והאשטגים: נשאר רק הטקסט על הסיפור
function cleanDesc(text = "") {
  const body = String(text).split(/\n\s*(?:━{3,}|-{5,}|—{3,})/)[0];
  return body.split("\n")
    .map(l => l.trim())
    .filter(l => l && !/https?:\/\//.test(l) && !/^#\S/.test(l) && !/^\d{1,2}:\d{2}/.test(l) && !/^⏱️?\s*פרקים/.test(l))
    .join("\n");
}
const firstSentence = (t, max = 155) => {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length <= max ? s : s.slice(0, max).replace(/\s+\S*$/, "") + "…";
};

// סיכומים כתובים לפרקים (scripts/summaries.json): videoId -> { summary: [פסקאות], lesson, questions: [] }
let SUMMARIES = {};
try { SUMMARIES = JSON.parse(readFileSync(new URL("summaries.json", import.meta.url), "utf8")); } catch {}

function summaryHTML(s) {
  if (!s) return "";
  return `
    <section class="ep-summary">
      <h2>על הסיפור</h2>
      ${(s.summary || []).map(p => `<p>${esc(p)}</p>`).join("\n      ")}
      ${s.lesson ? `<h3><i class="fa-solid fa-heart"></i> המסר</h3>
      <p>${esc(s.lesson)}</p>` : ""}
      ${s.questions?.length ? `<h3><i class="fa-solid fa-comments"></i> שאלות לשיחה עם הילדים</h3>
      <ul>${s.questions.map(q => `<li>${esc(q)}</li>`).join("")}</ul>` : ""}
    </section>
`;
}

// חלוקת הסרטון לפרקים מתוך התיאור ביוטיוב: "0:16 אורי עוז מחליט..." -> קישורים לנקודה בסרטון
function chapters(text = "") {
  const body = String(text).split(/\n\s*(?:━{3,}|-{5,}|—{3,})/)[0];
  return body.split("\n").map(l => l.trim().match(/^(\d{1,2}(?::\d{2}){1,2})\s+(.+)$/)).filter(Boolean)
    .map(m => ({ t: m[1], s: m[1].split(":").reduce((a, n) => a * 60 + Number(n), 0), label: m[2] }));
}

// תיאור הפרק: אם יש סיכום כתוב - רק חלוקת הדקות, אחרת גם הטקסט מיוטיוב
function descHTML(ep, text, sum) {
  const ch = chapters(ep.fullDesc);
  let html = sum || !text ? "" : `<p class="desc-text">${esc(text)}</p>`;
  if (ch.length) {
    html += `<h3 class="desc-h"><i class="fa-regular fa-clock"></i> מה יש בפרק</h3><ul class="chapters">` +
      ch.map(c => `<li><a href="https://www.youtube.com/watch?v=${ep.vid}&amp;t=${c.s}s" target="_blank" rel="noopener"><span class="t">${c.t}</span> ${esc(c.label)}</a></li>`).join("") + `</ul>`;
  }
  return html;
}

// כפתורי מעקב קבועים (במקום רשימת הקישורים הארוכה מתיאור היוטיוב)
const FOLLOW_HTML = `
    <section class="follow">
      <h3>רוצים עוד סיפורים?</h3>
      <div class="follow-btns">
        <a class="btn btn-whatsapp" href="https://chat.whatsapp.com/Bw6tW2DqX1mJNGeKQE0V6N" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> לקבוצת הוואטסאפ</a>
        <a class="btn btn-spotify" href="https://open.spotify.com/show/033fWrnJ6gp7UtVx9CK6Io" target="_blank" rel="noopener"><i class="fa-brands fa-spotify"></i> בספוטיפיי</a>
        <a class="btn btn-youtube" href="https://www.youtube.com/channel/UCldwZhwQyvnU03udHWtJ69Q?sub_confirmation=1" target="_blank" rel="noopener"><i class="fa-brands fa-youtube"></i> הרשמה לערוץ</a>
      </div>
    </section>`;

// ---------- נתונים ----------
async function fetchEpisodes() {
  const out = [];
  let token = "";
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/episodes?pageSize=300${token ? "&pageToken=" + token : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Firestore ${res.status}`);
    const data = await res.json();
    for (const d of data.documents || []) {
      const f = {};
      for (const [k, v] of Object.entries(d.fields || {})) f[k] = Object.values(v)[0];
      out.push({ id: d.name.split("/").pop(), ...f });
    }
    token = data.nextPageToken || "";
  } while (token);
  return out;
}

const all = (await fetchEpisodes())
  .map(ep => ({ ...ep, vid: videoId(ep.link), when: israelDate(ep.publishAt) }))
  .filter(ep => ep.vid)
  .sort((a, b) => (b.when?.date || 0) - (a.when?.date || 0));
const now = Date.now();
const isPublic = ep => ep.when && ep.when.date.getTime() <= now;
const publicEps = all.filter(isPublic);

// ---------- דף לכל פרק ----------
const template = readFileSync(new URL("episode.html", ROOT), "utf8");
mkdirSync(new URL("ep/", ROOT), { recursive: true });
const written = new Set();

function relatedFor(ep) {
  const same = publicEps.filter(e => e !== ep && e.series === ep.series && e.series !== "shorts");
  return same.slice(0, 6);
}

for (const ep of all) {
  const title = shortTitle(ep.title);
  const text = cleanDesc(ep.fullDesc || ep.shortDesc || "");
  const sum = SUMMARIES[ep.vid];
  const metaDesc = sum?.summary?.[0] ? firstSentence(sum.summary[0]) : firstSentence(text.replace(/^[^\p{L}\p{N}"]+/u, "") || ep.shortDesc || title);
  const url = `${SITE}ep/${ep.vid}.html`;
  const thumbUrl = `https://i.ytimg.com/vi/${ep.vid}/hqdefault.jpg`;
  const series = SERIES_LABEL[ep.series] || "";
  // כותרת לגוגל: עד ~60 תווים. קודם השם, אחר כך הסדרה, ותוספת "לילדים" רק אם יש מקום
  const brand = ep.series === "parasha" ? "סבא בפרשה" : "סיפורי סבא";
  const extra = ep.series === "parasha" ? "פרשת השבוע לילדים" : "סיפורים לילדים";
  const cut = (t, n) => t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, "").replace(/[\s\-–|:,]+$/, "");
  const cleanT = title.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, "").replace(/\s+/g, " ").trim();
  const pageTitle = `${cleanT} | ${brand} - ${extra}`.length <= 62 ? `${cleanT} | ${brand} - ${extra}`
    : `${cut(cleanT, 60 - brand.length - 3)} | ${brand}`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: title,
    description: firstSentence(sum?.summary?.join(" ") || text.replace(/\n/g, " "), 500) || title,
    thumbnailUrl: [thumbUrl],
    uploadDate: ep.when?.iso,
    embedUrl: `https://www.youtube.com/embed/${ep.vid}`,
    url,
    inLanguage: "he",
    isFamilyFriendly: true,
    publisher: { "@type": "Organization", name: "סיפורי סבא", logo: { "@type": "ImageObject", url: `${SITE}img/logo.jpg` } }
  };

  const head = `<base href="../">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(metaDesc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:image" content="${thumbUrl}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="video.other">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`;

  const related = relatedFor(ep);
  const more = related.map(e => `
      <a class="more-item" href="ep/${e.vid}.html"><img src="https://i.ytimg.com/vi/${e.vid}/mqdefault.jpg" alt="${esc(shortTitle(e.title))}" loading="lazy"><div><b>${esc(shortTitle(e.title))}</b><small>${heDate(e.when.date)}</small></div></a>`).join("");

  let html = template
    .replace(/<link rel="stylesheet" href="(https:\/\/cdnjs[^"]+font-awesome[^"]+)">/, '<link rel="stylesheet" href="$1" media="print" onload="this.media=\'all\'">')
    .replace(/<title>[^<]*<\/title>\n?/, "")
    .replace(/<meta property="og:(title|description|image)"[^>]*>\n?/g, "")
    .replace('<meta name="theme-color"', head + '\n<meta name="theme-color"')
    .replace('<body class="page-episode">', `<body class="page-episode" data-id="${esc(ep.id)}">`)
    .replace(/<iframe id="video"[^>]*><\/iframe>/, `<button class="lite-yt" data-vid="${ep.vid}" aria-label="ניגון הפרק: ${esc(title)}"><img src="https://i.ytimg.com/vi/${ep.vid}/hqdefault.jpg" alt="${esc(title)}" fetchpriority="high"><span class="play"><i class="fa-solid fa-play"></i></span></button>`)
    .replace('<div class="video-wrapper skeleton">', '<div class="video-wrapper">')
    .replace('<span id="seriesChip" class="chip chip-series"></span>', `<span id="seriesChip" class="chip chip-series chip-${esc(ep.series)}"${series ? "" : " hidden"}>${series}</span>`)
    .replace('<span id="date" class="meta-date"></span>', `<span id="date" class="meta-date">${ep.when ? heDate(ep.when.date) : ""}</span>`)
    .replace('<h1 id="title" class="episode-title"></h1>', `<h1 id="title" class="episode-title">${esc(title)}</h1>`)
    .replace('<a class="btn btn-ghost" id="ytBtn"', `<a class="btn btn-ghost" id="ytBtn" href="https://www.youtube.com/watch?v=${ep.vid}"`)
    .replace('<div id="desc" class="episode-desc"></div>', `${summaryHTML(sum)}<div id="desc" class="episode-desc">${descHTML(ep, text, sum)}</div>${FOLLOW_HTML}`)
    .replace('<div id="more" class="more-list"></div>', `<div id="more" class="more-list">${more}\n    </div>`);
  if (ep.pdf) {
    html = html.replace('<div id="pdfSection" class="pdf-section" hidden>', '<div id="pdfSection" class="pdf-section">')
      .replace('<a id="pdfLink" class="pdf-download-btn"', `<a id="pdfLink" class="pdf-download-btn" href="${esc(ep.pdf)}"`);
  }
  if (!isPublic(ep)) html = html.replace('<base href="../">', '<base href="../">\n<meta name="robots" content="noindex">');

  writeFileSync(new URL(`ep/${ep.vid}.html`, ROOT), html);
  written.add(`${ep.vid}.html`);
}
// פרקים שנמחקו
for (const f of readdirSync(new URL("ep/", ROOT))) {
  if (f.endsWith(".html") && !written.has(f)) unlinkSync(new URL(`ep/${f}`, ROOT));
}

// ---------- sitemap.xml ----------
// robots.txt קבוע בשורש האתר ומפנה ל-sitemap
const lastmod = d => d.toISOString().slice(0, 10);
const urls = [
  `  <url><loc>${SITE}</loc><lastmod>${lastmod(publicEps[0]?.when.date || new Date())}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
  `  <url><loc>${SITE}about.html</loc><lastmod>2026-11-16</lastmod></url>`,
  `  <url><loc>${SITE}stories.html</loc><lastmod>2026-11-17</lastmod></url>`,
  `  <url><loc>${SITE}activities.html</loc><lastmod>2026-11-17</lastmod></url>`,
  ...publicEps.filter(ep => ep.series !== "shorts").map(ep => `  <url><loc>${SITE}ep/${ep.vid}.html</loc><lastmod>${lastmod(ep.when.date)}</lastmod></url>`)
];
writeFileSync(new URL("sitemap.xml", ROOT), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);

// ---------- רשימת פרקים מוכנה בדף הבית ----------
const cards = publicEps.filter(ep => ep.series !== "shorts").map(ep => `
    <article class="card ep-card">
      <a class="ep-link" href="ep/${ep.vid}.html" aria-label="${esc(ep.title)}">
        <div class="thumb"><img src="https://i.ytimg.com/vi/${ep.vid}/hqdefault.jpg" alt="${esc(shortTitle(ep.title))}" loading="lazy"><span class="play"><i class="fa-solid fa-play"></i></span></div>
        <div class="ep-body">
          <div class="ep-meta">${SERIES_LABEL[ep.series] ? `<span class="chip chip-${esc(ep.series)}">${SERIES_LABEL[ep.series]}</span>` : ""}<span class="meta-date">${heDate(ep.when.date)}</span></div>
          <h3 class="ep-title">${esc(shortTitle(ep.title))}</h3>
          <p class="ep-desc">${esc(ep.shortDesc || "")}</p>
        </div>
      </a>
    </article>`).join("");
const indexUrl = new URL("index.html", ROOT);
const index = readFileSync(indexUrl, "utf8");
const marked = /<!--PRERENDER:START-->[\s\S]*?<!--PRERENDER:END-->/;
if (!marked.test(index)) throw new Error("index.html: חסרים סימוני PRERENDER");
writeFileSync(indexUrl, index.replace(marked, `<!--PRERENDER:START-->${cards}\n      <!--PRERENDER:END-->`));

console.log(`נבנו ${written.size} דפי פרקים, ${urls.length} כתובות ב-sitemap.`);
