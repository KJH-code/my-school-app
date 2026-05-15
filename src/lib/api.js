// src/lib/api.js
// 백엔드 API를 부를 때 쓰는 헬퍼. Firebase ID token을 자동으로 헤더에 붙임.

import { getAuth } from 'firebase/auth';

// ============================================================
// 현재 로그인된 사용자의 Firebase ID token 가져오기
// ============================================================
// ID token은 짧게 만료되지만 Firebase SDK가 자동 갱신해줌.
// getIdToken() 부르면 살아있는 토큰 돌려줌.
async function getIdToken() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not logged in');
  }
  return await user.getIdToken();
}

// ============================================================
// 시트 읽기
// ============================================================
// 사용 예: const data = await readSheet(spreadsheetId, '학생 신청!A2:F100');
export async function readSheet(spreadsheetId, range) {
  const idToken = await getIdToken();
  const url = `/api/sheets/read?spreadsheetId=${encodeURIComponent(spreadsheetId)}&range=${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // 백엔드가 401 Re-login required 보내면 로그아웃 처리
    if (res.status === 401 && err.error === 'Re-login required') {
      window.location.href = '/?auth_error=relogin_required';
      throw new Error('Re-login required');
    }
    throw new Error(err.error || `Sheet read failed: ${res.status}`);
  }

  return await res.json();
  // 반환: { range, majorDimension, values: [[...], [...], ...] }
}

// ============================================================
// 시트 쓰기 (update 또는 append)
// ============================================================
// 사용 예:
//   await writeSheet({ spreadsheetId, range: '학생 신청!C5:F5', values: [['도서관', '14:00']], mode: 'update' });
//   await writeSheet({ spreadsheetId, range: '외출 신청!B:F', values: [['24001', '홍길동', ...]], mode: 'append' });
export async function writeSheet({ spreadsheetId, range, values, mode }) {
  const idToken = await getIdToken();
  const res = await fetch('/api/sheets/write', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ spreadsheetId, range, values, mode }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401 && err.error === 'Re-login required') {
      window.location.href = '/?auth_error=relogin_required';
      throw new Error('Re-login required');
    }
    throw new Error(err.error || `Sheet write failed: ${res.status}`);
  }

  return await res.json();
}