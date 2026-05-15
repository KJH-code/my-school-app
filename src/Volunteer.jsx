import { useState, useEffect } from "react";
import "./Volunteer.css";
import { auth } from "./firebase";
import { readSheet, writeSheet } from "./lib/api";

const SHEET_ID = "18HD1FjfHoNiR6rxgmDPc3wJF-8a6Fs2lFCLYsYWrWe4";
const SHEET_NAME = "입력시트";

export default function Volunteer() {
  const studentName = auth.currentUser?.displayName?.replace(/^[0-9]+/, "") || "";
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [form, setForm] = useState({ phone: "", date: "", time: "" });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [lastUpdated, setLastUpdated] = useState(null);

  const studentId = auth.currentUser?.displayName?.match(/^[0-9]+/)?.[0] || "";

  const handleSubmit = async () => {
    if (!form.phone || !form.date || !form.time) {
      setSubmitMsg("모든 필드를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setSubmitMsg("");
    try {
      // "4/27" 형식으로 변환
      const dateObj = new Date(form.date);
      const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

      // C~G 컬럼에 append (시트가 알아서 빈 행 찾음)
      await writeSheet({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!C:G`,
        values: [[studentId, studentName, form.phone, dateStr, form.time]],
        mode: "append",
      });

      setSubmitMsg("✅ 신청 완료!");
      setTimeout(() => {
        setShowModal(false);
        setSubmitMsg("");
        setForm({ phone: "", date: "", time: "" });
        fetchData();
      }, 1000);
    } catch (e) {
      setSubmitMsg("❌ " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await readSheet(SHEET_ID, SHEET_NAME);
      setData(json.values || []);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleVisibility = () => {
      if (!document.hidden) fetchData();
    };
    window.addEventListener("focus", fetchData);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", fetchData);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // 행 데이터: A=연번, C=학번, D=이름, E=연락처, F=희망일, G=희망시간대, H=집합장소, I=지도교사, J=봉사내용, K=완료확인
  // 데이터는 5행(인덱스 4)부터
  const allRows = (() => {
    const all = data.slice(4).filter((row) => row[2] || row[3]);

    const todayObj = new Date();
    const todayMD = `${todayObj.getMonth() + 1}/${todayObj.getDate()}`;

    const todayIdx = all.findIndex((row) => row[5] === todayMD);
    const sliced = todayIdx >= 0 ? all.slice(todayIdx) : all;

    const parseDate = (str) => {
      if (!str) return new Date(9999, 0, 1);
      const fullMatch = str.match(/(\d{4})\.\s*(\d+)\.\s*(\d+)/);
      if (fullMatch) return new Date(parseInt(fullMatch[1]), parseInt(fullMatch[2]) - 1, parseInt(fullMatch[3]));
      const shortMatch = str.match(/(\d+)\/(\d+)/);
      if (shortMatch) return new Date(todayObj.getFullYear(), parseInt(shortMatch[1]) - 1, parseInt(shortMatch[2]));
      return new Date(9999, 0, 1);
    };

    return [...sliced].sort((a, b) => parseDate(a[5]) - parseDate(b[5]));
  })();
  const myRows = allRows.filter((row) => row[2] === studentId);

  const dateOptions = [...new Set(allRows.map((r) => r[5]).filter(Boolean))].sort();

  const filtered = allRows.filter((row) => {
    if (search && !(row[2] || "").includes(search) && !(row[3] || "").includes(search)) return false;
    if (filterDate && row[5] !== filterDate) return false;
    if (filterStatus === "completed" && row[10] !== "완료") return false;
    if (filterStatus === "pending" && row[10] === "완료") return false;
    if (filterStatus === "assigned" && !row[7]) return false;
    if (filterStatus === "unassigned" && row[7]) return false;
    return true;
  });

  const renderRow = (row, i) => (
    <tr key={i} className={`${i % 2 === 0 ? "even" : ""} ${row[2] === studentId ? "my-row" : ""}`}>
      <td className="mono">{row[0] || ""}</td>
      <td className="mono">{row[2] || ""}</td>
      <td className="bold">{row[3] || ""}</td>
      <td>{row[5] || ""}</td>
      <td>{row[6] || ""}</td>
      <td>{row[7] || <span className="empty-cell">미배정</span>}</td>
      <td>{row[8] || "-"}</td>
      <td>{row[9] || "-"}</td>
      <td className={row[10] === "완료" ? "completed" : "pending"}>{row[10] || "대기"}</td>
    </tr>
  );

  return (
    <div className="vol-wrap">
      <div className="vol-header">
        <h2 className="vol-title">🌱 벌점 경감 봉사</h2>
        <div className="vol-meta">
          {lastUpdated && <span className="last-updated">마지막 업데이트: {lastUpdated.toLocaleTimeString("ko-KR")}</span>}
          <button className="refresh-btn" onClick={fetchData}>↻ 새로고침</button>
          <button className="apply-btn" onClick={() => setShowModal(true)}>✏️ 봉사 신청</button>
        </div>
      </div>

      <p className="vol-notice">
        💡 <strong>벌점 경감 봉사 신청은 시트에서 직접 해주세요.</strong> 여기서는 신청 현황과 배정 결과를 확인할 수 있어요.
        {" "}
        <a href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`} target="_blank" rel="noreferrer" className="vol-link">
          시트로 가기 →
        </a>
      </p>

      <div className="vol-filter-bar">
        <select className="filter-select" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}>
          <option value="">전체 날짜</option>
          {dateOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">전체 상태</option>
          <option value="assigned">배정됨</option>
          <option value="unassigned">배정 대기</option>
          <option value="completed">완료</option>
          <option value="pending">미완료</option>
        </select>
      </div>

      <input
        className="search-input"
        placeholder="이름 또는 학번으로 검색..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading && <div className="loading">불러오는 중...</div>}
      {error && <div className="error-box">⚠️ {error}</div>}

      {!loading && !error && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>학번</th>
                <th>이름</th>
                <th>희망일</th>
                <th>희망시간</th>
                <th>집합장소</th>
                <th>지도교사</th>
                <th>봉사내용</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {!search && myRows.length > 0 && (
                <>
                  <tr className="group-header"><td colSpan={9}>⭐ 내 신청 ({myRows.length}건)</td></tr>
                  {myRows.map((row, i) => renderRow(row, i))}
                  <tr className="group-divider"><td colSpan={9}></td></tr>
                </>
              )}
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="empty">신청 내역이 없어요.</td></tr>
              ) : (
                filtered.map((row, i) => renderRow(row, i + 1000))
              )}
            </tbody>
          </table>
          <div className="row-count">총 {filtered.length}건</div>
        </div>
      )}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-title">✏️ 봉사 신청</h3>
              <p className="modal-sub">학번 {studentId} · {studentName}</p>

              <div className="modal-section">
                <label className="modal-label">연락처</label>
                <input
                  className="vol-input"
                  placeholder="010-0000-0000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div className="modal-section">
                <label className="modal-label">희망일</label>
                <input
                  className="vol-input"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>

              <div className="modal-section">
                <label className="modal-label">희망시간</label>
                <select
                  className="vol-input"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                >
                  <option value="">선택</option>
                  <option value="아침조회전(7:15~7:45)">아침조회전(7:15~7:45)</option>
                  <option value="점심시간1(12:25~12:55)">점심시간1(12:25~12:55)</option>
                  <option value="점심시간2(12:45~13:15)">점심시간2(12:45~13:15)</option>
                  <option value="자유시간(16:35~17:05)">자유시간(16:35~17:05)</option>
                  <option value="자유시간(16:30~19:00 중 30분)">자유시간(16:30~19:00 중 30분)</option>
                </select>
              </div>

              {submitMsg && <p className="submit-msg">{submitMsg}</p>}
              <div className="modal-actions">
                <button className="modal-cancel" onClick={() => setShowModal(false)}>취소</button>
                <button className="modal-confirm" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "신청 중..." : "신청하기"}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}