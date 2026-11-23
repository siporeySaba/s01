// כלי לכללי האבטחה של Firestore: show = הדפסת הכללים, apply = פרסום קובץ firestore.rules מהמאגר
import fs from "node:fs";
import admin from "firebase-admin";
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const { access_token } = await admin.credential.cert(sa).getAccessToken();
const P = `projects/${sa.project_id}`, API = "https://firebaserules.googleapis.com/v1";
const H = { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" };
const j = async r => { const t = await r.text(); if (!r.ok) throw new Error(r.status + " " + t); return JSON.parse(t); };
const rel = await j(await fetch(`${API}/${P}/releases/cloud.firestore`, { headers: H }));
const cur = await j(await fetch(`${API}/${rel.rulesetName}`, { headers: H }));
console.log("=== current rules ===\n" + cur.source.files.map(f => f.content).join("\n"));
if (process.argv[2] === "apply") {
  const content = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  const rs = await j(await fetch(`${API}/${P}/rulesets`, { method: "POST", headers: H, body: JSON.stringify({ source: { files: [{ name: "firestore.rules", content }] } }) }));
  await j(await fetch(`${API}/${P}/releases/cloud.firestore`, { method: "PATCH", headers: H, body: JSON.stringify({ release: { name: `${P}/releases/cloud.firestore`, rulesetName: rs.name } }) }));
  console.log("=== applied", rs.name);
}
