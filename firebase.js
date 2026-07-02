import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBAMnTuMwt83UU2JNBhcOty8CN4elv8_oM",
  authDomain: "siporeysaba-100.firebaseapp.com",
  projectId: "siporeysaba-100",
  storageBucket: "siporeysaba-100.appspot.com",
  messagingSenderId: "780184204501",
  appId: "1:780184204501:web:8314e52e46d9635d69de5c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };

// אפשר offline caching
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.log("אחד מהחלונות לא תומך בcache");
    } else if (err.code === 'unimplemented') {
      console.log("הדפדפן לא תומך בcache");
    }
  });
