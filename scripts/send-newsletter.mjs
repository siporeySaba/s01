// שליחת העלון השבועי במייל לכל הנרשמים (רץ בגיטהאב בכל יום רביעי בבוקר).
// בוחר מ-alon/sheets.json את העלון האחרון שתאריך השליחה שלו הגיע ושעוד לא נשלח.
// משתני סביבה: FIREBASE_SERVICE_ACCOUNT, GMAIL_USER, GMAIL_APP_PASSWORD, FORCE_FILE (לא חובה), DRY_RUN, TEST_TO (שליחת בדיקה לכתובת אחת)
import fs from "node:fs";
import admin from "firebase-admin";
import nodemailer from "nodemailer";

const SITE = "https://siporeysaba.com";
const WA_GROUP = "https://chat.whatsapp.com/Bw6tW2DqX1mJNGeKQE0V6N";
const ROOT = new URL("../", import.meta.url);
const dry = process.env.DRY_RUN === "1";

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

// 1. בקשות הסרה: מוחקים את הנרשם ואת הבקשה
const unsubs = await db.collection("unsubscribes").get();
for (const u of unsubs.docs) {
  const sub = await db.collection("subscribers").doc(u.id).get();
  if (sub.exists) {
    // מוחקים גם הרשמות כפולות של אותו מייל
    const same = await db.collection("subscribers").where("email", "==", sub.data().email).get();
    for (const d of same.docs) if (!dry) await d.ref.delete();
    console.log("הוסר:", sub.data().email.replace(/(.).*@/, "$1***@"));
  }
  if (!dry) await u.ref.delete();
}

// 2. איזה עלון שולחים
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const sheets = JSON.parse(fs.readFileSync(new URL("alon/sheets.json", ROOT), "utf8"));
const force = process.env.FORCE_FILE;
const sheet = force ? sheets.find(s => s.file === force)
  : [...sheets].reverse().find(s => s.sendOn <= today);
if (!sheet) { console.log("אין עלון לשליחה היום"); process.exit(0); }
const logRef = db.collection("newsletter_sent").doc(sheet.file.replace(/\W/g, "_"));
if (!force && !process.env.TEST_TO && (await logRef.get()).exists) { console.log("העלון כבר נשלח:", sheet.file); process.exit(0); }

// 3. רשימת הנמענים (בלי כפילויות)
let rcpts = [];
if (process.env.TEST_TO) rcpts = [{ email: process.env.TEST_TO, token: "test" }];
else {
  const seen = new Set();
  for (const d of (await db.collection("subscribers").get()).docs) {
    const e = String(d.data().email || "").toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e); rcpts.push({ email: e, name: d.data().name, token: d.id });
  }
}
console.log(`שולחים את "${sheet.parasha}" ל-${rcpts.length} נמענים${dry ? " (הרצה יבשה)" : ""}`);
if (!rcpts.length || dry) process.exit(0);
if (!process.env.GMAIL_APP_PASSWORD) { console.error("חסרה סיסמת האפליקציה של ג'ימייל (GMAIL_APP_PASSWORD)"); process.exit(1); }

const pdfUrl = `${SITE}/alon/${sheet.file}`;
const pdf = fs.readFileSync(new URL(`alon/${sheet.file}`, ROOT));
const html = (r) => `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#fff7e0;font-family:Arial,sans-serif;color:#1d1d1d">
<div style="max-width:560px;margin:0 auto;padding:20px">
 <div style="background:#fff;border:2px solid #1d1d1d;border-radius:16px;padding:20px;text-align:right">
  <img src="${SITE}/img/logo.jpg" alt="סיפורי סבא" width="64" height="64" style="border-radius:50%;border:2px solid #1d1d1d;float:left">
  <p style="margin:0;font-weight:bold;color:#b04a00">סבא בפרשה · עלון לשולחן השבת</p>
  <h1 style="margin:4px 0 12px;font-size:28px">${sheet.parasha}</h1>
  <p style="font-size:16px;line-height:1.5">שלום${r.name ? " " + r.name : ""} 👋<br>העלון השבועי שלנו כבר כאן! ${sheet.summary}</p>
  <p style="font-size:16px;line-height:1.5">בעלון: הסיפור המלא, שאלות לשולחן השבת, חפשו ומצאו לקטנים, וחידה בפרשה. הדפיסו, ספרו לילדים לפני השינה או בשולחן השבת. אין כמו חיבור בין הורה לילד ❤️</p>
  <p style="text-align:center;margin:22px 0"><a href="${pdfUrl}" style="background:#1f9a8a;color:#fff;text-decoration:none;padding:12px 26px;border-radius:30px;font-weight:bold;font-size:17px">להורדת העלון (PDF)</a></p>
  <p style="font-size:14px;line-height:1.5">העלון מצורף גם למייל הזה. את הסרטונים והסיפורים תמצאו ב-<a href="${SITE}">siporeysaba.com</a>, וגם <a href="${WA_GROUP}">בקבוצת הוואטסאפ</a>.<br>הערות והארות: וואטסאפ 054-9460693</p>
  <p style="font-size:16px;font-weight:bold">שבת שלום! 🌟<br>משפחת "סיפורי סבא"</p>
 </div>
 <p style="font-size:12px;color:#777;text-align:center;line-height:1.5">קיבלתם את המייל כי נרשמתם לעלון של סיפורי סבא.<br><a href="${SITE}/alon.html?unsub=${r.token}" style="color:#777">להסרה מרשימת התפוצה לחצו כאן</a></p>
</div></body></html>`;

const tx = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
let ok = 0, fail = 0;
for (const r of rcpts) {
  try {
    await tx.sendMail({
      from: `"סיפורי סבא" <${process.env.GMAIL_USER}>`, to: r.email,
      subject: `📖 העלון לשולחן השבת: ${sheet.parasha}`,
      html: html(r),
      text: `העלון השבועי: ${sheet.parasha}\n${pdfUrl}\n\nלהסרה: ${SITE}/alon.html?unsub=${r.token}`,
      attachments: [{ filename: `סיפורי סבא - ${sheet.parasha}.pdf`, content: pdf }],
      headers: { "List-Unsubscribe": `<${SITE}/alon.html?unsub=${r.token}>` }
    });
    ok++;
  } catch (e) { fail++; console.error("נכשל:", r.email.replace(/(.).*@/, "$1***@"), e.message); }
  await new Promise(res => setTimeout(res, 1500));
}
console.log(`נשלחו ${ok}, נכשלו ${fail}`);
if (!process.env.TEST_TO && ok) await logRef.set({ file: sheet.file, sentAt: admin.firestore.FieldValue.serverTimestamp(), ok, fail });
