// Import static Firebase SDKs from CDN (ESM format)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Configuración de Firebase de STORE SAPI provista por el usuario
const firebaseConfig = {
  apiKey: "AIzaSyAnmmSoayKSbWhPlq3l1kFyabZI9xXxJUs",
  authDomain: "store-sapi.firebaseapp.com",
  projectId: "store-sapi",
  storageBucket: "store-sapi.firebasestorage.app",
  messagingSenderId: "474239099272",
  appId: "1:474239099272:web:c14fc1a4b502806fab5a3d",
  measurementId: "G-35RL4SQ4HG"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, db, auth, googleProvider };
