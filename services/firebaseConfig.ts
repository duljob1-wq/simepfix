
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Konfigurasi Firebase sesuai instruksi
const firebaseConfig = {
  apiKey: "AIzaSyCQZusj03pK2a35b6RvFGfz-dgQKgPQyZc",
  authDomain: "simep-c57c2.firebaseapp.com",
  projectId: "simep-c57c2",
  storageBucket: "simep-c57c2.firebasestorage.app",
  messagingSenderId: "818950850218",
  appId: "1:818950850218:web:75e69b693b0c3f383db2d3",
  measurementId: "G-3XQQ291QMR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const db = getFirestore(app); // Database service
export const analytics = getAnalytics(app); // Analytics service
