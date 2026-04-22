import { useState, useEffect, useCallback } from "react";
import {
  collection, addDoc, getDocs, doc, setDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, getDoc
} from "firebase/firestore";
import { db } from "./firebase";

// ── 주차 유틸 ──────────────────────────────────────────────
function getWeekKey(date = new Date()) {
  // 월요일 기준 ISO 주차
  const d = new Date(date);
  const day = d.getDay(); // 0=일
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  // ISO week number
  const startOfYear = new Date(year, 0, 1);
  const week = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function weekKeyToLabel(key) {
  // "2026-W17" → "2026년 17주차"
  const [year, w] = key.split("-W");
  return `${year}년 ${parseInt(w)}주차`;
}

function getWeekKeys(count = 5) {
  const keys = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    keys.push(getWeekKey(d));
  }
  return keys; // [현재주, 지난주, ...]
}

function extractYoutubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const GENRES = ["K-POP", "POP", "J-POP", "락", "재즈", "발라드", "트로트", "OST", "클래식", "R&B", "힙합", "기타"];

// ── 메인 컴포넌트 ──────────────────────────────────────────
export default function Anthem({ user }) {
  const currentWeek = getWeekKey();
  const [tab, setTab] = useState("current"); // "next" | "current" | "archive"
  const [archiveWeek, setArchiveWeek] = useState(null);
  const [songs, setSongs] = useState([]);
  const [myVotes, setMyVotes] = useState({}); // songId → "up"|"down"|null
  const [loading, setLoading] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);
  const [hasSubmittedThisWeek, setHasSubmittedThisWeek] = useState(false);

  // 다음주 key (현재주 + 7일)
  const nextWeek = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return getWeekKey(d);
  })();

  const displayWeek = tab === "next" ? nextWeek : tab === "archive" ? archiveWeek : currentWeek;

  // ── 데이터 로드 ──────────────────────────────────────────
  const loadSongs = useCallback(async (weekKey) => {
    if (!weekKey) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "anthem_songs"),
        where("weekKey", "==", weekKey),
        orderBy("score", "desc")
      );
      const snap = await getDocs(q);
      setSongs(snap.docs.map(d => ({ id: d.id, ...d.data() })));

      // 내 투표 로드
      const voteSnap = await getDocs(
        query(collection(db, "anthem_votes"),
          where("weekKey", "==", weekKey),
          where("userId", "==", user.uid))
      );
      const votes = {};
      voteSnap.docs.forEach(d => { votes[d.data().songId] = d.data().type; });
      setMyVotes(votes);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [user.uid]);

  const checkSubmitted = useCallback(async (weekKey) => {
    const q = query(
      collection(db, "anthem_songs"),
      where("weekKey", "==", weekKey),
      where("authorId", "==", user.uid)
    );
    const snap = await getDocs(q);
    setHasSubmittedThisWeek(!snap.empty);
  }, [user.uid]);

  useEffect(() => {
    const wk = tab === "next" ? nextWeek : tab === "archive" ? archiveWeek : currentWeek;
    if (wk) loadSongs(wk);
    if (tab === "next") checkSubmitted(nextWeek);
  }, [tab, archiveWeek, loadSongs, checkSubmitted]);

  // ── 투표 ────────────────────────────────────────────────
  const handleVote = async (song, type) => {
    const voteId = `${user.uid}_${song.id}`;
    const voteRef = doc(db, "anthem_votes", voteId);
    const songRef = doc(db, "anthem_songs", song.id);
    const current = myVotes[song.id];

    // 낙관적 업데이트
    const newSongs = songs.map(s => {
      if (s.id !== song.id) return s;
      let { upvotes = 0, downvotes = 0 } = s;
      // 기존 취소
      if (current === "up") upvotes--;
      if (current === "down") downvotes--;
      // 새로 추가 (토글이면 취소만)
      const newType = current === type ? null : type;
      if (newType === "up") upvotes++;
      if (newType === "down") downvotes++;
      return { ...s, upvotes, downvotes, score: upvotes - downvotes };
    });
    setSongs(newSongs.sort((a, b) => b.score - a.score));
    setMyVotes(prev => ({ ...prev, [song.id]: current === type ? null : type }));

    // Firestore 업데이트
    try {
      const newType = current === type ? null : type;
      if (newType === null) {
        await deleteDoc(voteRef);
      } else {
        await setDoc(voteRef, { userId: user.uid, songId: song.id, weekKey: song.weekKey, type: newType });
      }
      // 점수 재계산
      const upSnap = await getDocs(query(collection(db, "anthem_votes"), where("songId", "==", song.id), where("type", "==", "up")));
      const downSnap = await getDocs(query(collection(db, "anthem_votes"), where("songId", "==", song.id), where("type", "==", "down")));
      await setDoc(songRef, { upvotes: upSnap.size, downvotes: downSnap.size, score: upSnap.size - downSnap.size }, { merge: true });
    } catch (e) { console.error(e); }
  };

  // ── 아카이브 주차 목록 (최근 4주) ─────────────────────
  const archiveWeeks = getWeekKeys(6).slice(1, 5); // 지난 4주

  const weekKeyToDisplay = tab === "archive" ? archiveWeek : tab === "next" ? nextWeek : currentWeek;

  return (
    <div style={s.container}>
      {/* 헤더 */}
      <div style={s.header}>
        <h2 style={s.title}>🎵 기상곡 신청</h2>
        <p style={s.subtitle}>매주 월요일 기준으로 갱신돼요. 추천이 많은 순으로 선정됩니다.</p>
      </div>

      {/* 탭 */}
      <div style={s.tabs}>
        {[
          { id: "next", label: "다음 주 신청" },
          { id: "current", label: "이번 주 목록" },
          { id: "archive", label: "이전 목록 조회" },
        ].map(t => (
          <button
            key={t.id}
            style={{ ...s.tab, ...(tab === t.id ? s.tabActive : {}) }}
            onClick={() => { setTab(t.id); if (t.id === "archive" && !archiveWeek) setArchiveWeek(archiveWeeks[0]); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 아카이브 주차 선택 */}
      {tab === "archive" && (
        <div style={s.archiveNav}>
          <button style={s.navBtn} onClick={() => {
            const idx = archiveWeeks.indexOf(archiveWeek);
            if (idx < archiveWeeks.length - 1) setArchiveWeek(archiveWeeks[idx + 1]);
          }}>← 이전 주</button>
          <span style={s.weekLabel}>{archiveWeek ? weekKeyToLabel(archiveWeek) : ""}</span>
          <button style={s.navBtn} onClick={() => {
            const idx = archiveWeeks.indexOf(archiveWeek);
            if (idx > 0) setArchiveWeek(archiveWeeks[idx - 1]);
          }}>다음 주 →</button>
        </div>
      )}

      {/* 현재 주 라벨 */}
      {tab !== "archive" && (
        <div style={s.weekBadge}>
          {weekKeyToLabel(tab === "next" ? nextWeek : currentWeek)}
          {tab === "next" && <span style={s.weekBadgeNote}> · 신청 기간</span>}
        </div>
      )}

      {/* 곡 목록 */}
      {loading ? (
        <div style={s.empty}>불러오는 중...</div>
      ) : songs.length === 0 ? (
        <div style={s.empty}>
          {tab === "next" ? "아직 신청된 곡이 없어요. 첫 번째로 신청해보세요!" : "이 주에 신청된 곡이 없어요."}
        </div>
      ) : (
        <div style={s.songList}>
          {songs.map((song, idx) => (
            <SongCard
              key={song.id}
              song={song}
              rank={idx + 1}
              myVote={myVotes[song.id]}
              onVote={tab !== "archive" ? handleVote : null}
              canVote={tab !== "archive"}
              onClick={() => setSelectedSong(song)}
            />
          ))}
        </div>
      )}

      {/* 신청 버튼 (다음 주 탭만) */}
      {tab === "next" && (
        <button
          style={{ ...s.fab, ...(hasSubmittedThisWeek ? s.fabDisabled : {}) }}
          onClick={() => !hasSubmittedThisWeek && setShowSubmit(true)}
          title={hasSubmittedThisWeek ? "이번 주 신청 완료" : "기상곡 신청"}
        >
          {hasSubmittedThisWeek ? "✓" : "+"}
        </button>
      )}

      {/* 신청 팝업 */}
      {showSubmit && (
        <SubmitModal
          user={user}
          nextWeek={nextWeek}
          onClose={() => setShowSubmit(false)}
          onSubmitted={() => { setShowSubmit(false); loadSongs(nextWeek); checkSubmitted(nextWeek); }}
        />
      )}

      {/* 곡 상세 팝업 */}
      {selectedSong && (
        <SongModal
          song={selectedSong}
          myVote={myVotes[selectedSong.id]}
          canVote={tab !== "archive"}
          onVote={handleVote}
          onClose={() => setSelectedSong(null)}
        />
      )}
    </div>
  );
}

// ── 곡 카드 ───────────────────────────────────────────────
function SongCard({ song, rank, myVote, onVote, canVote, onClick }) {
  const score = (song.upvotes || 0) - (song.downvotes || 0);
  const scoreColor = score > 0 ? "#4ade80" : score < 0 ? "#f87171" : "#6b7494";

  return (
    <div style={s.card} onClick={onClick}>
      <div style={s.cardLeft}>
        <span style={s.rank}>#{rank}</span>
        <img
          src={`https://img.youtube.com/vi/${song.videoId}/mqdefault.jpg`}
          alt=""
          style={s.thumb}
        />
        <div style={s.cardInfo}>
          <div style={s.cardTitle}>
            <span style={s.genre}>{song.genre}</span>
            <span style={s.songTitle}>{song.title}</span>
          </div>
          <div style={s.cardMeta}>
            <span style={s.author}>{song.authorName}</span>
          </div>
        </div>
      </div>
      <div style={s.cardRight} onClick={e => e.stopPropagation()}>
        <span style={{ ...s.score, color: scoreColor }}>
          {score > 0 ? "+" : ""}{score}
        </span>
        {canVote && (
          <>
            <button
              style={{ ...s.voteBtn, ...(myVote === "up" ? s.voteBtnUpActive : {}) }}
              onClick={() => onVote(song, "up")}
            >👍 {song.upvotes || 0}</button>
            <button
              style={{ ...s.voteBtn, ...(myVote === "down" ? s.voteBtnDownActive : {}) }}
              onClick={() => onVote(song, "down")}
            >👎 {song.downvotes || 0}</button>
          </>
        )}
        {!canVote && (
          <div style={s.voteCounts}>
            <span style={s.voteCountUp}>👍 {song.upvotes || 0}</span>
            <span style={s.voteCountDown}>👎 {song.downvotes || 0}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 신청 모달 ─────────────────────────────────────────────
function SubmitModal({ user, nextWeek, onClose, onSubmitted }) {
  const [url, setUrl] = useState("");
  const [genre, setGenre] = useState("");
  const [desc, setDesc] = useState("");
  const [preview, setPreview] = useState(null); // { id, title }
  const [step, setStep] = useState(1); // 1: 입력, 2: 미리보기 확인
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleUrlCheck = async () => {
    setError("");
    const id = extractYoutubeId(url);
    if (!id) { setError("유효한 유튜브 URL을 입력해주세요."); return; }
    if (!genre) { setError("장르를 선택해주세요."); return; }
    setPreviewLoading(true);
    // oEmbed로 제목 가져오기
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPreview({ id, title: data.title });
      setStep(2);
    } catch {
      setError("영상 정보를 가져올 수 없어요. URL을 확인해주세요.");
    }
    setPreviewLoading(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await addDoc(collection(db, "anthem_songs"), {
        weekKey: nextWeek,
        videoId: preview.id,
        title: preview.title,
        genre,
        description: desc,
        authorId: user.uid,
        authorName: user.displayName,
        upvotes: 0,
        downvotes: 0,
        score: 0,
        createdAt: serverTimestamp(),
      });
      onSubmitted();
    } catch (e) {
      setError("제출 중 오류가 발생했어요.");
      setSubmitting(false);
    }
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <h3 style={s.modalTitle}>기상곡 신청하기</h3>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {step === 1 && (
          <>
            <div style={s.field}>
              <label style={s.label}>유튜브 URL</label>
              <input
                style={s.input}
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>장르</label>
              <div style={s.genreGrid}>
                {GENRES.map(g => (
                  <button
                    key={g}
                    style={{ ...s.genreBtn, ...(genre === g ? s.genreBtnActive : {}) }}
                    onClick={() => setGenre(g)}
                  >{g}</button>
                ))}
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>설명 <span style={s.optional}>(선택)</span></label>
              <textarea
                style={s.textarea}
                placeholder="곡 추천 이유나 감상 포인트를 적어주세요!"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                maxLength={200}
                rows={3}
              />
              <span style={s.charCount}>{desc.length}/200</span>
            </div>
            {error && <div style={s.errorMsg}>{error}</div>}
            <button
              style={{ ...s.primaryBtn, ...(previewLoading ? s.btnDisabled : {}) }}
              onClick={handleUrlCheck}
              disabled={previewLoading}
            >
              {previewLoading ? "확인 중..." : "다음 →"}
            </button>
          </>
        )}

        {step === 2 && preview && (
          <>
            <p style={s.confirmText}>이 영상이 맞나요?</p>
            <div style={s.embedWrap}>
              <iframe
                width="100%"
                height="220"
                src={`https://www.youtube.com/embed/${preview.id}`}
                frameBorder="0"
                allowFullScreen
                style={{ borderRadius: 10 }}
              />
            </div>
            <div style={s.previewInfo}>
              <span style={s.previewGenre}>{genre}</span>
              <span style={s.previewTitle}>{preview.title}</span>
            </div>
            {desc && <p style={s.previewDesc}>"{desc}"</p>}
            {error && <div style={s.errorMsg}>{error}</div>}
            <div style={s.btnRow}>
              <button style={s.secondaryBtn} onClick={() => setStep(1)}>← 수정</button>
              <button
                style={{ ...s.primaryBtn, ...(submitting ? s.btnDisabled : {}) }}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "제출 중..." : "✓ 신청하기"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── 곡 상세 모달 ──────────────────────────────────────────
function SongModal({ song, myVote, canVote, onVote, onClose }) {
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div>
            <span style={s.genre}>{song.genre}</span>
            <h3 style={{ ...s.modalTitle, marginTop: 6 }}>{song.title}</h3>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={s.embedWrap}>
          <iframe
            width="100%"
            height="280"
            src={`https://www.youtube.com/embed/${song.videoId}`}
            frameBorder="0"
            allowFullScreen
            style={{ borderRadius: 10 }}
          />
        </div>
        {song.description && (
          <p style={s.previewDesc}>"{song.description}"</p>
        )}
        <div style={s.modalMeta}>
          <span style={s.author}>{song.authorName}</span>
        </div>
        {canVote && (
          <div style={s.modalVotes}>
            <button
              style={{ ...s.modalVoteBtn, ...(myVote === "up" ? s.modalVoteBtnUpActive : {}) }}
              onClick={() => onVote(song, "up")}
            >
              👍 추천 {song.upvotes || 0}
            </button>
            <button
              style={{ ...s.modalVoteBtn, ...(myVote === "down" ? s.modalVoteBtnDownActive : {}) }}
              onClick={() => onVote(song, "down")}
            >
              👎 비추천 {song.downvotes || 0}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 스타일 ────────────────────────────────────────────────
const s = {
  container: { maxWidth: 800, margin: "0 auto", padding: "0 0 80px", fontFamily: "'Noto Sans KR', sans-serif" },
  header: { marginBottom: 28 },
  title: { fontSize: 28, fontWeight: 700, color: "#e8eaf2", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#6b7494" },

  tabs: { display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #1e2535", paddingBottom: 0 },
  tab: { background: "none", border: "none", color: "#6b7494", fontSize: 14, padding: "10px 16px", cursor: "pointer", borderBottom: "2px solid transparent", fontFamily: "'Noto Sans KR', sans-serif", transition: "color 0.2s" },
  tabActive: { color: "#4f8ef7", borderBottom: "2px solid #4f8ef7", fontWeight: 600 },

  archiveNav: { display: "flex", alignItems: "center", gap: 16, marginBottom: 20 },
  navBtn: { background: "#1a2032", border: "1px solid #1e2535", color: "#e8eaf2", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "'Noto Sans KR', sans-serif" },
  weekLabel: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: 600, color: "#e8eaf2" },
  weekBadge: { fontSize: 13, color: "#6b7494", marginBottom: 16 },
  weekBadgeNote: { color: "#4f8ef7" },

  empty: { textAlign: "center", color: "#3d4461", padding: "60px 0", fontSize: 14 },

  songList: { display: "flex", flexDirection: "column", gap: 8 },
  card: { background: "#161b27", border: "1px solid #1e2535", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "border-color 0.2s, background 0.2s", gap: 12 },
  cardLeft: { display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  rank: { fontSize: 12, color: "#3d4461", fontFamily: "monospace", width: 24, flexShrink: 0 },
  thumb: { width: 56, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTitle: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  genre: { fontSize: 11, background: "rgba(79,142,247,0.15)", color: "#4f8ef7", padding: "2px 8px", borderRadius: 20, flexShrink: 0 },
  songTitle: { fontSize: 14, color: "#e8eaf2", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  cardMeta: {},
  author: { fontSize: 12, color: "#6b7494" },
  cardRight: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  score: { fontSize: 18, fontWeight: 700, fontFamily: "monospace", minWidth: 40, textAlign: "right" },
  voteBtn: { background: "#1a2032", border: "1px solid #1e2535", color: "#6b7494", padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, transition: "all 0.15s", fontFamily: "'Noto Sans KR', sans-serif" },
  voteBtnUpActive: { background: "rgba(74,222,128,0.15)", border: "1px solid #4ade80", color: "#4ade80" },
  voteBtnDownActive: { background: "rgba(248,113,113,0.15)", border: "1px solid #f87171", color: "#f87171" },
  voteCounts: { display: "flex", gap: 8 },
  voteCountUp: { fontSize: 13, color: "#4ade80" },
  voteCountDown: { fontSize: 13, color: "#f87171" },

  fab: { position: "fixed", bottom: 32, right: 32, width: 52, height: 52, borderRadius: "50%", background: "#4f8ef7", border: "none", color: "#fff", fontSize: 28, cursor: "pointer", boxShadow: "0 4px 20px rgba(79,142,247,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, transition: "background 0.2s" },
  fabDisabled: { background: "#1e2535", color: "#3d4461", boxShadow: "none", cursor: "not-allowed" },

  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "#161b27", border: "1px solid #1e2535", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", position: "relative" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#e8eaf2", margin: 0 },
  closeBtn: { background: "none", border: "none", color: "#6b7494", fontSize: 20, cursor: "pointer", padding: 4, lineHeight: 1 },

  field: { marginBottom: 18 },
  label: { display: "block", fontSize: 13, color: "#6b7494", marginBottom: 8, fontWeight: 500 },
  optional: { color: "#3d4461", fontWeight: 400 },
  input: { width: "100%", background: "#0f1117", border: "1px solid #1e2535", borderRadius: 8, padding: "10px 14px", color: "#e8eaf2", fontSize: 14, fontFamily: "monospace", outline: "none", boxSizing: "border-box" },
  textarea: { width: "100%", background: "#0f1117", border: "1px solid #1e2535", borderRadius: 8, padding: "10px 14px", color: "#e8eaf2", fontSize: 14, fontFamily: "'Noto Sans KR', sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" },
  charCount: { fontSize: 11, color: "#3d4461", display: "block", textAlign: "right", marginTop: 4 },
  genreGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  genreBtn: { background: "#0f1117", border: "1px solid #1e2535", color: "#6b7494", padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontFamily: "'Noto Sans KR', sans-serif", transition: "all 0.15s" },
  genreBtnActive: { background: "rgba(79,142,247,0.15)", border: "1px solid #4f8ef7", color: "#4f8ef7" },

  errorMsg: { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 14 },
  primaryBtn: { width: "100%", background: "#4f8ef7", border: "none", color: "#fff", padding: "12px", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif", marginTop: 4 },
  btnDisabled: { opacity: 0.5, cursor: "not-allowed" },
  secondaryBtn: { flex: 1, background: "#1a2032", border: "1px solid #1e2535", color: "#e8eaf2", padding: "12px", borderRadius: 10, fontSize: 14, cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif" },
  btnRow: { display: "flex", gap: 10, marginTop: 4 },

  confirmText: { fontSize: 15, color: "#e8eaf2", marginBottom: 14 },
  embedWrap: { borderRadius: 10, overflow: "hidden", marginBottom: 16 },
  previewInfo: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  previewGenre: { fontSize: 11, background: "rgba(79,142,247,0.15)", color: "#4f8ef7", padding: "2px 8px", borderRadius: 20 },
  previewTitle: { fontSize: 14, color: "#e8eaf2", fontWeight: 500 },
  previewDesc: { fontSize: 13, color: "#6b7494", fontStyle: "italic", marginBottom: 16, lineHeight: 1.6 },

  modalMeta: { marginBottom: 16 },
  modalVotes: { display: "flex", gap: 12 },
  modalVoteBtn: { flex: 1, background: "#1a2032", border: "1px solid #1e2535", color: "#6b7494", padding: "12px", borderRadius: 10, cursor: "pointer", fontSize: 15, fontFamily: "'Noto Sans KR', sans-serif", transition: "all 0.15s" },
  modalVoteBtnUpActive: { background: "rgba(74,222,128,0.15)", border: "1px solid #4ade80", color: "#4ade80" },
  modalVoteBtnDownActive: { background: "rgba(248,113,113,0.15)", border: "1px solid #f87171", color: "#f87171" },
};
