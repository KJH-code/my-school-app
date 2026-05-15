// api/_lib/google-auth.js
// 토큰 복호화, 자동 갱신, 시트 API에서 공통으로 쓸 헬퍼들

import admin from 'firebase-admin';
import crypto from 'crypto';

// ============================================================
// Firebase Admin 초기화 (callback.js랑 똑같음)
// ============================================================
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
export const db = admin.firestore();
export const adminAuth = admin.auth();

// ============================================================
// 암호화 / 복호화
// ============================================================
export function encrypt(text) {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('hex');
}

export function decrypt(hex) {
  const data = Buffer.from(hex, 'hex');
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex');
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// ============================================================
// Firebase ID token 검증 (요청 보낸 사람이 진짜 로그인 한 사람인지)
// ============================================================
// 클라이언트가 API 호출할 때 Authorization 헤더에 Firebase ID token을 담아 보냄.
// 백엔드에선 이걸 검증해서 어느 사용자 요청인지 확인.
export async function verifyIdToken(req) {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.replace('Bearer ', '');
  if (!idToken) {
    throw new Error('No auth token');
  }
  return await adminAuth.verifyIdToken(idToken);
}

// ============================================================
// 유효한 access_token 가져오기 (필요하면 자동 갱신)
// ============================================================
// 이게 핵심. 호출하면 무조건 살아있는 access_token 돌려줌.
// 만료됐으면 알아서 refresh_token으로 갱신함.
export async function getValidAccessToken(uid) {
  // 1. Firestore에서 토큰 doc 꺼내기
  const tokenDoc = await db.collection('tokens').doc(uid).get();
  if (!tokenDoc.exists) {
    throw new Error('No tokens found for user');
  }
  const data = tokenDoc.data();

  // 2. 아직 살아있는 access_token이면 그대로 반환
  //    여유분 60초 빼서 체크 (만료 직전에 호출하면 도중에 죽을 수 있으니까)
  if (data.expiresAt && data.expiresAt > Date.now() + 60_000) {
    return decrypt(data.accessToken);
  }

  // 3. 만료됐으면 refresh_token으로 갱신
  if (!data.refreshToken) {
    throw new Error('No refresh token; user must re-login');
  }
  const refreshToken = decrypt(data.refreshToken);

  // Google에 갱신 요청
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Refresh failed:', errText);
    throw new Error('Failed to refresh token');
  }

  const newTokens = await response.json();
  // newTokens 구조 (refresh 때는 refresh_token이 빠짐):
  // { access_token, expires_in, scope, token_type }

  // 4. 새 access_token 저장
  const newExpiresAt = Date.now() + newTokens.expires_in * 1000;
  await db.collection('tokens').doc(uid).update({
    accessToken: encrypt(newTokens.access_token),
    expiresAt: newExpiresAt,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return newTokens.access_token;
}