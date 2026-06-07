/* =======================
   CONFIG
======================= */
const URL = "https://raw.githubusercontent.com/siporeySaba/s01/main/episodes.json";

let dataGlobal = [];
let currentEpisode = null;

console.log("🚀 SCRIPT LOADED");

/* =======================
   UTILS
======================= */

function getVideoId(url) {
  if (!url) return "";
  if (url.includes("v=")) return url.split("v=")[1].split("&")[0];
  if (url.includes("youtu.be/")) return url.split("youtu.be/")[1].split("?")[0];
  return "";
}

function safeDate(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr.replace(" ", "T"));
  } catch (e) {
    console.warn("⚠️ Invalid date:", dateStr);
    return null;
  }
}

/* =======================
   STATUS LOGIC
======================= */

function getEpisodeStatus(ep) {
  const now = new Date();
  const viewed = JSON.parse(localStorage.getItem("viewedEpisodes") || "[]");

  const publish = safeDate(ep.publishAt);

  if (publish && publish > now) {
    return "locked";
  }

  if (publish) {
    const diff = (now - publish) / (1000 * 60 * 60 * 24);
    if (diff <= 7 && !viewed.includes(String(ep.id))) {
      return "new";
    }
  }

  if (viewed.includes(String(ep.id))) return "viewed";

  return "available";
}

/* =======================
   INDEX PAGE
======================= */

function render(filter = "all") {

  const container = document.getElementById("episodes");

  if (!container) {
    console.log("ℹ️ Index page not detected - skipping render()");
    return;
  }

  console.log("📺 Rendering index:", filter);

  container.innerHTML = "";

  let filtered = filter === "all"
    ? [...dataGlobal]
    : dataGlobal.filter(e => e.series === filter);

  filtered.sort((a, b) =>
    new Date(b.publishAt || 0) - new Date(a.publishAt || 0)
  );

  console.log("📦 Episodes count:", filtered.length);

  filtered.forEach(ep => {

    const status = getEpisodeStatus(ep);

    const videoId = getVideoId(ep.link);

    const img = videoId
      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      : "https://i.imgur.com/M15F39y.jpeg";

    let badge = "";
    if (status === "new") badge = "🟢 חדש";
    if (status === "locked") badge = "🔒 בקרוב";
    if (status === "viewed") badge = "👀 נצפה";

    container.innerHTML += `
      <div class="card">

        ${badge ? `<div class="badge">${badge}</div>` : ""}

        <img src="${img}">

        <div class="title">${ep.title || ""}</div>
        <div class="desc">${ep.shortDesc || ""}</div>

        <div class="buttons">

          ${
            status === "locked"
              ? `<div class="locked">🔒 בקרוב</div>`
              : `
                <a class="btn youtube" href="${ep.link}" target="_blank">▶ יוטיוב</a>
                <a class="btn entry" href="episode.html?id=${ep.id}">📖 פרק</a>
              `
          }

        </div>

      </div>
    `;
  });
}

/* =======================
   EPISODE PAGE
======================= */

function loadEpisodeFromData(data) {

  const id = new URLSearchParams(location.search).get("id");

  console.log("📖 Episode ID:", id);

  if (!id) {
    console.warn("⚠️ No episode ID in URL");
    return;
  }

  const ep = data.find(e => String(e.id) === String(id));

  if (!ep) {
    console.error("❌ Episode not found");
    return;
  }

  currentEpisode = ep;

  console.log("📦 Episode loaded:", ep.title);

  const now = new Date();
  const publish = safeDate(ep.publishAt);

  if (publish && publish > now) {
    console.warn("🔒 Episode is locked");

    document.body.innerHTML = `
      <div style="padding:20px;text-align:center">
        <h2>🔒 הפרק עדיין לא זמין</h2>
        <p>סבא עדיין מכין אותו...</p>
      </div>
    `;

    return;
  }

  const titleEl = document.getElementById("title");
  const descEl = document.getElementById("desc");
  const videoEl = document.getElementById("video");

  if (!titleEl || !descEl || !videoEl) {
    console.error("❌ Episode DOM missing");
    return;
  }

  titleEl.innerText = ep.title || "";
  descEl.innerText = ep.fullDesc || ep.shortDesc || "";

  const vid = getVideoId(ep.link);

  if (vid) {
    videoEl.src = `https://www.youtube.com/embed/${vid}`;
    console.log("🎥 Video loaded");
  } else {
    videoEl.style.display = "none";
    console.warn("⚠️ No video found");
  }

  let viewed = JSON.parse(localStorage.getItem("viewedEpisodes") || "[]");

  if (!viewed.includes(String(ep.id))) {
    viewed.push(String(ep.id));
    localStorage.setItem("viewedEpisodes", JSON.stringify(viewed));
    console.log("👁 Marked as viewed");
  }
}

/* =======================
   SHARE
======================= */

function shareEpisode() {

  if (!currentEpisode) {
    console.warn("⚠️ No episode to share");
    return;
  }

  const msg = `📖 סיפורי סבא

${currentEpisode.title}

🎧 ${currentEpisode.link}`;

  console.log("📤 Sharing episode");

  if (navigator.share) {
    navigator.share({
      title: currentEpisode.title,
      text: msg
    });
  } else {
    alert("שיתוף לא נתמך");
  }
}

/* =======================
   INIT (SMART ROUTER)
======================= */

function initApp() {

  console.log("🔍 Detecting page type...");

  const isIndex = document.getElementById("episodes");
  const isEpisode = document.getElementById("video");

  console.log("Index:", !!isIndex, "Episode:", !!isEpisode);

  fetch(URL)
    .then(r => {
      console.log("🌐 Fetching JSON...");
      return r.json();
    })
    .then(data => {

      console.log("📡 Data received:", data.length);

      dataGlobal = data;

      if (isIndex) {
        console.log("🏠 Running INDEX mode");
        render();
      }

      if (isEpisode) {
        console.log("📖 Running EPISODE mode");
        loadEpisodeFromData(data);
      }

    })
    .catch(err => {
      console.error("❌ Fetch error:", err);
    });
}

/* =======================
   PWA
======================= */

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js")
    .then(() => console.log("⚙️ SW registered"))
    .catch(err => console.error("SW error:", err));
}

/* =======================
   START
======================= */

initApp();
