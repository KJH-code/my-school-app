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

    // 1. code를 token으로 교환
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

    // 2. id_token payload 까기 (base64url 디코딩)
    const base64url = tokens.id_token.split('.')[1];
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
    console.log('OAuth payload:', payload);

    // 3. 이메일/이름/사진 변수로 빼기 (필요시 userinfo API fallback)
    let email = payload.email;
    let name = payload.name;
    let picture = payload.picture;

    if (!email) {
      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (userinfoRes.ok) {
        const info = await userinfoRes.json();
        email = email || info.email;
        name = name || info.name;
        picture = picture || info.picture;
      }
    }

    if (!email) {
      return res.redirect('/?auth_error=no_email');
    }

    // 4. 학교 도메인 체크
    if (!email.endsWith('@sshs.hs.kr')) {
      return res.redirect('/?auth_error=invalid_domain');
    }

    // 5. 사용자 찾기 (이메일로) → actualUid 결정
    let actualUid;
    try {
      const existingUser = await adminAuth.getUserByEmail(email);
      actualUid = existingUser.uid;
      await adminAuth.updateUser(actualUid, {
        displayName: name || email.split('@')[0],
        photoURL: picture,
        emailVerified: true,
      });
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        const newUser = await adminAuth.createUser({
          email,
          emailVerified: true,
          displayName: name || email.split('@')[0],
          photoURL: picture,
        });
        actualUid = newUser.uid;
      } else {
        console.error('User lookup failed:', err);
        throw err;
      }
    }

    // 6. Firestore에 토큰 저장 (actualUid 사용)
    const expiresAt = Date.now() + tokens.expires_in * 1000;
    await db.collection('tokens').doc(actualUid).set({
      email,
      accessToken: encrypt(tokens.access_token),
      ...(tokens.refresh_token && {
        refreshToken: encrypt(tokens.refresh_token),
      }),
      expiresAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // 7. Custom token 생성 (actualUid 사용)
    const customToken = await adminAuth.createCustomToken(actualUid, {
      email,
      name: name || email.split('@')[0],
    });

    // 8. 클라이언트로 redirect
    res.redirect(`/?token=${customToken}`);

  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect('/?auth_error=server_error');
  }
}