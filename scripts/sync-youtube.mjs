// מסנכרן סרטונים מרשימות ההשמעה ביוטיוב אל אוסף "episodes" ב-Firestore.
// הרצה יבשה (בלי כתיבה): DRY_RUN=1 node sync-youtube.mjs
import admin from "firebase-admin";

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
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
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

async function fetchPlaylist(playlistId) {
  const items = [];
  let pageToken = "";
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
  } while (pageToken);
  return items;
}

// ---------- ריצה ----------
const existing = await db.collection("episodes").get();
const knownIds = new Set();
existing.forEach(d => {
  const id = videoIdFromUrl(d.data().link);
  if (id) knownIds.add(id);
});
console.log(`קיימים ב-Firestore: ${existing.size} פרקים (${knownIds.size} עם מזהה יוטיוב)`);

let added = 0;
for (const { id: playlistId, series } of PLAYLISTS) {
  const items = await fetchPlaylist(playlistId);
  for (const it of items) {
    const vid = it.contentDetails?.videoId;
    const title = it.snippet?.title;
    // מדלגים על סרטונים פרטיים/מחוקים
    if (!vid || !title || title === "Private video" || title === "Deleted video") continue;
    if (it.status?.privacyStatus && it.status.privacyStatus !== "public") continue;
    if (knownIds.has(vid)) continue;

    const description = (it.snippet.description || "").trim();
    const firstLine = description.split("\n").map(s => s.trim()).find(Boolean) || "";
    const publishedIso = it.contentDetails.videoPublishedAt || it.snippet.publishedAt;

    const doc = {
      title,
      shortDesc: (firstLine || title).slice(0, 140),
      fullDesc: description,
      link: `https://www.youtube.com/watch?v=${vid}`,
      series,
      publishAt: toIsraelLocal(publishedIso),
      pdfName: "",
      pdf: "",
      createdAt: new Date().toISOString(),
      source: "auto-sync"
    };

    console.log(`${DRY_RUN ? "[יבש] " : ""}חדש (${series}): ${title}`);
    if (!DRY_RUN) await db.collection("episodes").add(doc);
    knownIds.add(vid);
    added++;
  }
}
console.log(`הסתיים. נוספו ${added} פרקים.`);
