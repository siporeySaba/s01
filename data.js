import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export async function loadEpisodes() {
  try {
    const snap = await getDocs(collection(db, "episodes"));

    const episodes = [];

    snap.forEach(doc => {
      episodes.push(doc.data());
    });

    episodes.sort((a, b) => new Date(b.publishAt) - new Date(a.publishAt));

    return episodes;

  } catch (e) {
    console.warn("Firestore failed, fallback JSON", e);

    const res = await fetch("./episodes.json");
    return await res.json();
  }
}
