import { useState, useEffect } from "react";
import { auth, fetchWithAuth, refreshSheetsToken } from "./firebase";
import "./Attendance.css";

const SHEET_ID = "1pk3xJdqa2y9xDR2B7LcdvcmwCt-mlE95upEC6mIObwc";
const SHEET_NAME = "학생 신청";

const LOCATIONS_1 = [
  "도서관", "1학년공강실", "2학년공강실", "3학년공강실",
  "지구과학강의실1", "지구과학강의실2", "물리강의실2",
  "외국어강의실1", "외국어강의실2", "외국어강의실3",
  "대회의실", "세미나실1", "세미나실2", "세미나실3", "세미나실4",
  "심층", "특교", "(기타장소)"
];

const LOCATIONS_2 = [
  "자습실", "1학년공강실", "2학년공강실", "3학년공강실",
  "(기숙사)", "(기타장소)"
];

const CAPACITY = {
  "도서관": 25, "1학년공강실": 15, "2학년공강실": 15, "3학년공강실": 15,
  "지구과학강의실1": 15, "지구과학강의실2": 15, "물리강의실2": 15,
  "외국어강의실1": 15, "외국어강의실2": 15, "외국어강의실3": 15,
  "대회의실": 30, "세미나실1": 5, "세미나실2": 5, "세미나실3": 5, "세미나실4": 5,
};

function getReadUrl(sheetName) {
  const encoded = encodeURIComponent(sheetName);
  const token = sessionStorage.getItem("sheets_token");
  return `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encoded}?access_token=${token}`;
}

