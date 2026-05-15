// api/auth/callback.js
import { db, adminAuth, encrypt } from '../_lib/google-auth.js';
import admin from 'firebase-admin';

export default async function handler(req, res) {
  try {
    const { code, error } = req.query;

    if (error) {
      return res.redirect(`/?auth_error=${encodeURIComponent(error)}`);
    }
    if (!code) {
      return res.redirect('/?auth_error=no_code');
    }

    // code를 token으로 교환
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `https://${req.headers.host}/api/auth/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('Token exchange failed:', errText);
      return res.redirect('/?auth_error=token_exchange_failed');
    }

    const tokens = await tokenResponse.json();

    // id_token에서 사용자 정보 꺼내기
    const payload = JSON.parse(
      Buffer.from(tokens.id_token.split('.')[1], 'base64').toString()
    );
    const email = payload.email;
    const uid = payload.sub;

    // 학교 도메인 체크
    if (!email.endsWith('@sshs.hs.kr')) {
      return res.redirect('/?auth_error=invalid_domain');
    }

    // Firestore에 토큰 저장
    const expiresAt = Date.now() + tokens.expires_in * 1000;
    await db.collection('tokens').doc(uid).set({
      email,
      accessToken: encrypt(tokens.access_token),
      ...(tokens.refresh_token && {
        refreshToken: encrypt(tokens.refresh_token),
      }),
      expiresAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // displayName, photoURL 설정
    // displayName, photoURL 설정
    // 사용자 찾기 (이메일로 먼저 — 기존 popup 흐름으로 만들어진 계정 호환)
    let actualUid;
    try {
      const existingUser = await adminAuth.getUserByEmail(email);
      actualUid = existingUser.uid;
      // 정보 업데이트
      await adminAuth.updateUser(actualUid, {
        displayName: payload.name,
        photoURL: payload.picture,
        emailVerified: true,
      });
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        // 새 사용자
        const newUser = await adminAuth.createUser({
          email,
          emailVerified: true,
          displayName: payload.name,
          photoURL: payload.picture,
        });
        actualUid = newUser.uid;
      } else {
        console.error('User lookup failed:', err);
        throw err;
      }
    }

    // Custom token 생성
    const customToken = await adminAuth.createCustomToken(uid, {
      email,
      name: payload.name,
    });

    res.redirect(`/?token=${customToken}`);

  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect('/?auth_error=server_error');
  }
}