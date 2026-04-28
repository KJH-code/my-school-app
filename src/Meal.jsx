import { useState, useEffect } from "react";
import "./Meal.css";
const API_KEY = "b239e5a1b3ec421dbad518ed199277bb";
const OFFICE_CODE = "B10";
const SCHOOL_CODE = "7010084";

function getDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const DAY_LABELS = ["월", "화", "수", "목", "금"];
const MEAL_LABELS = { "1": "조식", "2": "중식", "3": "석식" };

export default function Meal() {
  const [meals, setMeals] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  const weekDates = getWeekDates();
  const today = getDateStr();

  useEffect(() => {
    const todayIdx = weekDates.findIndex((d) => getDateStr(d) === today);
    setSelectedDay(todayIdx >= 0 ? todayIdx : 0);
    fetchMeals();
  }, []);

  const fetchMeals = async () => {
    setLoading(true);
    setError(null);
    try {
      const from = getDateStr(weekDates[0]);
      const to = getDateStr(weekDates[4]);
      const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${OFFICE_CODE}&SD_SCHUL_CODE=${SCHOOL_CODE}&MLSV_FROM_YMD=${from}&MLSV_TO_YMD=${to}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.mealServiceDietInfo) {
        const rows = data.mealServiceDietInfo[1].row;
        const parsed = {};
        rows.forEach((row) => {
          const date = row.MLSV_YMD;
          const type = row.MMEAL_SC_CODE;
          if (!parsed[date]) parsed[date] = {};
          parsed[date][type] = row.DDISH_NM
            .split("<br/>")
            .map((item) => item.replace(/\s*\(.*?\)/g, "").trim())
            .filter(Boolean);
        });
        setMeals(parsed);
      } else {
        setMeals({});
      }
    } catch (e) {
      setError("급식 정보를 불러올 수 없어요.");
    } finally {
      setLoading(false);
    }
  };

  const selectedDate = weekDates[selectedDay ?? 0];
  const selectedDateStr = selectedDate ? getDateStr(selectedDate) : "";
  const selectedMeals = meals[selectedDateStr] || {};
  const isToday = selectedDateStr === today;

  return (
    <div className="meal-wrap">
      <div className="meal-header">
        <h2 className="meal-title">🍱 급식표</h2>
        <button className="refresh-btn" onClick={fetchMeals}>↻ 새로고침</button>
      </div>

      {/* 요일 탭 */}
      <div className="meal-day-tabs">
        {weekDates.map((date, i) => (
          <button
            key={i}
            className={`meal-day-btn ${selectedDay === i ? "active" : ""} ${getDateStr(date) === today ? "today" : ""}`}
            onClick={() => setSelectedDay(i)}
          >
            <span className="meal-day-label">{DAY_LABELS[i]}</span>
            <span className="meal-date-label">{date.getMonth() + 1}/{date.getDate()}</span>
          </button>
        ))}
      </div>

      {loading && <div className="loading">불러오는 중...</div>}
      {error && <div className="error-box">⚠️ {error}</div>}

      {!loading && !error && (
        <div className="meal-content">
          {isToday && <div className="today-badge">📅 오늘</div>}
          {Object.keys(MEAL_LABELS).map((type) => (
            selectedMeals[type] ? (
              <div key={type} className="meal-card">
                <div className="meal-type">{MEAL_LABELS[type]}</div>
                <ul className="meal-list">
                  {selectedMeals[type].map((item, i) => (
                    <li key={i} className="meal-item">{item}</li>
                  ))}
                </ul>
              </div>
            ) : null
          ))}
          {Object.keys(selectedMeals).length === 0 && (
            <div className="empty">급식 정보가 없어요.</div>
          )}
        </div>
      )}
    </div>
  );
}