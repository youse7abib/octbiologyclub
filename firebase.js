// firebase.js
// Shared Firebase initialization for the October BioClub site.
// Uses the new octbioclub-7abib project and v12 modular SDK.

import { initializeApp }  from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAnalytics }   from "https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getStorage }     from "https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js";

// Firebase configuration – new project
const firebaseConfig = {
  apiKey:            "AIzaSyCpRpeTi467dWB6dRInIPdAS6c5v0R2qs0",
  authDomain:        "octbioclub-7abib.firebaseapp.com",
  projectId:         "octbioclub-7abib",
  storageBucket:     "octbioclub-7abib.firebasestorage.app",
  messagingSenderId: "930548525478",
  appId:             "1:930548525478:web:6ca448018d8a3a7d598767"
};


// Initialize Firebase
const app      = initializeApp(firebaseConfig);
const db       = getFirestore(app);
const auth     = getAuth(app);
const storage  = getStorage(app);

// Analytics is optional; safe to ignore failure in local/file contexts.
try {
  getAnalytics(app);
} catch {
  // no-op
}

// Export core services for other modules
export { app, db, auth, storage };

