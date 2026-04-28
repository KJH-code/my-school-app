import { useState, useEffect, useCallback } from "react";
import {
  collection, addDoc, getDocs, doc, setDoc, deleteDoc,
  query, where, orderBy, serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";
import "./Anthem.css";

function getWeekKey(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const week = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function weekKeyToLabel(key) {
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
  return keys;
}

function extractYoutubeId(url) {
  const patterns = [/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const GENRES = ["K-POP", "POP", "J-POP", "락", "재즈", "발라드", "트로트", "OST", "클래식", "R&B", "힙합", "기타"];

export default function Anthem({ user }) {
  const [tab, setTab] = useState("next");
  const [archiveWeek, setArchiveWeek] = useState(null);
  const [songs, setSongs] = useState([]);
  const [myVotes, setMyVotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);
  const [hasSubmittedThisWeek, setHasSubmittedThisWeek] = useState(false);
  const isFreshman = user.email?.startsWith("freshman");
  const currentWeek = getWeekKey();
  const nextWeek = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return getWeekKey(d);
  })();

  const loadSongs = useCallback(async (weekKey) => {
    if (!weekKey) return;
    setLoading(true);
    try {
      const q = query(collection(db, "anthem_songs"), where("weekKey", "==", weekKey), orderBy("score", "desc"));
      const snap = await getDocs(q);
      setSongs(snap.docs.map(d => ({ id: d.id, ...d.data() })));

      const voteSnap = await getDocs(
        query(collection(db, "anthem_votes"), where("weekKey", "==", weekKey), where("userId", "==", user.uid))
      );
      const votes = {};
      voteSnap.docs.forEach(d => { votes[d.data().songId] = d.data().type; });
      setMyVotes(votes);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user.uid]);

  const checkSubmitted = useCallback(async (weekKey) => {
    const q = query(collection(db, "anthem_songs"), where("weekKey", "==", weekKey), where("authorId", "==", user.uid));
    const snap = await getDocs(q);
    setHasSubmittedThisWeek(!snap.empty);
  }, [user.uid]);

  useEffect(() => {
    const wk = tab === "next" ? nextWeek : tab === "archive" ? archiveWeek : currentWeek;
    if (wk) loadSongs(wk);
    if (tab === "next") checkSubmitted(nextWeek);
  }, [tab, archiveWeek, loadSongs, checkSubmitted]);

  const handleVote = async (song, type) => {
    const voteId = `${user.uid}_${song.id}`;
    const voteRef = doc(db, "anthem_votes", voteId);
    const songRef = doc(db, "anthem_songs", song.id);
    const current = myVotes[song.id];

    const newSongs = songs.map(s => {
      if (s.id !== song.id) return s;
      let { upvotes = 0, downvotes = 0 } = s;
      if (current === "up") upvotes--;
      if (current === "down") downvotes--;
      const newType = current === type ? null : type;
      if (newType === "up") upvotes++;
      if (newType === "down") downvotes++;
      return { ...s, upvotes, downvotes, score: upvotes - downvotes };
    });
    setSongs(newSongs.sort((a, b) => b.score - a.score));
    setMyVotes(prev => ({ ...prev, [song.id]: current === type ? null : type }));

    try {
      const newType = current === type ? null : type;
      if (newType === null) await deleteDoc(voteRef);
      else await setDoc(voteRef, { userId: user.uid, songId: song.id, weekKey: song.weekKey, type: newType });
      const upSnap = await getDocs(query(collection(db, "anthem_votes"), where("songId", "==", song.id), where("type", "==", "up")));
      const downSnap = await getDocs(query(collection(db, "anthem_votes"), where("songId", "==", song.id), where("type", "==", "down")));
      await setDoc(songRef, { upvotes: upSnap.size, downvotes: downSnap.size, score: upSnap.size - downSnap.size }, { merge: true });
    } catch (e) { console.error(e); }
  };

  const archiveWeeks = getWeekKeys(6).slice(1, 5);

  return (
    <div className="anthem-container">
      <div className="anthem-header">
        <h2 className="anthem-title">🎵 기상곡 신청</h2>
        <p className="anthem-subtitle">매주 월요일 기준으로 갱신돼요. 추천이 많은 순으로 선정됩니다.</p>
      </div>

      <div className="anthem-tabs">
        {[{ id: "next", label: "다음 주 신청" }, { id: "current", label: "이번 주 목록" }, { id: "archive", label: "이전 목록 조회" }].map(t => (
          <button key={t.id} className={`anthem-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => { setTab(t.id); if (t.id === "archive" && !archiveWeek) setArchiveWeek(archiveWeeks[0]); }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "archive" && (
        <div className="anthem-archive-nav">
          <button className="anthem-nav-btn" onClick={() => {
            const idx = archiveWeeks.indexOf(archiveWeek);
            if (idx < archiveWeeks.length - 1) setArchiveWeek(archiveWeeks[idx + 1]);
          }}>← 이전 주</button>
          <span className="anthem-week-label">{archiveWeek ? weekKeyToLabel(archiveWeek) : ""}</span>
          <button className="anthem-nav-btn" onClick={() => {
            const idx = archiveWeeks.indexOf(archiveWeek);
            if (idx > 0) setArchiveWeek(archiveWeeks[idx - 1]);
          }}>다음 주 →</button>
        </div>
      )}

      {tab !== "archive" && (
        <div className="anthem-week-badge">
          {weekKeyToLabel(tab === "next" ? nextWeek : currentWeek)}
          {tab === "next" && <span className="anthem-week-badge-note"> · 신청 기간</span>}
        </div>
      )}

      {loading ? (
        <div className="anthem-empty">불러오는 중...</div>
      ) : songs.length === 0 ? (
        <div className="anthem-empty">
          {tab === "next" ? "아직 신청된 곡이 없어요. 첫 번째로 신청해보세요!" : "이 주에 신청된 곡이 없어요."}
        </div>
      ) : (
        <div className="anthem-song-list">
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

      {tab === "next" && !isFreshman && (
        <button className={`anthem-fab ${hasSubmittedThisWeek ? "disabled" : ""}`}
          onClick={() => !hasSubmittedThisWeek && setShowSubmit(true)}
          title={hasSubmittedThisWeek ? "이번 주 신청 완료" : "기상곡 신청"}>
          {hasSubmittedThisWeek ? "✓" : "+"}
        </button>
      )}
      {tab === "next" && isFreshman && (
        <div className="anthem-freshman-block">🚫 브릿지 계정은 기상곡 신청이 제한됩니다.</div>
      )}

      {showSubmit && (
        <SubmitModal
          user={user}
          nextWeek={nextWeek}
          onClose={() => setShowSubmit(false)}
          onSubmitted={() => { setShowSubmit(false); loadSongs(nextWeek); checkSubmitted(nextWeek); }}
        />
      )}

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

function SongCard({ song, rank, myVote, onVote, canVote, onClick }) {
  const score = (song.upvotes || 0) - (song.downvotes || 0);
  const scoreClass = score > 0 ? "pos" : score < 0 ? "neg" : "neu";

  return (
    <div className="anthem-card" onClick={onClick}>
      <div className="anthem-card-left">
        <span className="anthem-rank">#{rank}</span>
        <img src={`https://img.youtube.com/vi/${song.videoId}/mqdefault.jpg`} alt="" className="anthem-thumb" />
        <div className="anthem-card-info">
          <div className="anthem-card-title-row">
            <span className="anthem-genre">{song.genre}</span>
            <span className="anthem-song-title">{song.title}</span>
          </div>
          <div className="anthem-card-meta">
            <span className="anthem-author">{song.authorName}</span>
          </div>
        </div>
      </div>
      <div className="anthem-card-right" onClick={e => e.stopPropagation()}>
        <span className={`anthem-score ${scoreClass}`}>{score > 0 ? "+" : ""}{score}</span>
        {canVote && (
          <>
            <button className={`anthem-vote-btn ${myVote === "up" ? "up-active" : ""}`} onClick={() => onVote(song, "up")}>
              👍 {song.upvotes || 0}
            </button>
            <button className={`anthem-vote-btn ${myVote === "down" ? "down-active" : ""}`} onClick={() => onVote(song, "down")}>
              👎 {song.downvotes || 0}
            </button>
          </>
        )}
        {!canVote && (
          <div className="anthem-vote-counts">
            <span className="anthem-vote-count-up">👍 {song.upvotes || 0}</span>
            <span className="anthem-vote-count-down">👎 {song.downvotes || 0}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SubmitModal({ user, nextWeek, onClose, onSubmitted }) {
  const [url, setUrl] = useState("");
  const [genre, setGenre] = useState("");
  const [desc, setDesc] = useState("");
  const [preview, setPreview] = useState(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleUrlCheck = async () => {
    setError("");
    const id = extractYoutubeId(url);
    if (!id) { setError("유효한 유튜브 URL을 입력해주세요."); return; }
    if (!genre) { setError("장르를 선택해주세요."); return; }
    setPreviewLoading(true);
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
        weekKey: nextWeek, videoId: preview.id, title: preview.title, genre, description: desc,
        authorId: user.uid, authorName: user.displayName,
        upvotes: 0, downvotes: 0, score: 0, createdAt: serverTimestamp(),
      });
      onSubmitted();
    } catch (e) {
      setError("제출 중 오류가 발생했어요.");
      setSubmitting(false);
    }
  };

  return (
    <div className="anthem-overlay" onClick={onClose}>
      <div className="anthem-modal" onClick={e => e.stopPropagation()}>
        <div className="anthem-modal-header">
          <h3 className="anthem-modal-title">기상곡 신청하기</h3>
          <button className="anthem-close-btn" onClick={onClose}>✕</button>
        </div>

        {step === 1 && (
          <>
            <div className="anthem-field">
              <label className="anthem-label">유튜브 URL</label>
              <input className="anthem-input" placeholder="https://www.youtube.com/watch?v=..." value={url} onChange={e => setUrl(e.target.value)} />
            </div>
            <div className="anthem-field">
              <label className="anthem-label">장르</label>
              <div className="anthem-genre-grid">
                {GENRES.map(g => (
                  <button key={g} className={`anthem-genre-btn ${genre === g ? "active" : ""}`} onClick={() => setGenre(g)}>{g}</button>
                ))}
              </div>
            </div>
            <div className="anthem-field">
              <label className="anthem-label">설명 <span className="anthem-optional">(선택)</span></label>
              <textarea className="anthem-textarea" placeholder="곡 추천 이유나 감상 포인트를 적어주세요!" value={desc} onChange={e => setDesc(e.target.value)} maxLength={200} rows={3} />
              <span className="anthem-char-count">{desc.length}/200</span>
            </div>
            {error && <div className="anthem-error-msg">{error}</div>}
            <button className="anthem-primary-btn" onClick={handleUrlCheck} disabled={previewLoading}>
              {previewLoading ? "확인 중..." : "다음 →"}
            </button>
          </>
        )}

        {step === 2 && preview && (
          <>
            <p className="anthem-confirm-text">이 영상이 맞나요?</p>
            <div className="anthem-embed-wrap">
              <iframe width="100%" height="220" src={`https://www.youtube.com/embed/${preview.id}`} frameBorder="0" allowFullScreen style={{ borderRadius: 10 }} />
            </div>
            <div className="anthem-preview-info">
              <span className="anthem-genre">{genre}</span>
              <span className="anthem-preview-title">{preview.title}</span>
            </div>
            {desc && <p className="anthem-preview-desc">"{desc}"</p>}
            {error && <div className="anthem-error-msg">{error}</div>}
            <div className="anthem-btn-row">
              <button className="anthem-secondary-btn" onClick={() => setStep(1)}>← 수정</button>
              <button className="anthem-primary-btn" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "제출 중..." : "✓ 신청하기"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SongModal({ song, myVote, canVote, onVote, onClose }) {
  return (
    <div className="anthem-overlay" onClick={onClose}>
      <div className="anthem-modal anthem-modal-detail" onClick={e => e.stopPropagation()}>
        <div className="anthem-modal-header">
          <div>
            <span className="anthem-genre">{song.genre}</span>
            <h3 className="anthem-modal-title" style={{ marginTop: 6 }}>{song.title}</h3>
          </div>
          <button className="anthem-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="anthem-embed-wrap">
          <iframe width="100%" height="280" src={`https://www.youtube.com/embed/${song.videoId}`} frameBorder="0" allowFullScreen style={{ borderRadius: 10 }} />
        </div>
        {song.description && <p className="anthem-preview-desc">"{song.description}"</p>}
        <div className="anthem-modal-meta">
          <span className="anthem-author">{song.authorName}</span>
        </div>
        {canVote && (
          <div className="anthem-modal-votes">
            <button className={`anthem-modal-vote-btn ${myVote === "up" ? "up-active" : ""}`} onClick={() => onVote(song, "up")}>
              👍 추천 {song.upvotes || 0}
            </button>
            <button className={`anthem-modal-vote-btn ${myVote === "down" ? "down-active" : ""}`} onClick={() => onVote(song, "down")}>
              👎 비추천 {song.downvotes || 0}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}