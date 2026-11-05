import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// מפתח הלקוח של Firebase הוא ציבורי מטבעו. ההגנה על הנתונים היא בכללי האבטחה (Firestore Rules).
const firebaseConfig = {
  apiKey: "AIzaSyBAMnTuMwt83UU2JNBhcOty8CN4elv8_oM",
  authDomain: "siporeysaba-100.firebaseapp.com",
  projectId: "siporeysaba-100",
  storageBucket: "siporeysaba-100.appspot.com",
  messagingSenderId: "780184204501",
  appId: "1:780184204501:web:8314e52e46d9635d69de5c"
};

const app = initializeApp(firebaseConfig);

let db;
try {
  // מטמון מקומי: האתר עובד גם בלי אינטרנט ונטען מהר יותר
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch {
  db = initializeFirestore(app, {});
}

export { app, db };
