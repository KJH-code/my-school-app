import { useState, useEffect } from "react";

// 일정 분류: 행사명 키워드로 카테고리 판정
function categorize(name) {
  if (/고사|시험|평가/.test(name)) return "exam";
  if (/휴업|휴일|방학|공휴일|현충일|광복절|제헌절|개천절|한글날|성탄|신정|설날|추석|대체|개교/.test(name)) return "holiday";
  return "normal";
}

const CAT = {
  exam:    { color: "#f87171", dot: "#f87171", tag: "시험" },
  holiday: { color: "#4ade80", dot: "#4ade80", tag: "휴일" },
  normal:  { color: "#cbd5e1", dot: "#64748b", tag: "" },
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function weekdayOf(ymd) {
  const d = new Date(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8));
  return d.getDay(); // 0=일 ... 6=토
}

export default function Calendar() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false); // 지난 일정도 볼지

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const year = new Date().getFullYear();
        const API_KEY = "b239e5a1b3ec421dbad518ed199277bb";
        const url = `https://open.neis.go.kr/hub/SchoolSchedule?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=B10&SD_SCHUL_CODE=7010084&AA_FROM_YMD=${year}0101&AA_TO_YMD=${year}1231&pSize=1000`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.RESULT) { setEvents([]); return; }
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

  const t = new Date();
  const todayStr = `${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, "0")}${String(t.getDate()).padStart(2, "0")}`;

  // 지난 일정 숨김 (토글로 전체 보기 가능)
  const list = showAll ? events : events.filter((e) => e.date >= todayStr);

  // 월별 그룹핑
  const grouped = {};
  list.forEach((e) => {
    const ym = e.date.slice(0, 6);
    (grouped[ym] ||= []).push(e);
  });
  const months = Object.keys(grouped).sort();

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button
          onClick={() => setShowAll((v) => !v)}
          style={{
            background: "transparent", border: "1px solid #334155", color: "#94a3b8",
            borderRadius: 8, padding: "4px 12px", fontSize: 13, cursor: "pointer",
          }}
        >
          {showAll ? "다가오는 일정만" : "지난 일정도 보기"}
        </button>
      </div>

      {months.length === 0 && (
        <div className="home-empty">다가오는 일정이 없습니다.</div>
      )}

      {months.map((ym) => (
        <div key={ym} style={{ marginBottom: 28 }}>
          {/* 월 헤더 */}
          <div style={{
            display: "flex", alignItems: "baseline", gap: 8,
            paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid #1e293b",
          }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0" }}>
              {+ym.slice(4, 6)}월
            </span>
            <span style={{ fontSize: 13, color: "#64748b" }}>
              {grouped[ym].length}개 일정
            </span>
          </div>

          {/* 일정 목록 */}
          {grouped[ym].map((e, i) => {
            const cat = CAT[categorize(e.name)];
            const wd = weekdayOf(e.date);
            const isToday = e.date === todayStr;
            const dayColor = wd === 0 ? "#f87171" : wd === 6 ? "#60a5fa" : "#94a3b8";

            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "9px 10px", borderRadius: 8,
                background: isToday ? "rgba(96,165,250,0.12)" : "transparent",
              }}>
                {/* 날짜 */}
                <div style={{ width: 52, flexShrink: 0, textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.1 }}>
                    {+e.date.slice(6, 8)}
                  </div>
                  <div style={{ fontSize: 11, color: dayColor }}>{WEEKDAYS[wd]}</div>
                </div>

                {/* 카테고리 점 */}
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: cat.dot, flexShrink: 0,
                }} />

                {/* 행사명 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: cat.color, fontWeight: cat.tag ? 600 : 400 }}>
                    {e.name}
                  </span>
                  {e.content && (
                    <span style={{ color: "#64748b", fontSize: 13 }}> · {e.content}</span>
                  )}
                </div>

                {/* 오늘 배지 */}
                {isToday && (
                  <span style={{
                    fontSize: 11, color: "#60a5fa", fontWeight: 600,
                    border: "1px solid #60a5fa", borderRadius: 6, padding: "1px 6px",
                  }}>오늘</span>
                )}

                {/* 카테고리 태그 (시험/휴일만) */}
                {cat.tag && !isToday && (
                  <span style={{
                    fontSize: 11, color: cat.color, flexShrink: 0,
                    border: `1px solid ${cat.color}`, borderRadius: 6, padding: "1px 6px",
                  }}>{cat.tag}</span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}