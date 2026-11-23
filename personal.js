// סיפור אישי: ממלאים שמות של ילדים, והסיפור מודפס ל-PDF עם השמות שלהם.
// הכל קורה בדפדפן – השמות לא נשלחים לשום מקום.
// פורמט קובץ התבנית (personal/<id>.txt) – כמו קבצי הסיפור ב-pdf story/src, ובנוסף:
//   ילדים: זיו=בן, נויה=בת      הדמויות שאפשר להחליף והמין המקורי שלהן
//   משפחה: כהן   /   סבא: חיים   ערכי ברירת המחדל
//   בגוף הסיפור: {זיו} = השם,  {שאל|שאלה:זיו} = מילה לפי מין הדמות,  {משפחה}, {סבא}
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const STARTS_WITH_EMOJI = /^[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;

let tpl = null; // { meta, roles: [{name, gender}], family, saba, raw }

// ---------- קריאת התבנית ----------
function readHeader(text) {
  const lines = text.replace(/^﻿/, "").replace(/\r/g, "").split("\n");
  const h = {};
  for (const line of lines) {
    if (line.trim() === "---") break;
    const m = line.match(/^([^:]{2,10}):\s*(.*)$/);
    if (m) h[m[1].trim()] = m[2].trim();
  }
  const roles = (h["ילדים"] || "").split(",").map(s => s.trim()).filter(Boolean).map(s => {
    const [name, g] = s.split("=").map(x => x.trim());
    return { name, gender: g === "בת" ? "f" : "m" };
  });
  return { roles, family: h["משפחה"] || "", saba: h["סבא"] || "" };
}

// ---------- מילוי השמות ----------
function fill(text, choice) {
  return text.replace(/\{([^{}]+)\}/g, (all, inner) => {
    const g = inner.match(/^([^|]*)\|([^:]*):(.+)$/);
    if (g) return choice.gender[g[3].trim()] === "f" ? g[2] : g[1];
    const key = inner.trim();
    if (key === "משפחה") return choice.family;
    if (key === "סבא") return choice.saba;
    return choice.name[key] ?? key;
  });
}

// ---------- פירוק הסיפור (כמו tools/story-pdf/make-pdf.mjs) ----------
function parseStory(text) {
  const lines = text.replace(/^﻿/, "").replace(/\r/g, "").split("\n");
  const meta = { title: "", chapter: "", summary: "", author: "חגי כהן, סיפורי סבא", ages: "3-12", merge: "כן" };
  const keys = { "כותרת": "title", "פרק": "chapter", "תקציר": "summary", "מאת": "author", "גילאים": "ages", "מיזוג": "merge" };
  let i = 0, lastKey = null;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "---") { i++; break; }
    const m = line.match(/^([^:]{2,10}):\s*(.*)$/);
    if (m) { lastKey = keys[m[1].trim()] || null; if (lastKey) meta[lastKey] = m[2].trim(); }
    else if (line && lastKey === "summary") meta.summary += " " + line;
  }
  const clean = s => s.replace(/[*#]+/g, "").replace(/\s{2,}/g, " ").trim();
  const blocks = [];
  for (; i < lines.length; i++) {
    const raw = lines[i].trim();
    const text = clean(raw);
    if (!text) continue;
    if (/^[-–—_]{3,}$/.test(text)) { if (blocks.length) blocks.push({ type: "br" }); continue; }
    if (!blocks.length && /סיפורי סבא\s*:/.test(text)) { meta.chapter ||= text; continue; }
    if (!blocks.length && !meta.chapter && /^#(?!#)/.test(raw)) { meta.chapter = text; continue; }
    const isHeading = raw.startsWith("#") || (STARTS_WITH_EMOJI.test(text) && text.length <= 70);
    const strong = /^\*\*.*\*\*\S*$/.test(raw);
    blocks.push({ type: isHeading ? "h" : "p", text, strong });
  }
  const merged = meta.merge === "לא" ? blocks : mergeShortLines(blocks);
  return { meta, blocks: merged.filter(b => b.type !== "br") };
}
const PARA_MAX = 340, SHORT_LINE = 160;
function mergeShortLines(blocks) {
  const out = [];
  for (const b of blocks) {
    const prev = out[out.length - 1];
    const canJoin = prev && prev.type === "p" && b.type === "p" && !prev.strong && !b.strong
      && prev.short && b.text.length < SHORT_LINE
      && (prev.text.length + b.text.length < PARA_MAX || /:$/.test(prev.text));
    if (canJoin) prev.text += " " + b.text;
    else out.push({ ...b, short: b.type === "p" && b.text.length < SHORT_LINE });
  }
  return out.map(({ short, ...b }) => b);
}
const inline = s => esc(String(s).replace(/[*#]+/g, "").replace(/\s{2,}/g, " ").trim());
const chapterLine = c => STARTS_WITH_EMOJI.test(c.trim()) ? c : "📜 " + c;
const listNames = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " ו" + a[a.length - 1];

function buildStory({ meta, blocks }, forNames) {
  const parts = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === "h") {
      const next = blocks[i + 1]?.type === "p" ? `<p>${inline(blocks[++i].text)}</p>` : "";
      parts.push(`<div class="keep"><h3>${inline(b.text)}</h3>${next}</div>`);
    } else parts.push(`<p>${inline(b.text)}</p>`);
  }
  return `
  <section class="cover">
    <img class="logo" src="img/logo-white.png" alt="סיפורי סבא">
    <h1>${inline(meta.title)}</h1>
    ${forNames.length ? `<p class="for">✨ סיפור מיוחד עבור ${esc(listNames(forNames))} ✨</p>` : ""}
    ${meta.summary ? `<p class="summary">${inline(meta.summary)}</p>` : ""}
    <table><tr><td>מאת:</td><td>${esc(meta.author)}</td></tr><tr><td>לגילאים:</td><td>${esc(meta.ages)}</td></tr></table>
  </section>
  <table class="flow">
    <thead><tr><td><img src="img/logo-white.png" alt=""></td></tr></thead>
    <tbody><tr><td>
      ${meta.chapter ? `<h2>${inline(chapterLine(meta.chapter))}</h2>` : ""}
      ${parts.join("\n")}
    </td></tr></tbody>
  </table>`;
}

// ---------- הטופס ----------
function choiceFromForm() {
  const c = { name: {}, gender: {}, family: $("f-family").value.trim() || tpl.family, saba: $("f-saba").value.trim() || tpl.saba, entered: [] };
  tpl.roles.forEach((r, i) => {
    const v = $("r-name-" + i).value.trim();
    c.name[r.name] = v || r.name;
    c.gender[r.name] = document.querySelector(`input[name="r-g-${i}"]:checked`).value;
    if (v) c.entered.push(v);
  });
  return c;
}

function render() {
  const c = choiceFromForm();
  const story = parseStory(fill(tpl.raw, c));
  $("story").innerHTML = buildStory(story, c.entered);
  document.title = story.meta.title + (c.entered.length ? " - " + listNames(c.entered) : "") + " | סיפורי סבא";
}

function buildForm() {
  $("roles").innerHTML = tpl.roles.map((r, i) => `
    <div class="p-role">
      <label for="r-name-${i}">במקום <b>${esc(r.name)}</b></label>
      <input id="r-name-${i}" class="p-input" maxlength="20" placeholder="${esc(r.name)}" autocomplete="off">
      <div class="p-gender" role="radiogroup" aria-label="בן או בת">
        <label><input type="radio" name="r-g-${i}" value="m" ${r.gender === "m" ? "checked" : ""}> בן</label>
        <label><input type="radio" name="r-g-${i}" value="f" ${r.gender === "f" ? "checked" : ""}> בת</label>
      </div>
    </div>`).join("");
  $("f-family").placeholder = tpl.family;
  $("f-saba").placeholder = tpl.saba;
  // מילוי מראש מהכתובת (#n=מאיה:בת,יונתן:בן&f=לוי&s=משה) – החלק שאחרי # לא נשלח לשרת
  const h = new URLSearchParams(decodeURIComponent(location.hash.slice(1)));
  (h.get("n") || "").split(",").forEach((x, i) => {
    const [name, g] = x.split(":");
    if (!name || !$("r-name-" + i)) return;
    $("r-name-" + i).value = name.trim();
    const el = document.querySelector(`input[name="r-g-${i}"][value="${g === "בת" ? "f" : "m"}"]`);
    if (g && el) el.checked = true;
  });
  if (h.get("f")) $("f-family").value = h.get("f");
  if (h.get("s")) $("f-saba").value = h.get("s");
  $("form").addEventListener("input", render);
  $("print").addEventListener("click", () => { render(); window.print(); });
  render();
}

async function init() {
  const id = new URLSearchParams(location.search).get("s") || "";
  try {
    const list = await (await fetch("personal/index.json")).json();
    const item = list.find(x => x.id === id);
    if (!item) throw new Error("no story");
    const raw = await (await fetch(`personal/${encodeURIComponent(id)}.txt`)).text();
    tpl = { raw, ...readHeader(raw) };
    $("p-title").textContent = item.title;
    $("p-back").href = item.ep ? `ep/${item.ep}.html` : "stories.html";
    $("app").hidden = false;
    $("loading").hidden = true;
    buildForm();
  } catch (e) {
    $("loading").innerHTML = 'לא מצאנו את הסיפור הזה. <a href="stories.html">לכל הסיפורים הכתובים</a>';
  }
}
init();
