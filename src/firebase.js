import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyACAcjtRdWLFRA1TcSi-M4K0F8sf-2TljQ",
  authDomain: "sshs-portal-7602a.firebaseapp.com",
  projectId: "sshs-portal-7602a",
  storageBucket: "sshs-portal-7602a.firebasestorage.app",
  messagingSenderId: "493777626300",
  appId: "1:493777626300:web:19749a4dd449c5a88b5cb9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);