import { useState } from "react";
import "./Grades.css";

const GRADE_CUTOFFS = [
  { grade: "A+", min: 95 }, { grade: "A",  min: 90 }, { grade: "A-", min: 85 },
  { grade: "B+", min: 80 }, { grade: "B",  min: 75 }, { grade: "B-", min: 70 },
  { grade: "C+", min: 65 }, { grade: "C",  min: 60 }, { grade: "C-", min: 55 },
  { grade: "D+", min: 50 }, { grade: "D",  min: 45 }, { grade: "D-", min: 40 },
  { grade: "F",  min: 0  },
];

function getGrade(score) {
  for (const { grade, min } of GRADE_CUTOFFS) if (score >= min) return grade;
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
      performances: [...s.performances, { id: ++perfIdCounter, name: `수행${s.performances.length + 1}`, score: "", weight: 0 }],
    }));
  };

  const removePerformance = (subjectId, perfId) => {
    updateSubject(subjectId, (s) => ({ ...s, performances: s.performances.filter((p) => p.id !== perfId) }));
  };

  const updatePerf = (subjectId, perfId, field, value) => {
    updateSubject(subjectId, (s) => ({
      ...s,
      performances: s.performances.map((p) => p.id === perfId ? { ...p, [field]: value } : p),
    }));
  };

  const allScores = subjects.map((s) => calcSubjectScore(s)).filter((r) => r !== null).map((r) => r.score);
  const overallAvg = allScores.length > 0
    ? parseFloat((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2))
    : null;

  return (
    <div className="grades-container">
      <div className="grades-header">
        <h2 className="grades-title">성적 계산기</h2>
        <p className="grades-subtitle">과목별 중간·기말·수행평가를 입력하면 최종 점수와 등급을 계산해줘요.</p>
      </div>

      {overallAvg !== null && (
        <div className="grades-overall-card">
          <span className="grades-overall-label">전체 평균</span>
          <span className="grades-overall-score" style={{ color: getGradeColor(getGrade(overallAvg)) }}>{overallAvg}</span>
          <span className="grades-overall-grade" style={{ color: getGradeColor(getGrade(overallAvg)) }}>{getGrade(overallAvg)}</span>
        </div>
      )}

      <div className="grades-subject-list">
        {subjects.map((subject) => {
          const result = calcSubjectScore(subject);
          const weightSum =
            Number(subject.midterm.weight) +
            Number(subject.final.weight) +
            subject.performances.reduce((s, p) => s + Number(p.weight || 0), 0);
          const weightOk = weightSum === 100;

          return (
            <div key={subject.id} className="grades-card">
              <div className="grades-card-header">
                <input
                  className="grades-subject-name-input"
                  placeholder="과목명 (예: 수학)"
                  value={subject.name}
                  onChange={(e) => updateSubject(subject.id, (s) => ({ ...s, name: e.target.value }))}
                />
                <div className="grades-result-badge">
                  {result ? (
                    <>
                      <span className="grades-result-score" style={{ color: getGradeColor(getGrade(result.score)) }}>{result.score}점</span>
                      <span className="grades-result-grade-badge" style={{ background: getGradeColor(getGrade(result.score)) + "22", color: getGradeColor(getGrade(result.score)) }}>
                        {getGrade(result.score)}
                      </span>
                    </>
                  ) : (
                    <span className="grades-result-empty">점수 입력 전</span>
                  )}
                </div>
                {subjects.length > 1 && (
                  <button className="grades-remove-btn" onClick={() => removeSubject(subject.id)}>✕</button>
                )}
              </div>

              {!weightOk && (
                <div className="grades-weight-warning">
                  ⚠️ 비율 합계: {weightSum}% (100%가 되어야 해요)
                </div>
              )}

              <div className="grades-exam-row">
                <div className="grades-exam-block">
                  <label className="grades-exam-label">중간고사</label>
                  <div className="grades-exam-inputs">
                    <input className="grades-score-input" type="number" min="0" max="100" placeholder="점수"
                      value={subject.midterm.score}
                      onChange={(e) => updateSubject(subject.id, (s) => ({ ...s, midterm: { ...s.midterm, score: e.target.value } }))} />
                    <span className="grades-separator">/</span>
                    <input className="grades-score-input grades-score-input-sm" type="number" min="0" max="100" placeholder="비율"
                      value={subject.midterm.weight}
                      onChange={(e) => updateSubject(subject.id, (s) => ({ ...s, midterm: { ...s.midterm, weight: e.target.value } }))} />
                    <span className="grades-pct">%</span>
                  </div>
                </div>

                <div className="grades-exam-block">
                  <label className="grades-exam-label">기말고사</label>
                  <div className="grades-exam-inputs">
                    <input className="grades-score-input" type="number" min="0" max="100" placeholder="점수"
                      value={subject.final.score}
                      onChange={(e) => updateSubject(subject.id, (s) => ({ ...s, final: { ...s.final, score: e.target.value } }))} />
                    <span className="grades-separator">/</span>
                    <input className="grades-score-input grades-score-input-sm" type="number" min="0" max="100" placeholder="비율"
                      value={subject.final.weight}
                      onChange={(e) => updateSubject(subject.id, (s) => ({ ...s, final: { ...s.final, weight: e.target.value } }))} />
                    <span className="grades-pct">%</span>
                  </div>
                </div>
              </div>

              <div className="grades-perf-section">
                <span className="grades-perf-title">수행평가</span>
                {subject.performances.map((perf) => (
                  <div key={perf.id} className="grades-perf-row">
                    <input className="grades-score-input grades-score-input-md" placeholder="항목명" value={perf.name}
                      onChange={(e) => updatePerf(subject.id, perf.id, "name", e.target.value)} />
                    <input className="grades-score-input" type="number" min="0" max={perf.weight || 100} placeholder="점수" value={perf.score}
                      onChange={(e) => updatePerf(subject.id, perf.id, "score", e.target.value)} />
                    <span className="grades-pct">/ {perf.weight || "?"}점</span>
                    <input className="grades-score-input grades-score-input-sm" type="number" min="0" max="100" placeholder="비율" value={perf.weight}
                      onChange={(e) => updatePerf(subject.id, perf.id, "weight", e.target.value)} />
                    <span className="grades-pct">%,</span>
                    {subject.performances.length > 1 && (
                      <button className="grades-remove-perf-btn" onClick={() => removePerformance(subject.id, perf.id)}>−</button>
                    )}
                  </div>
                ))}
                <button className="grades-add-perf-btn" onClick={() => addPerformance(subject.id)}>+ 수행평가 추가</button>
              </div>
            </div>
          );
        })}
      </div>

      <button className="grades-add-subject-btn" onClick={addSubject}>+ 과목 추가</button>

      <div className="grades-legend">
        <span className="grades-legend-title">등급 기준</span>
        <div className="grades-legend-items">
          {GRADE_CUTOFFS.map(({ grade, min }, i) => {
            const max = i === 0 ? 100 : GRADE_CUTOFFS[i - 1].min - 1;
            const label = grade === "F" ? `0~${max}` : i === 0 ? `${min}~100` : `${min}~${max}`;
            return (
              <span key={grade} className="grades-legend-item" style={{ color: getGradeColor(grade) }}>
                {grade} ({label})
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}