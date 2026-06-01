import { useState, useEffect } from "react";
import { auth } from "./firebase";

const MS_CLIENT_ID = "e31cc861-5e2d-439c-91a5-dac293c1feef";
const MS_TENANT_ID = "46d06b87-b588-43e7-9f9b-f4c0af13bfd2";

export default function Teams({ user }) {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);
  const [notLinked, setNotLinked] = useState(false);

  useEffect(() => {
    // URL에 ms_linked=1 있으면 방금 연결된 거 → 깨끗하게 정리
    const params = new URLSearchParams(window.location.search);
    if (params.get('ms_linked') || params.get('ms_error')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (user) fetchEvents();
  }, [user]);

  const fetchEvents = async () => {
    try {
      setError(null);
      setNotLinked(false);
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/teams/calendar', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (data.error === 'not_linked' || data.error === 'no_refresh_token') {
        setNotLinked(true);
        return;
      }
      if (data.error) throw new Error(data.error);
      setEvents(data.events || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const linkMicrosoft = async () => {
    const idToken = await auth.currentUser.getIdToken();
    const redirectUri = `${window.location.origin}/api/auth/ms-callback`;
    const scope = ['openid','profile','email','offline_access','Calendars.Read'].join(' ');
    const params = new URLSearchParams({
      client_id: MS_CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope,
      state: idToken,
      prompt: 'select_account',
    });
    window.location.href = `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize?${params}`;
  };

  if (!user) {
    return <div className="home-empty">팀즈 일정을 보려면 먼저 로그인해주세요.</div>;
  }

  if (notLinked) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💼</div>
        <h2 style={{ marginBottom: 8 }}>팀즈 연결</h2>
        <p style={{ color: '#94a3b8', marginBottom: 24 }}>
          내 팀즈 일정과 회의를 SSHS Portal에서 볼 수 있어요.<br/>
          학교 마이크로소프트 계정으로 한 번만 연결하면 됩니다.
        </p>
        <button onClick={linkMicrosoft} style={{
          background: '#2563eb', color: 'white', border: 'none',
          padding: '10px 20px', borderRadius: 8, fontSize: 15, cursor: 'pointer',
        }}>
          마이크로소프트 계정으로 팀즈 연결
        </button>
      </div>
    );
  }

  if (error) return <div className="home-empty">팀즈 일정을 불러오지 못했어요: {error}</div>;
  if (!events) return <div className="home-empty">팀즈 일정을 불러오는 중...</div>;
  if (events.length === 0) return <div className="home-empty">앞으로 7일간 팀즈 일정이 없습니다.</div>;

  const fmtTime = (iso) => {
    const d = new Date(iso);
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={fetchEvents} style={{
          background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
          borderRadius: 8, padding: '4px 12px', fontSize: 13, cursor: 'pointer',
        }}>↻ 새로고침</button>
      </div>
      {events.map((e, i) => (
        <div key={i} style={{
          padding: 12, marginBottom: 10, borderRadius: 8,
          background: 'rgba(96,165,250,0.08)', border: '1px solid #1e293b',
        }}>
          <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
            {e.subject || '(제목 없음)'}
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            {fmtTime(e.start)} ~ {fmtTime(e.end)}
            {e.location && <> · 📍 {e.location}</>}
          </div>
          {e.organizer && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              주최: {e.organizer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}