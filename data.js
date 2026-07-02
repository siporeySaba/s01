import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export async function loadEpisodes() {
  try {
    console.log("🔥 טוען מ-Firestore...");
    const snap = await getDocs(collection(db, "episodes"));
    const episodes = [];
    
    snap.forEach(doc => {
      episodes.push({
        id: doc.id,  // מחפש את ID מהדו"ק אם זה חשוב
        ...doc.data()
      });
    });
    
    // מיון לפי תאריך פרסום (חדש ראשון)
    episodes.sort((a, b) => {
      const dateA = new Date(b.publishAt || 0);
      const dateB = new Date(a.publishAt || 0);
      return dateA - dateB;
    });
    
    console.log(`✅ הצליח! טוען ${episodes.length} סיפורים מ-Firestore`);
    return episodes;
    
  } catch (e) {
    console.warn("⚠️ Firestore כשל, החזרה ל-JSON fallback", e);
    
    try {
      const res = await fetch("./episodes.json");
      if (!res.ok) throw new Error("JSON fetch failed");
      const episodes = await res.json();
      console.log(`✅ טוען ${episodes.length} סיפורים מ-JSON`);
      return episodes;
    } catch (jsonErr) {
      console.error("❌ שגיאה בטעינת נתונים:", jsonErr);
      return [];
    }
  }
}
