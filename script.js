const URL =
"https://raw.githubusercontent.com/siporeySaba/s01/main/episodes.json";

let dataGlobal = [];
let currentEpisode = null;

/* ------------------ סטטוס ------------------ */
function getEpisodeStatus(ep) {
  const now = new Date();
  const viewed = JSON.parse(localStorage.getItem("viewedEpisodes") || "[]");

  if (ep.publishAt) {
    const publish = new Date(ep.publishAt.replace(" ", "T"));
    if (publish > now) return "locked";

    const diff = (now - publish) / (1000 * 60 * 60 * 24);
    if (diff <= 7 && !viewed.includes(String(ep.id))) return "new";
  }

  if (viewed.includes(String(ep.id))) return "viewed";

  return "available";
}

/* ------------------ יוטיוב ------------------ */
function getVideoId(url) {
  if (!url) return "";
  if (url.includes("v=")) return url.split("v=")[1].split("&")[0];
  if (url.includes("youtu.be/")) return url.split("youtu.be/")[1];
  return "";
}

/* ------------------ INDEX ------------------ */
function render(filter="all") {

  const container = document.getElementById("episodes");
  if (!container) return;

  container.innerHTML = "";

  const filtered =
    filter === "all"
      ? [...dataGlobal]
      : dataGlobal.filter(e => e.series === filter);

  filtered.sort((a,b) =>
    new Date(b.publishAt) - new Date(a.publishAt)
  );

  filtered.forEach(ep => {

    const status = getEpisodeStatus(ep);

    const videoId = getVideoId(ep.link);
    const img = videoId
      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      : "https://i.imgur.com/M15F39y.jpeg";

    let badge = "";
    if (status==="new") badge="🟢 חדש";
    if (status==="locked") badge="🔒 בקרוב";
    if (status==="viewed") badge="👀 נצפה";

    document.getElementById("episodes").innerHTML += `
      <div class="card">

        ${badge ? `<div class="badge">${badge}</div>` : ""}

        <img src="${img}">

        <div class="title">${ep.title}</div>
        <div class="desc">${ep.shortDesc}</div>

        <div class="buttons">

          ${
            status==="locked"
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

/* ------------------ EPISODE ------------------ */
function loadEpisode() {

  const id = new URLSearchParams(location.search).get("id");
  if (!id) return;

  fetch(URL)
    .then(r => r.json())
    .then(data => {

      const ep = data.find(e => String(e.id) === String(id));
      if (!ep) return;

      currentEpisode = ep;

      const now = new Date();
      const publish = ep.publishAt
        ? new Date(ep.publishAt.replace(" ","T"))
        : null;

      if (publish && publish > now) {
        document.body.innerHTML = `
          <div style="padding:20px;text-align:center">
            <h2>🔒 הפרק עדיין לא זמין</h2>
            <p>סבא מכין אותו...</p>
          </div>
        `;
        return;
      }

      document.getElementById("title").innerText = ep.title;
      document.getElementById("desc").innerText = ep.fullDesc || ep.shortDesc;

      const vid = getVideoId(ep.link);

      if (vid) {
        document.getElementById("video").src =
          `https://www.youtube.com/embed/${vid}`;
      } else {
        document.getElementById("video").style.display = "none";
      }

      let viewed = JSON.parse(localStorage.getItem("viewedEpisodes") || "[]");
      if (!viewed.includes(String(ep.id))) {
        viewed.push(String(ep.id));
        localStorage.setItem("viewedEpisodes", JSON.stringify(viewed));
      }

    });
}

/* ------------------ שיתוף ------------------ */
function shareEpisode() {

  if (!currentEpisode) return;

  const msg =
`📖 סיפורי סבא

${currentEpisode.title}

🎧 ${currentEpisode.link}`;

  if (navigator.share) {
    navigator.share({ title: currentEpisode.title, text: msg });
  } else {
    alert("שיתוף לא נתמך");
  }
}

/* ------------------ טעינה ------------------ */
fetch(URL)
  .then(r => r.json())
  .then(data => {
    dataGlobal = data;
    render();
    loadEpisode();
  });

/* ------------------ PWA ------------------ */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
