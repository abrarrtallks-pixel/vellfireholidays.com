// ============================================================
//  VELLFIRE HOLIDAYS — FIREBASE CONFIGURATION
//  ─────────────────────────────────────────────────────────
//  1. Go to https://console.firebase.google.com
//  2. Create/open your project
//  3. Project Settings → Your apps → Web App → Copy config
//  4. Paste config below replacing placeholder values
//  5. Firestore → Create database → Start in test mode
//  6. Firestore → Rules → Paste and Publish:
//
//     rules_version = '2';
//     service cloud.firestore {
//       match /databases/{database}/documents {
//         match /{document=**} {
//           allow read, write: if true;
//         }
//       }
//     }
// ============================================================

var firebaseConfig = {
  apiKey: "AIzaSyB1dePpXbjM2vtUXX-KR8_P2WsgOuDLR7w",
  authDomain: "tour-and-travel-cc67a.firebaseapp.com",
  projectId: "tour-and-travel-cc67a",
  storageBucket: "tour-and-travel-cc67a.firebasestorage.app",
  messagingSenderId: "496119158738",
  appId: "1:496119158738:web:7e4621bb998ba080505a0b"
};

// ── Admin Credentials ──────────────────────────────────────
var ADMIN_EMAIL = "vellfireholidays@gmail.com";
var ADMIN_PASS  = "Vellfire@2024";
