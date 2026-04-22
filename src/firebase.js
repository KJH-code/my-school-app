import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyB3eDtyGyacexgxKtsNtDYz9oA5GZkjlec",
  authDomain: "my-school-app-d7c63.firebaseapp.com",
  projectId: "my-school-app-d7c63",
  storageBucket: "my-school-app-d7c63.firebasestorage.app",
  messagingSenderId: "531431525847",
  appId: "1:531431525847:web:29ac03a8835576a3308f92"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

export const db = getFirestore(app);
// 학교 계정만 허용 — 학교 도메인으로 바꿔줘!
provider.setCustomParameters({ hd: "sshs.hs.kr" });