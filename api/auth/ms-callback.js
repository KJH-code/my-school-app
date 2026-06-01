// api/auth/ms-callback.js
import { db, adminAuth, encrypt } from '../_lib/google-auth.js';
import admin from 'firebase-admin';

export default async function handler(req, res) {
  try {
    const { code, error, error_description, state } = req.query;

    if (error) {
      return res.redirect(`/?ms_error=${encodeURIComponent(error_description || error)}`);
    }
    if (!code) {
      return res.redirect('/?ms_error=no_code');
    }
    if (!state) {
      return res.redirect('/?ms_error=no_state');
    }

    // 1. state = Firebase ID token → 어떤 사용자인지 확인
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(state);
    } catch (err) {
      console.error('ID token verification failed:', err);
      return res.redirect('/?ms_error=invalid_state');
    }
    const uid = decoded.uid;
    const email = decoded.email;

    // 2. code → MS token 교환
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.MS_CLIENT_ID,
          client_secret: process.env.MS_CLIENT_SECRET,
          code,
          redirect_uri: `https://${req.headers.host}/api/auth/ms-callback`,
          grant_type: 'authorization_code',
          scope: 'openid profile email offline_access Calendars.Read',
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('MS token exchange failed:', errText);
      return res.redirect('/?ms_error=token_exchange_failed');
    }

    const tokens = await tokenResponse.json();

    // 3. id_token에서 사용자 정보 (학교 계정 확인용)
    let msEmail = null;
    if (tokens.id_token) {
      const base64url = tokens.id_token.split('.')[1];
      const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
      msEmail = payload.email || payload.preferred_username;
    }

    // 4. Firestore에 토큰 저장 (Google과 분리된 microsoftTokens 컬렉션)
    const expiresAt = Date.now() + tokens.expires_in * 1000;
    await db.collection('microsoftTokens').doc(uid).set({
      sshsEmail: email,
      msEmail,
      accessToken: encrypt(tokens.access_token),
      ...(tokens.refresh_token && {
        refreshToken: encrypt(tokens.refresh_token),
      }),
      expiresAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.redirect('/?ms_linked=1');

  } catch (err) {
    console.error('MS OAuth callback error:', err);
    res.redirect('/?ms_error=server_error');
  }
}