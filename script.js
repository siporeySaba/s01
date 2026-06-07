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

  if (publish && publish > now) return "locked";

  if (publish) {
    const diff = (now - publish) / (1000 * 60 * 60 * 24);
    if (diff <= 7 && !viewed.includes(String(ep.id))) return "new";
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
    console.log("ℹ️ Not index page");
    return;
  }

  console.log("📺 Rendering:", filter);

  // פילטרים UI
  document.querySelectorAll(".filters button")
    .forEach(btn => btn.classList.remove("active"));

  const activeBtn = document.getElementById("btn-" + filter);
  if (activeBtn) activeBtn.classList.add("active");

  container.innerHTML = "";

  let filtered = filter === "all"
    ? [...dataGlobal]
    : dataGlobal.filter(e => e.series === filter);

  filtered.sort((a, b) =>
    new Date(b.publishAt || 0) - new Date(a.publishAt || 0)
  );

  console.log("📦 Episodes:", filtered.length);

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

  if (!id) return;

  const ep = data.find(e => String(e.id) === String(id));

  if (!ep) return;

  currentEpisode = ep;

  console.log("📖 Episode:", ep.title);

  // NAV
  const sameSeries = data
    .filter(e => (e.series || "").trim() === (ep.series || "").trim())
    .sort((a, b) => Number(a.id) - Number(b.id));

  const index = sameSeries.findIndex(e => String(e.id) === String(ep.id));

  const prev = sameSeries[index - 1];
  const next = sameSeries[index + 1];

  const nav = document.getElementById("nav");
  if (nav) {
    nav.innerHTML = "";

    if (prev) {
      nav.innerHTML += `<a class="btn" href="episode.html?id=${prev.id}">⬅ פרק קודם</a>`;
    }

    if (next) {
      nav.innerHTML += `<a class="btn" href="episode.html?id=${next.id}">פרק הבא ➡</a>`;
    }
  }

  // נעילה
  const now = new Date();
  const publish = safeDate(ep.publishAt);

  if (publish && publish > now) {
    document.body.innerHTML = `
      <div style="padding:20px;text-align:center">
        <h2>🔒 הפרק עדיין לא זמין</h2>
        <p>סבא עדיין מכין אותו...</p>
      </div>
    `;
    return;
  }

  // תוכן
  const titleEl = document.getElementById("title");
  const descEl = document.getElementById("desc");
  const videoEl = document.getElementById("video");

  if (titleEl) titleEl.innerText = ep.title || "";
  if (descEl) descEl.innerText = ep.fullDesc || ep.shortDesc || "";

  const vid = getVideoId(ep.link);

  if (vid && videoEl) {
    videoEl.src = `https://www.youtube.com/embed/${vid}`;
  } else if (videoEl) {
    videoEl.style.display = "none";
  }

  // viewed
  let viewed = JSON.parse(localStorage.getItem("viewedEpisodes") || "[]");

  if (!viewed.includes(String(ep.id))) {
    viewed.push(String(ep.id));
    localStorage.setItem("viewedEpisodes", JSON.stringify(viewed));
  }
}

/* =======================
   SHARE
======================= */

function shareEpisode() {

  if (!currentEpisode) return;

  const message =
`📖 סיפורי סבא

${currentEpisode.title}

🎧 לצפייה:
${currentEpisode.link}

📲 הצטרפו:
https://chat.whatsapp.com/Bw6tW2DqX1mJNGeKQE0V6N`;

  if (navigator.share) {
    navigator.share({
      title: currentEpisode.title,
      text: message
    });
  } else {
    alert("שיתוף לא נתמך");
  }
}

/* =======================
   INIT
======================= */

function initApp() {

  fetch(URL)
    .then(r => r.json())
    .then(data => {

      dataGlobal = data;

      const isIndex = document.getElementById("episodes");
      const isEpisode = document.getElementById("video");

      if (isIndex) render();
      if (isEpisode) loadEpisodeFromData(data);

    })
    .catch(err => console.error("Fetch error:", err));
}

/* =======================
   START (חשוב מאוד!)
======================= */

document.addEventListener("DOMContentLoaded", initApp);
