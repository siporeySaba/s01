import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// טוען את הפרקים מ-Firestore. אם נכשל, נופל לקובץ episodes.json
export async function loadEpisodes() {
  try {
    const snap = await getDocs(collection(db, "episodes"));
    const episodes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (episodes.length) return episodes;
    throw new Error("empty");
  } catch (e) {
    console.warn("Firestore נכשל, טוען מ-episodes.json", e);
    try {
      const res = await fetch("./episodes.json");
      if (!res.ok) throw new Error("JSON fetch failed");
      return await res.json();
    } catch (jsonErr) {
      console.error("שגיאה בטעינת נתונים:", jsonErr);
      return [];
    }
  }
}
