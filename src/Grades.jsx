import { useState } from "react";

const GRADE_CUTOFFS = [
  { grade: "A+", min: 95 },
  { grade: "A",  min: 90 },
  { grade: "A-", min: 85 },
  { grade: "B+", min: 80 },
  { grade: "B",  min: 75 },
  { grade: "B-", min: 70 },
  { grade: "C+", min: 65 },
  { grade: "C",  min: 60 },
  { grade: "C-", min: 55 },
  { grade: "D+", min: 50 },
  { grade: "D",  min: 45 },
  { grade: "D-", min: 40 },
  { grade: "F",  min: 0  },
];

function getGrade(score) {
  for (const { grade, min } of GRADE_CUTOFFS) {
    if (score >= min) return grade;
  }
  return "F";
}

function getGradeColor(grade) {
  if (grade.startsWith("A")) return "#4ade80";
  if (grade.startsWith("B")) return "#60a5fa";
  if (grade.startsWith("C")) return "#fbbf24";
  if (grade.startsWith("D")) return "#f97316";
  return "#ef4444";
}

let subjectIdCounter = 0;
let perfIdCounter = 0;

function createSubject() {
  return {
    id: ++subjectIdCounter,
    name: "",
    midterm: { score: "", weight: 30 },
    final: { score: "", weight: 30 },
    performances: [{ id: ++perfIdCounter, name: "수행1", score: "", weight: 40 }],
  };
}

function calcSubjectScore(subject) {
  const totalWeight =
    Number(subject.midterm.weight) +
    Number(subject.final.weight) +
    subject.performances.reduce((s, p) => s + Number(p.weight || 0), 0);

  if (totalWeight === 0) return null;

  let score = 0;
  let usedWeight = 0;

  // 중간/기말: 100점 만점 × 비율/100
  // 수행평가: 비율이 곧 만점 → 점수를 그대로 합산
  if (subject.midterm.score !== "") {
    score += (Number(subject.midterm.score) * Number(subject.midterm.weight)) / 100;
    usedWeight += Number(subject.midterm.weight);
  }
  if (subject.final.score !== "") {
    score += (Number(subject.final.score) * Number(subject.final.weight)) / 100;
    usedWeight += Number(subject.final.weight);
  }
  subject.performances.forEach((p) => {
    if (p.score !== "") {
      // 수행: 비율(=만점) 중 실제 획득 점수를 그대로 더함
      score += Number(p.score);
      usedWeight += Number(p.weight);
    }
  });

  if (usedWeight === 0) return null;
  return { score: parseFloat(score.toFixed(2)), totalWeight, usedWeight };
}

