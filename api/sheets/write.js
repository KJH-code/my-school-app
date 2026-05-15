// api/sheets/write.js
// 클라이언트가 시트에 쓰고 싶을 때 호출하는 API
// POST /api/sheets/write
// body: { spreadsheetId, range, values, mode: 'update' | 'append' }

import { verifyIdToken, getValidAccessToken } from '../_lib/google-auth.js';

// ============================================================
// 허용된 spreadsheet ID 화이트리스트
// ============================================================
const ALLOWED_SHEETS = new Set([
  '1pk3xJdqa2y9xDR2B7LcdvcmwCt-mlE95upEC6mIObwc', // 이석/외출
  '18HD1FjfHoNiR6rxgmDPc3wJF-8a6Fs2lFCLYsYWrWe4', // 봉사
]);

export default async function handler(req, res) {
  // POST 요청만 받음 (쓰기는 POST)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. 신원 확인
    const decoded = await verifyIdToken(req);
    const uid = decoded.uid;

    // 2. body에서 파라미터 꺼내기
    const { spreadsheetId, range, values, mode } = req.body || {};

    if (!spreadsheetId || !range || !values) {
      return res.status(400).json({ error: 'Missing parameters' });
    }
    if (!Array.isArray(values)) {
      return res.status(400).json({ error: 'values must be an array' });
    }
    if (mode !== 'update' && mode !== 'append') {
      return res.status(400).json({ error: 'mode must be "update" or "append"' });
    }

    // 3. 화이트리스트 체크
    if (!ALLOWED_SHEETS.has(spreadsheetId)) {
      return res.status(403).json({ error: 'Spreadsheet not allowed' });
    }

    // 4. 살아있는 access_token 가져오기
    const accessToken = await getValidAccessToken(uid);

    // 5. mode에 따라 다른 Google Sheets API endpoint 호출
    let url, method;
    if (mode === 'update') {
      // values.update — 특정 범위에 값 쓰기 (덮어쓰기)
      url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
      method = 'PUT';
    } else {
      // values.append — 마지막 비어있는 행 다음에 추가
      url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      method = 'POST';
    }

    const sheetsResponse = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    });

    if (!sheetsResponse.ok) {
      const errText = await sheetsResponse.text();
      console.error('Sheets write failed:', errText);
      return res.status(sheetsResponse.status).json({
        error: 'Sheets API call failed',
        detail: errText,
      });
    }

    const data = await sheetsResponse.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error('Write sheet error:', err);
    if (err.message === 'No auth token' || err.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (err.message === 'No tokens found for user' || err.message === 'No refresh token; user must re-login') {
      return res.status(401).json({ error: 'Re-login required' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
}