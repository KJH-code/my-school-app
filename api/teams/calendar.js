// api/teams/calendar.js
import { db, encrypt, decrypt, adminAuth } from '../_lib/google-auth.js';
import admin from 'firebase-admin';

async function refreshMsToken(refreshToken) {
  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MS_CLIENT_ID,
        client_secret: process.env.MS_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'openid profile email offline_access Calendars.Read',
      }),
    }
  );
  if (!res.ok) throw new Error('Refresh failed: ' + await res.text());
  return await res.json();
}

export default async function handler(req, res) {
  try {
    // 1. 사용자 인증 — Authorization 헤더의 Firebase ID token
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: 'No auth token' });

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const uid = decoded.uid;

    // 2. Firestore에서 MS 토큰 조회
    const tokenDoc = await db.collection('microsoftTokens').doc(uid).get();
    if (!tokenDoc.exists) {
      return res.status(403).json({ error: 'not_linked', message: '팀즈 연결이 필요합니다' });
    }
    const data = tokenDoc.data();
    let accessToken = decrypt(data.accessToken);

    // 3. 만료됐으면 refresh
    if (Date.now() >= data.expiresAt - 60_000) {
      if (!data.refreshToken) {
        return res.status(403).json({ error: 'no_refresh_token', message: '재연결이 필요합니다' });
      }
      const refreshed = await refreshMsToken(decrypt(data.refreshToken));
      accessToken = refreshed.access_token;
      const expiresAt = Date.now() + refreshed.expires_in * 1000;
      await db.collection('microsoftTokens').doc(uid).set({
        accessToken: encrypt(refreshed.access_token),
        ...(refreshed.refresh_token && {
          refreshToken: encrypt(refreshed.refresh_token),
        }),
        expiresAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    // 4. Graph API 호출 — 향후 7일 일정
    const now = new Date();
    const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const url = new URL('https://graph.microsoft.com/v1.0/me/calendarView');
    url.searchParams.set('startDateTime', now.toISOString());
    url.searchParams.set('endDateTime', future.toISOString());
    url.searchParams.set('$select', 'subject,start,end,location,isAllDay,organizer,bodyPreview');
    url.searchParams.set('$orderby', 'start/dateTime');
    url.searchParams.set('$top', '50');

    const graphRes = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="Asia/Seoul"',
      },
    });

    if (!graphRes.ok) {
      const errText = await graphRes.text();
      console.error('Graph API failed:', errText);
      return res.status(500).json({ error: 'graph_failed', detail: errText });
    }

    const graphData = await graphRes.json();
    const events = (graphData.value || []).map((e) => ({
      subject: e.subject,
      start: e.start?.dateTime,
      end: e.end?.dateTime,
      isAllDay: e.isAllDay,
      location: e.location?.displayName || '',
      organizer: e.organizer?.emailAddress?.name || '',
      preview: e.bodyPreview || '',
    }));

    return res.status(200).json({ events });

  } catch (err) {
    console.error('Teams calendar error:', err);
    return res.status(500).json({ error: err.message });
  }
}