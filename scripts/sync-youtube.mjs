// מסנכרן סרטונים מיוטיוב אל אוסף "episodes" ב-Firestore.
// מקורות: שתי רשימות ההשמעה + כל ההעלאות בערוץ (גיבוי לסרטון ששכחו להכניס לרשימה).
// פרקים שנוספו אוטומטית מתעדכנים אם הכותרת או התיאור השתנו ביוטיוב.
// הרצה יבשה (בלי כתיבה): DRY_RUN=1 node sync-youtube.mjs
import admin from "firebase-admin";
import { readFileSync } from "node:fs";

const CHANNEL_ID = "UCldwZhwQyvnU03udHWtJ69Q";
const UPLOADS_PLAYLIST = "UU" + CHANNEL_ID.slice(2);
const PLAYLISTS = [
  { id: "PL6IarGfRfL5ZOFWnzWjpYQsMyJnCESCgc", series: "stories" }, // סדרת הסיפורים
  { id: "PL6IarGfRfL5Ze016CnIsH2ui54jb-pPLb", series: "parasha" }  // פרשת השבוע
];

const API_KEY = process.env.YOUTUBE_API_KEY;
const DRY_RUN = process.env.DRY_RUN === "1";
if (!API_KEY) throw new Error("חסר YOUTUBE_API_KEY");

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});
const db = admin.firestore();

// ---------- עזרים ----------
function videoIdFromUrl(url = "") {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// משפט קצר מתוך התיאור המלא: המשפט הראשון, עד 140 תווים, נחתך בגבול מילה
function shortSentence(text, fallback, max = 140) {
  const clean = (text || "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  const m = clean.match(/^.+?[.!?](?=\s|$)/);
  let sentence = m ? m[0] : clean;
  if (sentence.length > max) {
    sentence = sentence.slice(0, max).replace(/\s+\S*$/, "") + "…";
  }
  return sentence;
}

// פורמט זהה ל-datetime-local שהאדמין שומר: YYYY-MM-DDTHH:mm (שעון ישראל)
function toIsraelLocal(iso) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jerusalem",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).format(new Date(iso));
  return parts.replace(" ", "T");
}

// סיווג סרטון שלא נמצא באף רשימה, לפי הכותרת. מחזיר null אם הוא לא נראה כמו פרק.
function seriesFromTitle(title) {
  if (/סבא בפרשה|פרשת/.test(title)) return "parasha";
  if (/^סיפורי סבא\s*\|/.test(title)) return "stories";
  return null;
}

async function fetchPlaylist(playlistId, maxPages = Infinity) {
  const items = [];
  let pageToken = "";
  let pages = 0;
  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet,contentDetails,status");
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("key", API_KEY);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    items.push(...data.items);
    pageToken = data.nextPageToken || "";
    pages++;
  } while (pageToken && pages < maxPages);
  return items;
}

function isPublic(it) {
  const title = it.snippet?.title;
  if (!it.contentDetails?.videoId || !title) return false;
  if (title === "Private video" || title === "Deleted video") return false;
  return !it.status?.privacyStatus || it.status.privacyStatus === "public";
}

// ---------- איסוף מיוטיוב ----------
const videos = new Map(); // videoId -> { item, series }
for (const { id, series } of PLAYLISTS) {
  for (const it of await fetchPlaylist(id)) {
    if (isPublic(it) && !videos.has(it.contentDetails.videoId)) {
      videos.set(it.contentDetails.videoId, { item: it, series });
    }
  }
}
// ההעלאות האחרונות בערוץ (עמוד אחד = 50 סרטונים מספיק)
let orphan = 0;
for (const it of await fetchPlaylist(UPLOADS_PLAYLIST, 1)) {
  const vid = it.contentDetails?.videoId;
  if (!isPublic(it) || videos.has(vid)) continue;
  const series = seriesFromTitle(it.snippet.title);
  if (!series) { console.log(`מדלג (לא נראה כמו פרק): ${it.snippet.title}`); continue; }
  console.log(`⚠️ לא נמצא באף רשימת השמעה, סווג לפי כותרת כ-${series}: ${it.snippet.title}`);
  videos.set(vid, { item: it, series });
  orphan++;
}
console.log(`ביוטיוב: ${videos.size} סרטונים ציבוריים (${orphan} מחוץ לרשימות)`);

// ---------- השוואה ל-Firestore ----------
const existing = await db.collection("episodes").get();
const byVid = new Map();
existing.forEach(d => {
  const id = videoIdFromUrl(d.data().link);
  if (id) byVid.set(id, d);
});
console.log(`ב-Firestore: ${existing.size} פרקים`);

let added = 0, updated = 0;
const batch = db.batch();

for (const [vid, { item, series }] of videos) {
  const title = item.snippet.title.trim();
  const description = (item.snippet.description || "").trim();
  const doc = byVid.get(vid);

  if (!doc) {
    const publishedIso = item.contentDetails.videoPublishedAt || item.snippet.publishedAt;
    console.log(`${DRY_RUN ? "[יבש] " : ""}חדש (${series}): ${title}`);
    batch.set(db.collection("episodes").doc(), {
      title,
      shortDesc: shortSentence(description, title),
      fullDesc: description,
      link: `https://www.youtube.com/watch?v=${vid}`,
      series,
      publishAt: toIsraelLocal(publishedIso),
      pdfName: "",
      pdf: "",
      createdAt: new Date().toISOString(),
      source: "auto-sync"
    });
    added++;
    continue;
  }

  // עדכון רק לפרקים שנוצרו אוטומטית, כדי לא לדרוס עריכה ידנית
  const data = doc.data();
  if (data.source === "auto-sync" && (data.title !== title || data.fullDesc !== description)) {
    console.log(`${DRY_RUN ? "[יבש] " : ""}עודכן: ${title}`);
    batch.update(doc.ref, {
      title,
      fullDesc: description,
      shortDesc: shortSentence(description, title),
      updatedAt: new Date().toISOString()
    });
    updated++;
  }
}

// ---------- חיבור קובצי PDF לפרקים (לפי pdf story/links.json) ----------
const PDF_BASE = "https://raw.githubusercontent.com/siporeySaba/s01/main/pdf%20story/";
const norm = s => String(s || "").replace(/[\s\-–—|:"״'׳]/g, "");
let linked = 0;
try {
  const links = JSON.parse(readFileSync(new URL("../pdf story/links.json", import.meta.url), "utf8"));
  for (const { episode, file } of links) {
    const matches = existing.docs.filter(d => norm(d.data().title).includes(norm(episode)));
    if (matches.length !== 1) { console.log(`⚠️ PDF ${file}: נמצאו ${matches.length} פרקים מתאימים ל-"${episode}", מדלג`); continue; }
    const url = PDF_BASE + encodeURIComponent(file);
    if (matches[0].data().pdf === url) continue;
    console.log(`${DRY_RUN ? "[יבש] " : ""}PDF חובר: ${episode} ← ${file}`);
    batch.update(matches[0].ref, { pdf: url, pdfName: episode });
    linked++;
  }
} catch (e) {
  console.log("קריאת links.json נכשלה:", e.message);
}

if (!DRY_RUN && (added || updated || linked)) await batch.commit();
console.log(`הסתיים. נוספו ${added}, עודכנו ${updated}, חוברו ${linked} קובצי PDF.`);
