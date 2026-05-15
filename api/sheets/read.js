// api/sheets/read.js
// 클라이언트가 시트를 읽고 싶을 때 호출하는 API
// 호출 예: GET /api/sheets/read?spreadsheetId=xxx&range=학생%20신청!A2:F100

import { verifyIdToken, getValidAccessToken } from '../_lib/google-auth.js';

// ============================================================
// 허용된 spreadsheet ID 화이트리스트
// ============================================================
// 보안: 클라이언트가 임의의 spreadsheet ID 보내면 백엔드가 다 읽어줄 수 있음.
// 우리가 쓰는 시트만 허용하도록 미리 등록.
const ALLOWED_SHEETS = new Set([
  '1pk3xJdqa2y9xDR2B7LcdvcmwCt-mlE95upEC6mIObwc', // 이석/외출
  '18HD1FjfHoNiR6rxgmDPc3wJF-8a6Fs2lFCLYsYWrWe4', // 봉사
]);

export default async function handler(req, res) {
  // GET 요청만 받음
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. 요청 보낸 사람이 진짜 누구인지 확인
    const decoded = await verifyIdToken(req);
    const uid = decoded.uid;

    // 2. 쿼리에서 spreadsheetId, range 꺼내기
    const { spreadsheetId, range } = req.query;
    if (!spreadsheetId || !range) {
      return res.status(400).json({ error: 'Missing spreadsheetId or range' });
    }

    // 3. 화이트리스트 체크
    if (!ALLOWED_SHEETS.has(spreadsheetId)) {
      return res.status(403).json({ error: 'Spreadsheet not allowed' });
    }

    // 4. 살아있는 access_token 가져오기 (필요시 자동 갱신)
    const accessToken = await getValidAccessToken(uid);

    // 5. Google Sheets API 호출
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
    const sheetsResponse = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!sheetsResponse.ok) {
      const errText = await sheetsResponse.text();
      console.error('Sheets API failed:', errText);
      return res.status(sheetsResponse.status).json({
        error: 'Sheets API call failed',
        detail: errText,
      });
    }

    const data = await sheetsResponse.json();
    // data 구조: { range: "...", majorDimension: "ROWS", values: [[...], [...], ...] }

    // 6. 클라이언트로 응답
    return res.status(200).json(data);

  } catch (err) {
    console.error('Read sheet error:', err);
    if (err.message === 'No auth token' || err.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (err.message === 'No tokens found for user' || err.message === 'No refresh token; user must re-login') {
      return res.status(401).json({ error: 'Re-login required' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
}