import { initializeApp, getApps } from "firebase/app";
import { getAuth }                 from "firebase/auth";

// Same config as config.js — copy the same values
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Prevent duplicate app error during hot reload
const secondaryApp =
  getApps().find(a => a.name === "Secondary") ||
  initializeApp(firebaseConfig, "Secondary");  // ← "Secondary" is just a name tag

export const secondaryAuth = getAuth(secondaryApp);