import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const DAYS = ["월", "화", "수", "목", "금"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

// 과목별 색상 자동 배정
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

// 학년/반 목록
const GRADES = [1, 2, 3];
const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8];

// 빈 시간표
function emptyTimetable() {
  const t = {};
  DAYS.forEach(d => {
    t[d] = {};
    PERIODS.forEach(p => { t[d][p] = { subject: "", teacher: "" }; });
  });
  return t;
}

export default function Timetable({ user }) {
  const [tab, setTab] = useState("personal"); // "official" | "personal"

  // ── 공식 시간표 ──
  const [grade, setGrade] = useState(1);
  const [cls, setCls] = useState(1);
  const [officialData, setOfficialData] = useState(null);
  const [officialLoading, setOfficialLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingOfficial, setEditingOfficial] = useState(false);
  const [officialDraft, setOfficialDraft] = useState(null);
  const [officialSaving, setOfficialSaving] = useState(false);

  // ── 개인 시간표 ──
  const [personalData, setPersonalData] = useState(emptyTimetable());
  const [personalLoading, setPersonalLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { day, period }
  const [cellDraft, setCellDraft] = useState({ subject: "", teacher: "" });
  const [personalSaving, setPersonalSaving] = useState(false);
  const inputRef = useRef(null);

  // 색상 맵 (렌더링 시 계산)
  const officialColorMap = {};
  const personalColorMap = {};

  // 관리자 체크 (이메일로)
  useEffect(() => {
    // 학번 앞자리가 선생님이거나 특정 계정 → 여기선 이메일로 체크
    // 나중에 Firestore admins 컬렉션으로 관리 가능
    setIsAdmin(user.email === "26027@sshs.hs.kr" || user.email?.includes("teacher"));
  }, [user]);

  // 공식 시간표 로드
  useEffect(() => {
    if (tab !== "official") return;
    const load = async () => {
      setOfficialLoading(true);
      try {
        const ref = doc(db, "timetables", `${grade}-${cls}`);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setOfficialData(snap.data().grid || emptyTimetable());
        } else {
          setOfficialData(emptyTimetable());
        }
      } catch (e) { console.error(e); }
      setOfficialLoading(false);
    };
    load();
  }, [tab, grade, cls]);

  // 개인 시간표 로드
  useEffect(() => {
    if (tab !== "personal") return;
    const load = async () => {
      setPersonalLoading(true);
      try {
        const ref = doc(db, "personal_timetables", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setPersonalData(snap.data().grid || emptyTimetable());
        } else {
          setPersonalData(emptyTimetable());
        }
      } catch (e) { console.error(e); }
      setPersonalLoading(false);
    };
    load();
  }, [tab, user.uid]);

  // 개인 시간표 저장
  const savePersonal = async (newGrid) => {
    setPersonalSaving(true);
    try {
      await setDoc(doc(db, "personal_timetables", user.uid), { grid: newGrid, updatedAt: new Date().toISOString() });
    } catch (e) { console.error(e); }
    setPersonalSaving(false);
  };

  // 공식 시간표 저장
  const saveOfficial = async () => {
    setOfficialSaving(true);
    try {
      await setDoc(doc(db, "timetables", `${grade}-${cls}`), { grid: officialDraft, updatedAt: new Date().toISOString() });
      setOfficialData(officialDraft);
      setEditingOfficial(false);
    } catch (e) { console.error(e); }
    setOfficialSaving(false);
  };

  // 셀 클릭 (개인)
  const handleCellClick = (day, period) => {
    const cell = personalData[day]?.[period] || { subject: "", teacher: "" };
    setEditingCell({ day, period });
    setCellDraft({ subject: cell.subject || "", teacher: cell.teacher || "" });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    const { day, period } = editingCell;
    const newGrid = {
      ...personalData,
      [day]: { ...personalData[day], [period]: { ...cellDraft } }
    };
    setPersonalData(newGrid);
    savePersonal(newGrid);
    setEditingCell(null);
  };

  const handleCellClear = () => {
    if (!editingCell) return;
    const { day, period } = editingCell;
    const newGrid = {
      ...personalData,
      [day]: { ...personalData[day], [period]: { subject: "", teacher: "" } }
    };
    setPersonalData(newGrid);
    savePersonal(newGrid);
    setEditingCell(null);
  };

  // 공식 편집용 셀 변경
  const handleOfficialCellChange = (day, period, field, value) => {
    setOfficialDraft(prev => ({
      ...prev,
      [day]: { ...prev[day], [period]: { ...prev[day][period], [field]: value } }
    }));
  };

  const grid = tab === "official"
    ? (editingOfficial ? officialDraft : officialData)
    : personalData;
  const colorMap = tab === "official" ? officialColorMap : personalColorMap;

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h2 style={s.title}>📅 시간표</h2>
        <p style={s.subtitle}>공식 시간표를 조회하거나 나만의 시간표를 저장하세요.</p>
      </div>

      {/* 탭 */}
      <div style={s.tabs}>
        {[{ id: "personal", label: "내 시간표" }, { id: "official", label: "학교 공식 시간표" }].map(t => (
          <button key={t.id} style={{ ...s.tab, ...(tab === t.id ? s.tabActive : {}) }}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* 공식 시간표 — 학년/반 선택 */}
      {tab === "official" && (
        <div style={s.selectorRow}>
          <div style={s.selectorGroup}>
            <span style={s.selectorLabel}>학년</span>
            <div style={s.btnGroup}>
              {GRADES.map(g => (
                <button key={g} style={{ ...s.selectorBtn, ...(grade === g ? s.selectorBtnActive : {}) }}
                  onClick={() => setGrade(g)}>{g}학년</button>
              ))}
            </div>
          </div>
          <div style={s.selectorGroup}>
            <span style={s.selectorLabel}>반</span>
            <div style={s.btnGroup}>
              {CLASSES.map(c => (
                <button key={c} style={{ ...s.selectorBtn, ...(cls === c ? s.selectorBtnActive : {}) }}
                  onClick={() => setCls(c)}>{c}반</button>
              ))}
            </div>
          </div>
          {isAdmin && (
            <div style={{ marginLeft: "auto" }}>
              {!editingOfficial ? (
                <button style={s.editBtn} onClick={() => { setOfficialDraft(JSON.parse(JSON.stringify(officialData || emptyTimetable()))); setEditingOfficial(true); }}>
                  ✏️ 편집
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={s.cancelBtn} onClick={() => setEditingOfficial(false)}>취소</button>
                  <button style={{ ...s.editBtn, background: "#4ade80", color: "#0f1117" }}
                    onClick={saveOfficial} disabled={officialSaving}>
                    {officialSaving ? "저장 중..." : "✓ 저장"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 개인 시간표 상단 */}
      {tab === "personal" && (
        <div style={s.personalHeader}>
          <span style={s.personalNote}>셀을 클릭해서 과목을 입력하세요. 자동으로 저장됩니다.</span>
          {personalSaving && <span style={s.savingBadge}>저장 중...</span>}
        </div>
      )}

      {/* 시간표 그리드 */}
      {(officialLoading || personalLoading) ? (
        <div style={s.loading}>불러오는 중...</div>
      ) : (
        <div style={s.gridWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.thPeriod}></th>
                {DAYS.map(d => <th key={d} style={s.thDay}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(period => (
                <tr key={period}>
                  <td style={s.tdPeriod}>{period}교시</td>
                  {DAYS.map(day => {
                    const cell = grid?.[day]?.[period] || { subject: "", teacher: "" };
                    const color = getSubjectColor(cell.subject, colorMap);
                    const isEditing = editingCell?.day === day && editingCell?.period === period;

                    if (tab === "official" && editingOfficial) {
                      return (
                        <td key={day} style={s.tdEdit}>
                          <input
                            style={s.cellEditInput}
                            placeholder="과목"
                            value={officialDraft?.[day]?.[period]?.subject || ""}
                            onChange={e => handleOfficialCellChange(day, period, "subject", e.target.value)}
                          />
                          <input
                            style={{ ...s.cellEditInput, fontSize: 10, marginTop: 2, color: "#6b7494" }}
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
                        style={{
                          ...s.td,
                          ...(cell.subject ? { borderLeft: `3px solid ${color}`, background: `${color}10` } : {}),
                          ...(tab === "personal" ? s.tdClickable : {}),
                        }}
                        onClick={tab === "personal" ? () => handleCellClick(day, period) : undefined}
                      >
                        {cell.subject ? (
                          <>
                            <span style={{ ...s.cellSubject, color: color || "#e8eaf2" }}>{cell.subject}</span>
                            {cell.teacher && <span style={s.cellTeacher}>{cell.teacher}</span>}
                          </>
                        ) : (
                          tab === "personal" && <span style={s.cellEmpty}>+</span>
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

      {/* 셀 편집 팝업 (개인) */}
      {editingCell && (
        <div style={s.overlay} onClick={() => setEditingCell(null)}>
          <div style={s.cellModal} onClick={e => e.stopPropagation()}>
            <div style={s.cellModalHeader}>
              <span style={s.cellModalTitle}>
                {editingCell.day}요일 {editingCell.period}교시
              </span>
              <button style={s.closeBtn} onClick={() => setEditingCell(null)}>✕</button>
            </div>
            <div style={s.field}>
              <label style={s.label}>과목명</label>
              <input
                ref={inputRef}
                style={s.input}
                placeholder="예: 수학, 영어, 물리..."
                value={cellDraft.subject}
                onChange={e => setCellDraft(p => ({ ...p, subject: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleCellSave()}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>선생님 <span style={s.optional}>(선택)</span></label>
              <input
                style={s.input}
                placeholder="예: 김철수"
                value={cellDraft.teacher}
                onChange={e => setCellDraft(p => ({ ...p, teacher: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleCellSave()}
              />
            </div>
            <div style={s.btnRow}>
              <button style={s.clearBtn} onClick={handleCellClear}>🗑 지우기</button>
              <button style={s.saveBtn} onClick={handleCellSave}>✓ 저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  container: { maxWidth: 900, margin: "0 auto", padding: "0 0 60px", fontFamily: "'Noto Sans KR', sans-serif" },
  header: { marginBottom: 28 },
  title: { fontSize: 28, fontWeight: 700, color: "#e8eaf2", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#6b7494" },

  tabs: { display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #1e2535" },
  tab: { background: "none", border: "none", color: "#6b7494", fontSize: 14, padding: "10px 16px", cursor: "pointer", borderBottom: "2px solid transparent", fontFamily: "'Noto Sans KR', sans-serif", transition: "color 0.2s" },
  tabActive: { color: "#4f8ef7", borderBottom: "2px solid #4f8ef7", fontWeight: 600 },

  selectorRow: { display: "flex", alignItems: "center", gap: 24, marginBottom: 20, flexWrap: "wrap" },
  selectorGroup: { display: "flex", alignItems: "center", gap: 10 },
  selectorLabel: { fontSize: 13, color: "#6b7494", flexShrink: 0 },
  btnGroup: { display: "flex", gap: 4, flexWrap: "wrap" },
  selectorBtn: { background: "#1a2032", border: "1px solid #1e2535", color: "#6b7494", padding: "5px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "'Noto Sans KR', sans-serif", transition: "all 0.15s" },
  selectorBtnActive: { background: "rgba(79,142,247,0.15)", border: "1px solid #4f8ef7", color: "#4f8ef7" },

  editBtn: { background: "#4f8ef7", border: "none", color: "#fff", padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "'Noto Sans KR', sans-serif" },
  cancelBtn: { background: "#1a2032", border: "1px solid #1e2535", color: "#e8eaf2", padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "'Noto Sans KR', sans-serif" },

  personalHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
  personalNote: { fontSize: 13, color: "#6b7494" },
  savingBadge: { fontSize: 11, color: "#4f8ef7", background: "rgba(79,142,247,0.1)", padding: "3px 10px", borderRadius: 20 },

  loading: { textAlign: "center", color: "#3d4461", padding: "60px 0", fontSize: 14 },

  gridWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 500 },
  thPeriod: { width: 60, padding: "10px 8px", fontSize: 11, color: "#3d4461", textAlign: "center", borderBottom: "1px solid #1e2535" },
  thDay: { padding: "10px 8px", fontSize: 14, fontWeight: 600, color: "#e8eaf2", textAlign: "center", borderBottom: "1px solid #1e2535", width: "calc(100% / 5)" },
  tdPeriod: { padding: "4px 8px", fontSize: 11, color: "#3d4461", textAlign: "center", fontFamily: "monospace", borderBottom: "1px solid #1e253520", verticalAlign: "middle" },
  td: { padding: "8px 10px", borderBottom: "1px solid #1e253520", borderLeft: "3px solid transparent", verticalAlign: "middle", minHeight: 52, height: 52, position: "relative", transition: "background 0.15s" },
  tdClickable: { cursor: "pointer" },
  tdEdit: { padding: "4px 6px", borderBottom: "1px solid #1e253520", verticalAlign: "middle" },
  cellSubject: { display: "block", fontSize: 13, fontWeight: 600, lineHeight: 1.3 },
  cellTeacher: { display: "block", fontSize: 11, color: "#6b7494", marginTop: 2 },
  cellEmpty: { color: "#2a3050", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" },
  cellEditInput: { width: "100%", background: "#0f1117", border: "1px solid #1e2535", borderRadius: 4, padding: "4px 6px", color: "#e8eaf2", fontSize: 12, fontFamily: "'Noto Sans KR', sans-serif", outline: "none", boxSizing: "border-box" },

  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" },
  cellModal: { background: "#161b27", border: "1px solid #1e2535", borderRadius: 14, padding: 24, width: 300 },
  cellModalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  cellModalTitle: { fontSize: 15, fontWeight: 600, color: "#e8eaf2" },
  closeBtn: { background: "none", border: "none", color: "#6b7494", fontSize: 18, cursor: "pointer" },
  field: { marginBottom: 14 },
  label: { display: "block", fontSize: 12, color: "#6b7494", marginBottom: 6 },
  optional: { color: "#3d4461" },
  input: { width: "100%", background: "#0f1117", border: "1px solid #1e2535", borderRadius: 8, padding: "9px 12px", color: "#e8eaf2", fontSize: 14, fontFamily: "'Noto Sans KR', sans-serif", outline: "none", boxSizing: "border-box" },
  btnRow: { display: "flex", gap: 8, marginTop: 4 },
  clearBtn: { flex: 1, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", padding: "9px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "'Noto Sans KR', sans-serif" },
  saveBtn: { flex: 2, background: "#4f8ef7", border: "none", color: "#fff", padding: "9px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "'Noto Sans KR', sans-serif" },
};
