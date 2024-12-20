import { initializeApp } from "firebase/app";
import { get, getDatabase, ref, set } from "firebase/database";
// import dotenv from "dotenv";
// dotenv.config({ path: ".env.local" });

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
  databaseURL: process.env.FIREBASE_DB_URL || "",
  projectId: process.env.FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.FIREBASE_SENDER_ID || "",
  appId: process.env.FIREBASE_APP_ID || "",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export const getServerStatusDB = async () => {
  const snapshot = await get(ref(database, "status-server-data/"));
  return snapshot.val();
};

export const updateServerStatusDB = async (status) => {
  await set(ref(database, "status-server-data/"), status);
};
