// יוצר קובץ PDF של סיפור בפורמט הקבוע של "סיפורי סבא".
// שימוש:  node tools/story-pdf/make-pdf.mjs <קובץ-סיפור.txt> [שם-קובץ-יעד.pdf]
// הקובץ נשמר בתיקייה "pdf story". פורמט קובץ הסיפור מוסבר ב-README.md שבתיקייה הזו.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const OUT_DIR = path.join(REPO, "pdf story");

const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// אימוג'י רגיל או דגל (🇮🇱 בנוי מ-Regional Indicator)
const STARTS_WITH_EMOJI = /^[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;

// ---------- קריאת קובץ הסיפור ----------
export function parseStory(text) {
  const lines = text.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
  const meta = { title: "", chapter: "", summary: "", author: "חגי כהן, סיפורי סבא", ages: "3-12", file: "" };
  const keys = { "כותרת": "title", "פרק": "chapter", "תקציר": "summary", "מאת": "author", "גילאים": "ages", "קובץ": "file" };

  let i = 0, lastKey = null;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "---") { i++; break; }
    const m = line.match(/^([^:]{2,10}):\s*(.*)$/);
    if (m && keys[m[1].trim()]) { lastKey = keys[m[1].trim()]; meta[lastKey] = m[2].trim(); }
    else if (line && lastKey === "summary") meta.summary += " " + line; // תקציר יכול להימשך כמה שורות
  }
  if (!meta.title) throw new Error('חסרה שורת "כותרת:" בראש הקובץ');

  // גוף הסיפור: אפשר להדביק טקסט כמו שהוא (גם עם סימוני Markdown של # ו-*).
  // כותרת משנה = שורה שמתחילה ב-# או שורה קצרה שמתחילה באימוג'י.
  // שורת "סיפורי סבא: ..." בתחילת הסיפור הופכת לכותרת הפרק (אם לא הוגדרה "פרק:").
  const clean = s => s.replace(/[*#]+/g, "").replace(/\s{2,}/g, " ").trim();
  const startsWithEmoji = s => STARTS_WITH_EMOJI.test(s);
  const blocks = [];
  for (; i < lines.length; i++) {
    const raw = lines[i].trim();
    const text = clean(raw);
    if (!text) continue;
    if (!blocks.length && /סיפורי סבא\s*:/.test(text)) { meta.chapter ||= text; continue; }
    const isHeading = raw.startsWith("#") || (startsWithEmoji(text) && text.length <= 70);
    blocks.push({ type: isHeading ? "h" : "p", text });
  }
  return { meta, blocks };
}

// ---------- בניית ה-HTML ----------
// כוכביות (סימון מודגש מ-Markdown) נמחקות תמיד
const inline = s => esc(String(s).replace(/[*#]+/g, "").replace(/\s{2,}/g, " ").trim());
// 📜 נוסף לכותרת הפרק רק אם היא לא מתחילה כבר באימוג'י
const chapterLine = c => STARTS_WITH_EMOJI.test(c.trim()) ? c : "📜 " + c;

export function buildHtml({ meta, blocks }) {
  const logo = pathToFileURL(path.join(HERE, "logo-white.png")).href;
  // כותרת משנה נדבקת לפסקה שאחריה, כדי שלא תישאר לבד בתחתית עמוד
  const parts = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === "h") {
      const next = blocks[i + 1]?.type === "p" ? `<p>${inline(blocks[++i].text)}</p>` : "";
      parts.push(`<div class="keep"><h3>${inline(b.text)}</h3>${next}</div>`);
    } else {
      parts.push(`<p>${inline(b.text)}</p>`);
    }
  }
  const body = parts.join("\n");

  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>${esc(meta.title)}</title>
<style>
  @page { size: A4; margin: 10mm 22mm 18mm; }
  @page :first { margin: 0; }
  @page {
    @bottom-center { content: counter(page); font: 11pt Gisha, Arial, sans-serif; color: #000; }
  }
  @page :first { @bottom-center { content: none; } }

  html { counter-reset: page -1; } /* מספור מתחיל ב-1 בעמוד שאחרי השער, כמו בקבצים הקיימים */
  html, body { margin: 0; }
  body {
    font-family: Gisha, "Noto Sans Hebrew", Arial, "Segoe UI Emoji", sans-serif;
    color: #000;
    font-size: 14pt;
    line-height: 1.36;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }

  /* לוגו קטן בראש כל עמוד: כותרת טבלה (thead) חוזרת אוטומטית בכל עמוד מודפס */
  table.flow { width: 100%; border-collapse: collapse; }
  table.flow > thead td { text-align: center; padding: 0 0 7mm; }
  table.flow > thead img { height: 17mm; }
  table.flow > tbody td { padding: 0; }

  /* עמוד שער */
  .cover {
    height: 296mm;
    display: flex; flex-direction: column; align-items: center;
    padding: 30mm 26mm 0; box-sizing: border-box;
    break-after: page;
    text-align: center;
  }
  .cover .logo { width: 82mm; margin-bottom: 20mm; }
  .cover h1 { font-weight: 700; font-size: 37pt; line-height: 1.32; margin: 0 0 12mm; }
  .cover .summary { font-size: 11pt; line-height: 1.55; margin: 0 0 18mm; max-width: 150mm; }
  .cover table { border-collapse: collapse; font-size: 11pt; }
  .cover td { border: 1px solid #999; padding: 4px 14px; text-align: center; }

  /* גוף הסיפור */
  h2 { font-size: 20pt; font-weight: 700; margin: 6mm 0 6mm; }
  h3 { font-size: 15pt; font-weight: 700; margin: 6mm 0 3mm; break-after: avoid; }
  .keep { break-inside: avoid; }
  p  { margin: 0 0 0; text-align: justify; orphans: 2; widows: 2; }
  p + p { margin-top: 0; }
</style></head>
<body>
  <section class="cover">
    <img class="logo" src="${logo}" alt="סיפורי סבא">
    <h1>${inline(meta.title)}</h1>
    ${meta.summary ? `<p class="summary">${inline(meta.summary)}</p>` : ""}
    <table>
      <tr><td>מאת:</td><td>${esc(meta.author)}</td></tr>
      <tr><td>לגילאים:</td><td>${esc(meta.ages)}</td></tr>
    </table>
  </section>

  <table class="flow">
    <thead><tr><td><img src="${logo}" alt=""></td></tr></thead>
    <tbody><tr><td>
      ${meta.chapter ? `<h2>${inline(chapterLine(meta.chapter))}</h2>` : ""}
      ${body}
    </td></tr></tbody>
  </table>
</body></html>`;
}

// ---------- הדפסה ל-PDF ----------
function findBrowser() {
  const p = EDGE_PATHS.find(p => fs.existsSync(p));
  if (!p) throw new Error("לא נמצא Edge או Chrome במחשב");
  return p;
}

export function printPdf(html, outFile) {
  const tmpHtml = path.join(HERE, ".tmp-story.html");
  fs.writeFileSync(tmpHtml, html, "utf8");
  const profile = path.join(process.env.TEMP || HERE, "saba-pdf-profile");
  try {
    execFileSync(findBrowser(), [
      "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
      `--user-data-dir=${profile}`,
      `--print-to-pdf=${outFile}`,
      pathToFileURL(tmpHtml).href
    ], { stdio: "pipe" });
  } finally {
    fs.rmSync(tmpHtml, { force: true });
  }
}

// ---------- הרצה מהשורה ----------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [src, outArg] = process.argv.slice(2);
  if (!src) { console.error("שימוש: node tools/story-pdf/make-pdf.mjs <story.txt> [out.pdf]"); process.exit(1); }
  const story = parseStory(fs.readFileSync(src, "utf8"));
  const name = outArg || story.meta.file || path.basename(src).replace(/\.[^.]+$/, "") + ".pdf";
  const out = path.isAbsolute(name) ? name : path.join(OUT_DIR, name.endsWith(".pdf") ? name : name + ".pdf");
  printPdf(buildHtml(story), out);
  console.log(`✅ נוצר: ${out} (${Math.round(fs.statSync(out).size / 1024)}KB)`);
}
