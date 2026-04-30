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

// 토큰 저장 헬퍼
export function saveSheetsToken(token) {
  const expiresAt = Date.now() + 50 * 60 * 1000; // 50분 후 만료로 가정
  localStorage.setItem("sheets_token", token);
  localStorage.setItem("sheets_token_expires", String(expiresAt));
}

export function getSheetsToken() {
  const token = localStorage.getItem("sheets_token");
  const expiresAt = Number(localStorage.getItem("sheets_token_expires") || 0);
  if (!token) return null;
  if (Date.now() >= expiresAt) return null; // 만료됨
  return token;
}

export function clearSheetsToken() {
  localStorage.removeItem("sheets_token");
  localStorage.removeItem("sheets_token_expires");
}

// 토큰 갱신 — popup 띄움 (재로그인이긴 하지만 hd 파라미터 덕분에 보통 자동으로 통과)
export async function refreshSheetsToken() {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      saveSheetsToken(credential.accessToken);
      return credential.accessToken;
    }
  } catch (e) {
    console.error("토큰 갱신 실패:", e);
  }
  return null;
}

// fetch wrapper — 401 발생 시 자동 갱신 후 재시도
export async function fetchWithAuth(url, options = {}) {
  let token = getSheetsToken();

  // 토큰 없거나 만료됐으면 갱신
  if (!token) {
    token = await refreshSheetsToken();
    if (!token) throw new Error("로그인 갱신이 필요해요. 다시 로그인해주세요.");
  }

  let urlWithToken = url.replace(/access_token=[^&]+/, `access_token=${token}`);
  let res = await fetch(urlWithToken, options);

  if (res.status === 401) {
    // 서버가 만료라고 응답 → 갱신 후 재시도
    token = await refreshSheetsToken();
    if (!token) throw new Error("로그인 갱신이 필요해요. 다시 로그인해주세요.");
    urlWithToken = url.replace(/access_token=[^&]+/, `access_token=${token}`);
    res = await fetch(urlWithToken, options);
  }

  return res;
}