export default function Attendance() {
  const [tab, setTab] = useState("student");
  const [studentData, setStudentData] = useState([]);
  const [outingData, setOutingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [myRow, setMyRow] = useState(null);
  const [form, setForm] = useState({ loc1: "", loc2: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [currentCounts, setCurrentCounts] = useState({ c1: {}, c2: {} });
  const [filterGrade, setFilterGrade] = useState("");
  const [filterClass, setFilterClass] = useState("");

  const studentId = auth.currentUser?.displayName?.match(/^[0-9]+/)?.[0] || "";

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = sessionStorage.getItem("sheets_token");
      if (!token) {
        setError("시트 접근 권한이 없어요. 로그아웃 후 다시 로그인해주세요.");
        setLoading(false);
        return;
      }

      const sRes = await fetchWithAuth(getReadUrl("학생 신청"));
      if (!sRes.ok) throw new Error("시트를 불러올 수 없어요.");
      const sJson = await sRes.json();
      const values = sJson.values || [];
      setStudentData(values);

      const counts1 = {};
      const counts2 = {};
      values.slice(2).forEach((row) => {
        const loc1 = row[2];
        const loc2 = row[5];
        if (loc1) counts1[loc1] = (counts1[loc1] || 0) + 1;
        if (loc2) counts2[loc2] = (counts2[loc2] || 0) + 1;
      });
      setCurrentCounts({ c1: counts1, c2: counts2 });

      const rowIndex = values.findIndex((row) => row[0] === studentId);
      if (rowIndex !== -1) {
        setMyRow({ index: rowIndex, data: values[rowIndex] });
        setForm({ loc1: values[rowIndex][2] || "", loc2: values[rowIndex][5] || "" });
      }
      const oRes = await fetchWithAuth(getReadUrl("외출 신청"));
      const oJson = await oRes.json();
      setOutingData(oJson.values || []);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async () => {
    if (!form.loc1 && !form.loc2) { setSubmitMsg("장소를 하나 이상 선택해줘!"); return; }
    if (!myRow) { setSubmitMsg("내 학번을 시트에서 찾을 수 없어요."); return; }
    setSubmitting(true);
    setSubmitMsg("");
    const token = sessionStorage.getItem("sheets_token");
    const sheetRow = myRow.index + 1;
    try {
      const requests = [];
      if (form.loc1) requests.push(fetchWithAuth(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!C${sheetRow}?valueInputOption=USER_ENTERED&access_token=${token}`,
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: [[form.loc1]] }) }
      ));
      if (form.loc2) requests.push(fetchWithAuth(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!F${sheetRow}?valueInputOption=USER_ENTERED&access_token=${token}`,
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: [[form.loc2]] }) }
      ));
      const results = await Promise.all(requests);
      if (results.every((r) => r.ok)) {
        setSubmitMsg("✅ 신청 완료!");
        setShowModal(false);
        fetchData();
      } else {
        setSubmitMsg("❌ 오류가 발생했어요. 다시 시도해줘.");
      }
    } catch (e) {
      setSubmitMsg("❌ " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="attendance-wrap">
      <div className="attendance-header">
        <h2 className="attendance-title">📋 이석/외출 현황</h2>
        <div className="attendance-meta">
          {lastUpdated && <span className="last-updated">마지막 업데이트: {lastUpdated.toLocaleTimeString("ko-KR")}</span>}
          <button className="refresh-btn" onClick={fetchData}>↻ 새로고침</button>
          <button className="apply-btn" onClick={() => setShowModal(true)}>✏️ 이석 신청</button>
        </div>
      </div>

      <div className="tab-bar">
        <button className={`tab-btn ${tab === "student" ? "active" : ""}`} onClick={() => setTab("student")}>🏃 창의연구활동 이석</button>
        <button className={`tab-btn ${tab === "outing" ? "active" : ""}`} onClick={() => setTab("outing")}>🚪 외출 신청</button>
      </div>

      {tab === "student" && (
        <div className="filter-bar">
          <select className="filter-select" value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setFilterClass(""); }}>
            <option value="">전체 학년</option>
            <option value="1">1학년</option>
            <option value="2">2학년</option>
            <option value="3">3학년</option>
          </select>
          <select className="filter-select" value={filterClass} onChange={(e) => setFilterClass(e.target.value)} disabled={!filterGrade}>
            <option value="">전체 반</option>
            {filterGrade && ["1","2","3","4","5","6","7","8"].map((c) => (
              <option key={c} value={c}>{c}반</option>
            ))}
          </select>
        </div>
      )}

      <input className="search-input" placeholder="이름 또는 학번으로 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {loading && <div className="loading">불러오는 중...</div>}
      {error && <div className="error-box">⚠️ {error}</div>}
      {!loading && !error && tab === "student" && (
        <StudentTable data={studentData} search={search} myId={studentId} filterGrade={filterGrade} filterClass={filterClass} />
      )}
      {!loading && !error && tab === "outing" && <OutingTable data={outingData} search={search} />}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">✏️ 이석 신청</h3>
            <p className="modal-sub">학번 {studentId} — 오늘 창의연구활동 장소 선택</p>
            <div className="modal-section">
              <label className="modal-label">창의1교시 (19:00~20:50)</label>
              <div className="location-grid">
                {LOCATIONS_1.map((loc) => {
                  const count = currentCounts.c1[loc] || 0;
                  const cap = CAPACITY[loc];
                  const full = cap && count >= cap;
                  return (
                    <button key={loc} className={`loc-btn ${form.loc1 === loc ? "selected" : ""} ${full ? "full" : ""}`}
                      onClick={() => !full && setForm((f) => ({ ...f, loc1: loc }))} disabled={full} title={cap ? `${count}/${cap}명` : ""}>
                      {loc}{cap && <span className="loc-count"> {count}/{cap}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="modal-section">
              <label className="modal-label">창의2교시 (21:30~23:00)</label>
              <div className="location-grid">
                {LOCATIONS_2.map((loc) => {
                  const count = currentCounts.c2[loc] || 0;
                  const cap = CAPACITY[loc];
                  const full = cap && count >= cap;
                  return (
                    <button key={loc} className={`loc-btn ${form.loc2 === loc ? "selected" : ""} ${full ? "full" : ""}`}
                      onClick={() => !full && setForm((f) => ({ ...f, loc2: loc }))} disabled={full} title={cap ? `${count}/${cap}명` : ""}>
                      {loc}{cap && <span className="loc-count"> {count}/{cap}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            {submitMsg && <p className="submit-msg">{submitMsg}</p>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowModal(false)}>취소</button>
              <button className="modal-confirm" onClick={handleSubmit} disabled={submitting}>{submitting ? "신청 중..." : "신청하기"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentTable({ data, search, myId, filterGrade, filterClass }) {
  if (!data.length) return <div className="empty">데이터가 없습니다.</div>;

  const allRows = data.slice(2).filter((row) => {
    if (!row[0] && !row[1]) return false;
    if (filterGrade && row[0]?.[0] !== filterGrade) return false;
    if (filterClass && row[0]?.[1] !== filterClass) return false;
    return true;
  });

  const myRows = allRows.filter((row) => row[0] === myId);

  const filtered = allRows.filter((row) => {
    if (!search) return true;
    return (row[0] || "").includes(search) || (row[1] || "").includes(search);
  });

  const groups = {};
  filtered.forEach((row) => {
    const id = row[0] || "";
    const grade = id[0];
    const cls = id[1];
    const key = `${grade}학년 ${cls}반`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });

  const renderRow = (row, i) => (
    <tr key={i} className={`${i % 2 === 0 ? "even" : ""} ${row[0] === myId ? "my-row" : ""}`}>
      <td className="mono">{row[0] || ""}</td>
      <td className="bold">{row[1] || ""}</td>
      <td>{row[2] || "-"}</td>
      <td className={getResultClass(row[4])}>{row[4] || "-"}</td>
      <td>{row[5] || "-"}</td>
      <td className={getResultClass(row[7])}>{row[7] || "-"}</td>
    </tr>
  );

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr><th>학번</th><th>이름</th><th>창의1 장소</th><th>창의1 결과</th><th>창의2 장소</th><th>창의2 결과</th></tr>
        </thead>
        <tbody>
          {!search && myRows.length > 0 && (
            <>
              <tr className="group-header"><td colSpan={6}>⭐ 내 항목</td></tr>
              {myRows.map((row, i) => renderRow(row, i))}
              <tr className="group-divider"><td colSpan={6}></td></tr>
            </>
          )}
          {Object.entries(groups).map(([groupName, rows]) => (
            <>
              <tr key={groupName} className="group-header"><td colSpan={6}>{groupName}</td></tr>
              {rows.map((row, i) => renderRow(row, i))}
            </>
          ))}
        </tbody>
      </table>
      <div className="row-count">총 {filtered.length}명</div>
    </div>
  );
}

function OutingTable({ data, search }) {
  if (!data.length) return <div className="empty">데이터가 없습니다.</div>;
  const rows = data.slice(4).filter((row) => {
    if (!row[1] && !row[2]) return false;
    if (!search) return true;
    return (row[1] || "").includes(search) || (row[2] || "").includes(search);
  });
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr><th>#</th><th>학번</th><th>이름</th><th>신청일</th><th>나가는 시각</th><th>들어오는 시각</th><th>총외출시간</th><th>교사 승인</th></tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "even" : ""}>
              <td className="mono">{row[0] || i + 1}</td>
              <td className="mono">{row[1] || ""}</td>
              <td className="bold">{row[2] || ""}</td>
              <td>{row[3] || ""}</td>
              <td>{row[4] || "-"}</td>
              <td>{row[5] || "-"}</td>
              <td>{row[6] || "-"}</td>
              <td className={row[7] === "허가" ? "approved" : "pending"}>{row[7] || "대기"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row-count">총 {rows.length}건</div>
    </div>
  );
}

function getResultClass(val) {
  if (!val) return "";
  if (val.includes("자습실") || val.includes("도서관")) return "result-normal";
  if (val === "퇴사") return "result-absent";
  return "result-special";
}