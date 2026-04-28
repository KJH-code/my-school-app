import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import "./Timetable.css";

const DAYS = ["월", "화", "수", "목", "금"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

const COLORS = [
  "#4f8ef7", "#f97316", "#4ade80", "#f43f5e", "#a78bfa",
  "#facc15", "#34d399", "#fb7185", "#60a5fa", "#c084fc",
  "#fbbf24", "#2dd4bf", "#f472b6", "#818cf8", "#86efac",
];
function getSubjectColor(name, colorMap) {
  if (!name) return null;
  if (colorMap[name]) return colorMap[name];
  const idx = Object.keys(colorMap).length % COLORS.length;
  colorMap[name] = COLORS[idx];
  return colorMap[name];
}

const GRADES = [1, 2, 3];
const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8];

function emptyTimetable() {
  const t = {};
  DAYS.forEach(d => {
    t[d] = {};
    PERIODS.forEach(p => { t[d][p] = { subject: "", teacher: "" }; });
  });
  return t;
}

export default function Timetable({ user }) {
  const [tab, setTab] = useState("personal");
  const [grade, setGrade] = useState(1);
  const [cls, setCls] = useState(1);
  const [officialData, setOfficialData] = useState(null);
  const [officialLoading, setOfficialLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingOfficial, setEditingOfficial] = useState(false);
  const [officialDraft, setOfficialDraft] = useState(null);
  const [officialSaving, setOfficialSaving] = useState(false);

  const [personalData, setPersonalData] = useState(emptyTimetable());
  const [personalLoading, setPersonalLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [cellDraft, setCellDraft] = useState({ subject: "", teacher: "" });
  const [personalSaving, setPersonalSaving] = useState(false);
  const inputRef = useRef(null);

  const officialColorMap = {};
  const personalColorMap = {};

  useEffect(() => {
    setIsAdmin(user.email === "26027@sshs.hs.kr" || user.email?.includes("teacher"));
  }, [user]);

  useEffect(() => {
    if (tab !== "official") return;
    const load = async () => {
      setOfficialLoading(true);
      try {
        const ref = doc(db, "timetables", `${grade}-${cls}`);
        const snap = await getDoc(ref);
        if (snap.exists()) setOfficialData(snap.data().grid || emptyTimetable());
        else setOfficialData(emptyTimetable());
      } catch (e) { console.error(e); }
      setOfficialLoading(false);
    };
    load();
  }, [tab, grade, cls]);

  useEffect(() => {
    if (tab !== "personal") return;
    const load = async () => {
      setPersonalLoading(true);
      try {
        const ref = doc(db, "personal_timetables", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) setPersonalData(snap.data().grid || emptyTimetable());
        else setPersonalData(emptyTimetable());
      } catch (e) { console.error(e); }
      setPersonalLoading(false);
    };
    load();
  }, [tab, user.uid]);

  const savePersonal = async (newGrid) => {
    setPersonalSaving(true);
    try {
      await setDoc(doc(db, "personal_timetables", user.uid), { grid: newGrid, updatedAt: new Date().toISOString() });
    } catch (e) { console.error(e); }
    setPersonalSaving(false);
  };

  const saveOfficial = async () => {
    setOfficialSaving(true);
    try {
      await setDoc(doc(db, "timetables", `${grade}-${cls}`), { grid: officialDraft, updatedAt: new Date().toISOString() });
      setOfficialData(officialDraft);
      setEditingOfficial(false);
    } catch (e) { console.error(e); }
    setOfficialSaving(false);
  };

  const handleCellClick = (day, period) => {
    const cell = personalData[day]?.[period] || { subject: "", teacher: "" };
    setEditingCell({ day, period });
    setCellDraft({ subject: cell.subject || "", teacher: cell.teacher || "" });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    const { day, period } = editingCell;
    const newGrid = { ...personalData, [day]: { ...personalData[day], [period]: { ...cellDraft } } };
    setPersonalData(newGrid);
    savePersonal(newGrid);
    setEditingCell(null);
  };

  const handleCellClear = () => {
    if (!editingCell) return;
    const { day, period } = editingCell;
    const newGrid = { ...personalData, [day]: { ...personalData[day], [period]: { subject: "", teacher: "" } } };
    setPersonalData(newGrid);
    savePersonal(newGrid);
    setEditingCell(null);
  };

  const handleOfficialCellChange = (day, period, field, value) => {
    setOfficialDraft(prev => ({
      ...prev,
      [day]: { ...prev[day], [period]: { ...prev[day][period], [field]: value } }
    }));
  };

  const grid = tab === "official" ? (editingOfficial ? officialDraft : officialData) : personalData;
  const colorMap = tab === "official" ? officialColorMap : personalColorMap;

  return (
    <div className="tt-container">
      <div className="tt-header">
        <h2 className="tt-title">📅 시간표</h2>
        <p className="tt-subtitle">공식 시간표를 조회하거나 나만의 시간표를 저장하세요.</p>
      </div>

      <div className="tt-tabs">
        {[{ id: "personal", label: "내 시간표" }, { id: "official", label: "학교 공식 시간표" }].map(t => (
          <button key={t.id} className={`tt-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === "official" && (
        <div className="tt-selector-row">
          <div className="tt-selector-group">
            <span className="tt-selector-label">학년</span>
            <div className="tt-btn-group">
              {GRADES.map(g => (
                <button key={g} className={`tt-selector-btn ${grade === g ? "active" : ""}`} onClick={() => setGrade(g)}>{g}학년</button>
              ))}
            </div>
          </div>
          <div className="tt-selector-group">
            <span className="tt-selector-label">반</span>
            <div className="tt-btn-group">
              {CLASSES.map(c => (
                <button key={c} className={`tt-selector-btn ${cls === c ? "active" : ""}`} onClick={() => setCls(c)}>{c}반</button>
              ))}
            </div>
          </div>
          {isAdmin && (
            <div style={{ marginLeft: "auto" }}>
              {!editingOfficial ? (
                <button className="tt-edit-btn" onClick={() => { setOfficialDraft(JSON.parse(JSON.stringify(officialData || emptyTimetable()))); setEditingOfficial(true); }}>
                  ✏️ 편집
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="tt-cancel-btn" onClick={() => setEditingOfficial(false)}>취소</button>
                  <button className="tt-save-btn-green" onClick={saveOfficial} disabled={officialSaving}>
                    {officialSaving ? "저장 중..." : "✓ 저장"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "personal" && (
        <div className="tt-personal-header">
          <span className="tt-personal-note">셀을 클릭해서 과목을 입력하세요. 자동으로 저장됩니다.</span>
          {personalSaving && <span className="tt-saving-badge">저장 중...</span>}
        </div>
      )}

      {(officialLoading || personalLoading) ? (
        <div className="tt-loading">불러오는 중...</div>
      ) : (
        <div className="tt-grid-wrap">
          <table className="tt-table">
            <thead>
              <tr>
                <th className="tt-th-period"></th>
                {DAYS.map(d => <th key={d} className="tt-th-day">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(period => (
                <tr key={period}>
                  <td className="tt-td-period">{period}교시</td>
                  {DAYS.map(day => {
                    const cell = grid?.[day]?.[period] || { subject: "", teacher: "" };
                    const color = getSubjectColor(cell.subject, colorMap);

                    if (tab === "official" && editingOfficial) {
                      return (
                        <td key={day} className="tt-td-edit">
                          <input
                            className="tt-cell-edit-input"
                            placeholder="과목"
                            value={officialDraft?.[day]?.[period]?.subject || ""}
                            onChange={e => handleOfficialCellChange(day, period, "subject", e.target.value)}
                          />
                          <input
                            className="tt-cell-edit-input tt-cell-edit-input-sm"
                            placeholder="선생님"
                            value={officialDraft?.[day]?.[period]?.teacher || ""}
                            onChange={e => handleOfficialCellChange(day, period, "teacher", e.target.value)}
                          />
                        </td>
                      );
                    }

                    return (
                      <td
                        key={day}
                        className={`tt-td ${tab === "personal" ? "clickable" : ""}`}
                        style={cell.subject ? { borderLeft: `3px solid ${color}`, background: `${color}15` } : {}}
                        onClick={tab === "personal" ? () => handleCellClick(day, period) : undefined}
                      >
                        {cell.subject ? (
                          <>
                            <span className="tt-cell-subject" style={{ color }}>{cell.subject}</span>
                            {cell.teacher && <span className="tt-cell-teacher">{cell.teacher}</span>}
                          </>
                        ) : (
                          tab === "personal" && <span className="tt-cell-empty">+</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingCell && (
        <div className="tt-overlay" onClick={() => setEditingCell(null)}>
          <div className="tt-cell-modal" onClick={e => e.stopPropagation()}>
            <div className="tt-cell-modal-header">
              <span className="tt-cell-modal-title">{editingCell.day}요일 {editingCell.period}교시</span>
              <button className="tt-close-btn" onClick={() => setEditingCell(null)}>✕</button>
            </div>
            <div className="tt-field">
              <label className="tt-field-label">과목명</label>
              <input
                ref={inputRef}
                className="tt-field-input"
                placeholder="예: 수학, 영어, 물리..."
                value={cellDraft.subject}
                onChange={e => setCellDraft(p => ({ ...p, subject: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleCellSave()}
              />
            </div>
            <div className="tt-field">
              <label className="tt-field-label">선생님 <span className="tt-optional">(선택)</span></label>
              <input
                className="tt-field-input"
                placeholder="예: 김철수"
                value={cellDraft.teacher}
                onChange={e => setCellDraft(p => ({ ...p, teacher: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleCellSave()}
              />
            </div>
            <div className="tt-btn-row">
              <button className="tt-clear-btn" onClick={handleCellClear}>🗑 지우기</button>
              <button className="tt-save-btn" onClick={handleCellSave}>✓ 저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}