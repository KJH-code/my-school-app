// api/sheets/write.js
import { verifyIdToken, getValidAccessToken } from '../_lib/google-auth.js';

const ALLOWED_SHEETS = new Set([
  '1pk3xJdqa2y9xDR2B7LcdvcmwCt-mlE95upEC6mIObwc', // 이석/외출
  '18HD1FjfHoNiR6rxgmDPc3wJF-8a6Fs2lFCLYsYWrWe4', // 봉사
]);

// 이메일에서 학번 추출 (26027@sshs.hs.kr → "26027")
function studentIdFromEmail(email) {
  return email.split('@')[0];
}

// 이석 시트 행 검증: 그 행이 본인 학번인지 시트에서 확인
async function verifyAttendanceRow(accessToken, spreadsheetId, range, studentId) {
  // range 예: "학생 신청!C42" → 행 번호 추출
  const match = range.match(/!([A-Z]+)(\d+)/);
  if (!match) return false;
  const rowNum = match[2];
  const col = match[1];

  // 이석은 C 또는 F 컬럼만 허용 (C=창의1 장소, F=창의2 장소)
  if (col !== 'C' && col !== 'F') return false;

  // 같은 행의 A열 (학번) 확인
  const checkRange = `학생 신청!A${rowNum}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(checkRange)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return false;
  const data = await res.json();
  const rowStudentId = data.values?.[0]?.[0];
  return rowStudentId === studentId;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. 신원 확인
    const decoded = await verifyIdToken(req);
    const uid = decoded.uid;
    const email = decoded.email;
    if (!email || !email.endsWith('@sshs.hs.kr')) {
      return res.status(403).json({ error: 'Not a school user' });
    }
    const studentId = studentIdFromEmail(email);

    // 2. 파라미터
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

    // 3. 화이트리스트
    if (!ALLOWED_SHEETS.has(spreadsheetId)) {
      return res.status(403).json({ error: 'Spreadsheet not allowed' });
    }

    // 4. access_token
    const accessToken = await getValidAccessToken(uid);

    // 5. 권한 검증 (시트별/모드별)
    const ATTENDANCE_SHEET = '1pk3xJdqa2y9xDR2B7LcdvcmwCt-mlE95upEC6mIObwc';
    const VOLUNTEER_SHEET = '18HD1FjfHoNiR6rxgmDPc3wJF-8a6Fs2lFCLYsYWrWe4';

    if (spreadsheetId === ATTENDANCE_SHEET && mode === 'update') {
      // 이석 신청 — 본인 행인지 확인
      const ok = await verifyAttendanceRow(accessToken, spreadsheetId, range, studentId);
      if (!ok) {
        return res.status(403).json({ error: '본인 행에만 신청할 수 있어요' });
      }
    } else if (spreadsheetId === ATTENDANCE_SHEET && mode === 'append') {
      // 외출 신청 — range가 "외출 신청!B:F"여야 하고, values 첫 컬럼이 본인 학번
      if (!range.startsWith('외출 신청')) {
        return res.status(403).json({ error: 'Append는 외출 신청 시트만 허용' });
      }
      const firstValue = values?.[0]?.[0];
      if (firstValue !== studentId) {
        return res.status(403).json({ error: '본인 학번으로만 신청할 수 있어요' });
      }
    } else if (spreadsheetId === VOLUNTEER_SHEET && mode === 'append') {
      // 봉사 신청 — values 첫 컬럼이 본인 학번
      const firstValue = values?.[0]?.[0];
      if (firstValue !== studentId) {
        return res.status(403).json({ error: '본인 학번으로만 신청할 수 있어요' });
      }
    } else if (spreadsheetId === VOLUNTEER_SHEET && mode === 'update') {
      // 봉사 시트엔 update 없음
      return res.status(403).json({ error: '봉사 시트는 update 허용 안 됨' });
    }

    // 6. 실제 Sheets API 호출
    let url, method;
    if (mode === 'update') {
      url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
      method = 'PUT';
    } else {
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