export default function Grades() {
  const [subjects, setSubjects] = useState([createSubject()]);

  const updateSubject = (id, updater) => {
    setSubjects((prev) => prev.map((s) => (s.id === id ? updater(s) : s)));
  };

  const addSubject = () => setSubjects((prev) => [...prev, createSubject()]);
  const removeSubject = (id) => setSubjects((prev) => prev.filter((s) => s.id !== id));

  const addPerformance = (subjectId) => {
    updateSubject(subjectId, (s) => ({
      ...s,
      performances: [
        ...s.performances,
        { id: ++perfIdCounter, name: `수행${s.performances.length + 1}`, score: "", weight: 0 },
      ],
    }));
  };

  const removePerformance = (subjectId, perfId) => {
    updateSubject(subjectId, (s) => ({
      ...s,
      performances: s.performances.filter((p) => p.id !== perfId),
    }));
  };

  const updatePerf = (subjectId, perfId, field, value) => {
    updateSubject(subjectId, (s) => ({
      ...s,
      performances: s.performances.map((p) =>
        p.id === perfId ? { ...p, [field]: value } : p
      ),
    }));
  };

  // 전체 평균
  const allScores = subjects
    .map((s) => calcSubjectScore(s))
    .filter((r) => r !== null)
    .map((r) => r.score);
  const overallAvg =
    allScores.length > 0
      ? parseFloat((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2))
      : null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>성적 계산기</h2>
        <p style={styles.subtitle}>과목별 중간·기말·수행평가를 입력하면 최종 점수와 등급을 계산해줘요.</p>
      </div>

      {/* 전체 평균 카드 */}
      {overallAvg !== null && (
        <div style={styles.overallCard}>
          <span style={styles.overallLabel}>전체 평균</span>
          <span style={{ ...styles.overallScore, color: getGradeColor(getGrade(overallAvg)) }}>
            {overallAvg}
          </span>
          <span style={{ ...styles.overallGrade, color: getGradeColor(getGrade(overallAvg)) }}>
            {getGrade(overallAvg)}
          </span>
        </div>
      )}

      <div style={styles.subjectList}>
        {subjects.map((subject) => {
          const result = calcSubjectScore(subject);
          const weightSum =
            Number(subject.midterm.weight) +
            Number(subject.final.weight) +
            subject.performances.reduce((s, p) => s + Number(p.weight || 0), 0);
          const weightOk = weightSum === 100;

          return (
            <div key={subject.id} style={styles.card}>
              {/* 과목 헤더 */}
              <div style={styles.cardHeader}>
                <input
                  style={styles.subjectNameInput}
                  placeholder="과목명 (예: 수학)"
                  value={subject.name}
                  onChange={(e) =>
                    updateSubject(subject.id, (s) => ({ ...s, name: e.target.value }))
                  }
                />
                <div style={styles.resultBadge}>
                  {result ? (
                    <>
                      <span style={{ ...styles.resultScore, color: getGradeColor(getGrade(result.score)) }}>
                        {result.score}점
                      </span>
                      <span style={{ ...styles.resultGradeBadge, background: getGradeColor(getGrade(result.score)) + "22", color: getGradeColor(getGrade(result.score)) }}>
                        {getGrade(result.score)}
                      </span>
                    </>
                  ) : (
                    <span style={styles.resultEmpty}>점수 입력 전</span>
                  )}
                </div>
                {subjects.length > 1 && (
                  <button style={styles.removeBtn} onClick={() => removeSubject(subject.id)}>✕</button>
                )}
              </div>

              {/* 비율 합계 경고 */}
              {!weightOk && (
                <div style={styles.weightWarning}>
                  ⚠️ 비율 합계: {weightSum}% (100%가 되어야 해요)
                </div>
              )}

              <div style={styles.examRow}>
                {/* 중간고사 */}
                <div style={styles.examBlock}>
                  <label style={styles.examLabel}>중간고사</label>
                  <div style={styles.examInputs}>
                    <input
                      style={styles.scoreInput}
                      type="number"
                      min="0"
                      max="100"
                      placeholder="점수"
                      value={subject.midterm.score}
                      onChange={(e) =>
                        updateSubject(subject.id, (s) => ({ ...s, midterm: { ...s.midterm, score: e.target.value } }))
                      }
                    />
                    <span style={styles.separator}>/</span>
                    <input
                      style={{ ...styles.scoreInput, width: 54 }}
                      type="number"
                      min="0"
                      max="100"
                      placeholder="비율"
                      value={subject.midterm.weight}
                      onChange={(e) =>
                        updateSubject(subject.id, (s) => ({ ...s, midterm: { ...s.midterm, weight: e.target.value } }))
                      }
                    />
                    <span style={styles.pct}>%</span>
                  </div>
                </div>

                {/* 기말고사 */}
                <div style={styles.examBlock}>
                  <label style={styles.examLabel}>기말고사</label>
                  <div style={styles.examInputs}>
                    <input
                      style={styles.scoreInput}
                      type="number"
                      min="0"
                      max="100"
                      placeholder="점수"
                      value={subject.final.score}
                      onChange={(e) =>
                        updateSubject(subject.id, (s) => ({ ...s, final: { ...s.final, score: e.target.value } }))
                      }
                    />
                    <span style={styles.separator}>/</span>
                    <input
                      style={{ ...styles.scoreInput, width: 54 }}
                      type="number"
                      min="0"
                      max="100"
                      placeholder="비율"
                      value={subject.final.weight}
                      onChange={(e) =>
                        updateSubject(subject.id, (s) => ({ ...s, final: { ...s.final, weight: e.target.value } }))
                      }
                    />
                    <span style={styles.pct}>%</span>
                  </div>
                </div>
              </div>

              {/* 수행평가 목록 */}
              <div style={styles.perfSection}>
                <span style={styles.perfTitle}>수행평가</span>
                {subject.performances.map((perf) => (
                  <div key={perf.id} style={styles.perfRow}>
                    <input
                      style={{ ...styles.scoreInput, width: 90 }}
                      placeholder="항목명"
                      value={perf.name}
                      onChange={(e) => updatePerf(subject.id, perf.id, "name", e.target.value)}
                    />
                    <input
                      style={styles.scoreInput}
                      type="number"
                      min="0"
                      max={perf.weight || 100}
                      placeholder="점수"
                      value={perf.score}
                      onChange={(e) => updatePerf(subject.id, perf.id, "score", e.target.value)}
                    />
                    <span style={styles.pct}>/ {perf.weight || "?"}점</span>
                    <input
                      style={{ ...styles.scoreInput, width: 54 }}
                      type="number"
                      min="0"
                      max="100"
                      placeholder="비율"
                      value={perf.weight}
                      onChange={(e) => updatePerf(subject.id, perf.id, "weight", e.target.value)}
                    />
                    <span style={styles.pct}>%,</span>
                    {subject.performances.length > 1 && (
                      <button
                        style={styles.removePerfBtn}
                        onClick={() => removePerformance(subject.id, perf.id)}
                      >
                        −
                      </button>
                    )}
                  </div>
                ))}
                <button style={styles.addPerfBtn} onClick={() => addPerformance(subject.id)}>
                  + 수행평가 추가
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button style={styles.addSubjectBtn} onClick={addSubject}>
        + 과목 추가
      </button>

      {/* 등급 기준표 */}
      <div style={styles.gradeLegend}>
        <span style={styles.legendTitle}>등급 기준</span>
        <div style={styles.legendItems}>
          {GRADE_CUTOFFS.map(({ grade, min }, i) => {
            const max = i === 0 ? 100 : GRADE_CUTOFFS[i - 1].min - 1;
            const label = grade === "F" ? `0~${max}` : i === 0 ? `${min}~100` : `${min}~${max}`;
            return (
              <span key={grade} style={{ ...styles.legendItem, color: getGradeColor(grade) }}>
                {grade} ({label})
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 760,
    margin: "0 auto",
    padding: "0 0 60px",
    fontFamily: "'Noto Sans KR', sans-serif",
  },
  header: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 700, color: "#e8eaf2", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#6b7494" },

  overallCard: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    background: "#1a2032",
    border: "1px solid #1e2535",
    borderRadius: 14,
    padding: "18px 28px",
    marginBottom: 28,
  },
  overallLabel: { fontSize: 13, color: "#6b7494", flex: 1 },
  overallScore: { fontSize: 32, fontWeight: 700, fontFamily: "monospace" },
  overallGrade: { fontSize: 22, fontWeight: 700 },

  subjectList: { display: "flex", flexDirection: "column", gap: 16 },

  card: {
    background: "#161b27",
    border: "1px solid #1e2535",
    borderRadius: 14,
    padding: 24,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  subjectNameInput: {
    flex: 1,
    background: "#0f1117",
    border: "1px solid #1e2535",
    borderRadius: 8,
    padding: "8px 14px",
    color: "#e8eaf2",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "'Noto Sans KR', sans-serif",
    outline: "none",
  },
  resultBadge: { display: "flex", alignItems: "center", gap: 8 },
  resultScore: { fontSize: 20, fontWeight: 700, fontFamily: "monospace" },
  resultGradeBadge: {
    fontSize: 13,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 20,
  },
  resultEmpty: { fontSize: 12, color: "#3d4461" },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#3d4461",
    fontSize: 16,
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: 6,
    transition: "color 0.2s",
  },

  weightWarning: {
    fontSize: 12,
    color: "#fbbf24",
    background: "rgba(251,191,36,0.08)",
    borderRadius: 8,
    padding: "6px 12px",
    marginBottom: 14,
  },

  examRow: { display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" },
  examBlock: { flex: 1, minWidth: 200 },
  examLabel: { fontSize: 11, color: "#6b7494", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 },
  examInputs: { display: "flex", alignItems: "center", gap: 6 },

  scoreInput: {
    background: "#0f1117",
    border: "1px solid #1e2535",
    borderRadius: 8,
    padding: "8px 10px",
    color: "#e8eaf2",
    fontSize: 14,
    width: 72,
    fontFamily: "monospace",
    outline: "none",
    textAlign: "center",
  },
  separator: { color: "#3d4461", fontSize: 16 },
  pct: { color: "#6b7494", fontSize: 13 },

  perfSection: { borderTop: "1px solid #1e2535", paddingTop: 16 },
  perfTitle: { fontSize: 11, color: "#6b7494", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 10 },
  perfRow: { display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" },
  removePerfBtn: {
    background: "none",
    border: "1px solid #1e2535",
    borderRadius: 6,
    color: "#6b7494",
    fontSize: 16,
    width: 28,
    height: 28,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  addPerfBtn: {
    background: "none",
    border: "1px dashed #1e2535",
    borderRadius: 8,
    color: "#6b7494",
    fontSize: 13,
    padding: "6px 14px",
    cursor: "pointer",
    marginTop: 4,
    fontFamily: "'Noto Sans KR', sans-serif",
    transition: "border-color 0.2s, color 0.2s",
  },

  addSubjectBtn: {
    marginTop: 20,
    background: "none",
    border: "1px dashed #4f8ef7",
    borderRadius: 10,
    color: "#4f8ef7",
    fontSize: 14,
    padding: "12px 24px",
    cursor: "pointer",
    width: "100%",
    fontFamily: "'Noto Sans KR', sans-serif",
    transition: "background 0.2s",
  },

  gradeLegend: {
    marginTop: 32,
    background: "#161b27",
    border: "1px solid #1e2535",
    borderRadius: 12,
    padding: "14px 20px",
  },
  legendTitle: { fontSize: 11, color: "#6b7494", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 10 },
  legendItems: { display: "flex", flexWrap: "wrap", gap: "6px 16px" },
  legendItem: { fontSize: 12, fontFamily: "monospace" },
};
