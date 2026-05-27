import { useState, useEffect } from "react";

export default function Calendar() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const year = new Date().getFullYear();
        const API_KEY = "b239e5a1b3ec421dbad518ed199277bb";
        const url = `https://open.neis.go.kr/hub/SchoolSchedule?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=B10&SD_SCHUL_CODE=7010084&AA_FROM_YMD=${year}0101&AA_TO_YMD=${year}1231&pSize=1000`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.RESULT) {     // INFO-200 = 데이터 없음
          setEvents([]);
          return;
        }
        const rows = data.SchoolSchedule?.[1]?.row || [];
        setEvents(rows.map((row) => ({
          date: row.AA_YMD,
          name: row.EVENT_NM,
          content: row.EVENT_CNTNT || "",
        })));
      } catch (e) {
        setError(e.message);
      }
    };
    fetchSchedule();
  }, []);

  if (error) return <div className="home-empty">학사일정을 불러오지 못했어요: {error}</div>;
  if (!events) return <div className="home-empty">학사일정을 불러오는 중...</div>;
  if (events.length === 0) return <div className="home-empty">등록된 학사일정이 없습니다.</div>;

  const fmt = (ymd) => `${Number(ymd.slice(4, 6))}월 ${Number(ymd.slice(6, 8))}일`;

  // 오늘 이후 일정만 (지난 건 숨김 — 다 보고 싶으면 이 필터 빼면 됨)
  const t = new Date();
  const todayStr = `${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, "0")}${String(t.getDate()).padStart(2, "0")}`;
  const upcoming = events.filter((e) => e.date >= todayStr);

  return (
    <div className="home-section">
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {upcoming.map((e, i) => (
          <li key={i} className="home-meal-row">
            <span className="home-meal-type">{fmt(e.date)}</span>
            <span className="home-meal-items">{e.name}{e.content ? ` (${e.content})` : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}