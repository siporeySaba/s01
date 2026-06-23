import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBAMnTuMwt83UU2JNBhcOty8CN4elv8_oM",
  authDomain: "siporeysaba-100.firebaseapp.com",
  projectId: "siporeysaba-100",
  storageBucket: "siporeysaba-100.appspot.com",
  messagingSenderId: "780184204501",
  appId: "1:780184204501:web:8314e52e46d9635d69de5c"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
