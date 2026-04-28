import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
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
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);

provider.setCustomParameters({ hd: "sshs.hs.kr" });
provider.addScope("https://www.googleapis.com/auth/spreadsheets");

// 토큰 갱신 헬퍼 — 만료된 토큰을 새 토큰으로 자동 교체
export async function refreshSheetsToken() {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      sessionStorage.setItem("sheets_token", credential.accessToken);
      return credential.accessToken;
    }
  } catch (e) {
    console.error("토큰 갱신 실패:", e);
  }
  return null;
}

// fetch wrapper — 401 발생 시 자동 갱신 후 재시도
export async function fetchWithAuth(url, options = {}) {
  let token = sessionStorage.getItem("sheets_token");
  let urlWithToken = url.replace(/access_token=[^&]+/, `access_token=${token}`);
  
  let res = await fetch(urlWithToken, options);
  
  if (res.status === 401) {
    // 토큰 만료 → 갱신 후 재시도
    token = await refreshSheetsToken();
    if (!token) throw new Error("로그인 갱신이 필요해요. 다시 로그인해주세요.");
    urlWithToken = url.replace(/access_token=[^&]+/, `access_token=${token}`);
    res = await fetch(urlWithToken, options);
  }
  
  return res;
}