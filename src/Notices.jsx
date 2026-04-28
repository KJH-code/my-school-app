import { useState, useEffect, useCallback } from "react";
import {
  collection, addDoc, getDocs, doc, deleteDoc,
  query, orderBy, limit, startAfter, where,
  serverTimestamp, getCountFromServer
} from "firebase/firestore";
import { db } from "./firebase";
import "./Notices.css";

const TAGS = ["전체", "공지", "가정통신문", "행사", "홍보", "긴급", "학생회", "동아리"];
const TAG_COLORS = {
  "공지":     { bg: "rgba(79,142,247,0.15)",  color: "#4f8ef7" },
  "가정통신문": { bg: "rgba(251,191,36,0.15)",  color: "#fbbf24" },
  "행사":     { bg: "rgba(74,222,128,0.15)",  color: "#4ade80" },
  "홍보":     { bg: "rgba(196,132,252,0.15)", color: "#c084fc" },
  "긴급":     { bg: "rgba(248,113,113,0.15)", color: "#f87171" },
  "학생회":   { bg: "rgba(45,212,191,0.15)",  color: "#2dd4bf" },
  "동아리":   { bg: "rgba(249,115,22,0.15)",  color: "#f97316" },
};

const PAGE_SIZE = 10;

async function checkAdmin(uid) {
  try {
    const snap = await getDocs(query(collection(db, "admins"), where("uid", "==", uid)));
    return !snap.empty;
  } catch { return false; }
}

export default function Notices({ user }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cursors, setCursors] = useState([null]);
  const [filterTag, setFilterTag] = useState("전체");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showWrite, setShowWrite] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);
  useEffect(() => {
    if (user?.uid) {
      checkAdmin(user.uid).then(setIsAdmin);
    } else {
      setIsAdmin(false);
    }
  }, [user?.uid]);
  const loadPage = useCallback(async (pageNum, tag, cursorSnap) => {
    setLoading(true);
    try {
      const countQ = tag === "전체"
        ? query(collection(db, "notices"))
        : query(collection(db, "notices"), where("tag", "==", tag));
      const countSnap = await getCountFromServer(countQ);
      const total = countSnap.data().count;
      setTotalPages(Math.max(1, Math.ceil(total / PAGE_SIZE)));

      let q;
      if (tag === "전체") {
        q = cursorSnap
          ? query(collection(db, "notices"), orderBy("createdAt", "desc"), startAfter(cursorSnap), limit(PAGE_SIZE))
          : query(collection(db, "notices"), orderBy("createdAt", "desc"), limit(PAGE_SIZE));
      } else {
        q = cursorSnap
          ? query(collection(db, "notices"), where("tag", "==", tag), orderBy("createdAt", "desc"), startAfter(cursorSnap), limit(PAGE_SIZE))
          : query(collection(db, "notices"), where("tag", "==", tag), orderBy("createdAt", "desc"), limit(PAGE_SIZE));
      }

      const snap = await getDocs(q);
      setNotices(snap.docs.map(d => ({ id: d.id, ...d.data() })));

      if (snap.docs.length === PAGE_SIZE) {
        setCursors(prev => {
          const next = [...prev];
          next[pageNum] = snap.docs[snap.docs.length - 1];
          return next;
        });
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    setPage(1);
    setCursors([null]);
    loadPage(1, filterTag, null);
  }, [filterTag, loadPage]);

  const goToPage = (newPage) => {
    const cursor = cursors[newPage - 1] ?? null;
    setPage(newPage);
    loadPage(newPage, filterTag, cursor);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("정말 삭제할까요?")) return;
    await deleteDoc(doc(db, "notices", id));
    loadPage(page, filterTag, cursors[page - 1] ?? null);
    setSelectedNotice(null);
  };

  return (
    <div className="notices-wrap">
      <div className="notices-header">
        <div>
          <h2 className="notices-title">📢 공지사항</h2>
          <p className="notices-subtitle">학교 공지, 행사, 가정통신문 등을 확인하세요.</p>
        </div>
        {isAdmin && (
          <button className="notices-write-btn" onClick={() => setShowWrite(true)}>✏️ 공지 작성</button>
        )}
      </div>

      <div className="notices-tag-row">
        {TAGS.map(tag => {
          const ts = TAG_COLORS[tag];
          const isActive = filterTag === tag;
          return (
            <button
              key={tag}
              className={`notices-tag-btn ${isActive ? "active" : ""}`}
              style={isActive && tag !== "전체" ? { background: ts.bg, color: ts.color, borderColor: ts.color } : {}}
              onClick={() => setFilterTag(tag)}
            >{tag}</button>
          );
        })}
      </div>

      {loading ? (
        <div className="notices-empty">불러오는 중...</div>
      ) : notices.length === 0 ? (
        <div className="notices-empty">공지사항이 없어요.</div>
      ) : (
        <div className="notices-list">
          {notices.map((notice, idx) => (
            <NoticeCard
              key={notice.id}
              notice={notice}
              num={(page - 1) * PAGE_SIZE + idx + 1}
              onClick={() => setSelectedNotice(notice)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="notices-pagination">
          <button className="notices-page-btn" disabled={page === 1} onClick={() => goToPage(page - 1)}>←</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} className={`notices-page-btn ${p === page ? "active" : ""}`} onClick={() => goToPage(p)}>{p}</button>
          ))}
          <button className="notices-page-btn" disabled={page === totalPages} onClick={() => goToPage(page + 1)}>→</button>
        </div>
      )}

      {showWrite && (
        <WriteModal
          user={user}
          onClose={() => setShowWrite(false)}
          onSubmitted={() => {
            setShowWrite(false);
            setPage(1);
            setCursors([null]);
            loadPage(1, filterTag, null);
          }}
        />
      )}

      {selectedNotice && (
        <DetailModal
          notice={selectedNotice}
          isAdmin={isAdmin}
          onDelete={() => handleDelete(selectedNotice.id)}
          onClose={() => setSelectedNotice(null)}
        />
      )}
    </div>
  );
}

function NoticeCard({ notice, num, onClick }) {
  const tagStyle = TAG_COLORS[notice.tag] || { bg: "var(--surface)", color: "var(--text-sub)" };
  const date = notice.createdAt?.toDate?.()?.toLocaleDateString("ko-KR") || "";

  return (
    <div className="notice-card" onClick={onClick}>
      <div className="notice-card-left">
        <div className="notice-card-top">
          <span className="notice-tag" style={{ background: tagStyle.bg, color: tagStyle.color }}>{notice.tag}</span>
          {notice.imageUrl && <span className="notice-has-img">🖼</span>}
          {notice.link && <span className="notice-has-img">🔗</span>}
        </div>
        <span className="notice-card-title">{notice.title}</span>
        <span className="notice-card-meta">{notice.authorName} · {date}</span>
      </div>
      <span className="notice-card-num">#{num}</span>
    </div>
  );
}

function WriteModal({ user, onClose, onSubmitted }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tag, setTag] = useState("공지");
  const [imageUrl, setImageUrl] = useState("");
  const [link, setLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!title.trim()) { setError("제목을 입력해주세요."); return; }
    if (!content.trim()) { setError("내용을 입력해주세요."); return; }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "notices"), {
        title: title.trim(),
        content: content.trim(),
        tag,
        imageUrl: imageUrl.trim(),
        link: link.trim(),
        authorId: user.uid,
        authorName: user.displayName,
        createdAt: serverTimestamp(),
      });
      onSubmitted();
    } catch (e) {
      setError("저장 중 오류가 발생했어요.");
      setSubmitting(false);
    }
  };

  return (
    <div className="notices-overlay" onClick={onClose}>
      <div className="notices-modal" onClick={e => e.stopPropagation()}>
        <div className="notices-modal-header">
          <h3 className="notices-modal-title">공지 작성</h3>
          <button className="notices-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="notices-field">
          <label className="notices-label">태그</label>
          <div className="notices-tag-grid">
            {TAGS.filter(t => t !== "전체").map(t => {
              const ts = TAG_COLORS[t];
              const isActive = tag === t;
              return (
                <button
                  key={t}
                  className={`notices-tag-select-btn ${isActive ? "active" : ""}`}
                  style={isActive ? { background: ts.bg, color: ts.color, borderColor: ts.color } : {}}
                  onClick={() => setTag(t)}
                >{t}</button>
              );
            })}
          </div>
        </div>

        <div className="notices-field">
          <label className="notices-label">제목</label>
          <input className="notices-input" placeholder="공지 제목" value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        <div className="notices-field">
          <label className="notices-label">내용</label>
          <textarea className="notices-input notices-textarea" placeholder="공지 내용을 입력하세요." value={content} onChange={e => setContent(e.target.value)} />
        </div>

        <div className="notices-field">
          <label className="notices-label">이미지 URL <span className="notices-optional">(선택)</span></label>
          <input className="notices-input" placeholder="https://..." value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
        </div>

        <div className="notices-field">
          <label className="notices-label">링크 <span className="notices-optional">(선택)</span></label>
          <input className="notices-input" placeholder="https://..." value={link} onChange={e => setLink(e.target.value)} />
        </div>

        {error && <div className="notices-error-msg">{error}</div>}
        <button className="notices-primary-btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "저장 중..." : "✓ 게시하기"}
        </button>
      </div>
    </div>
  );
}

function DetailModal({ notice, isAdmin, onDelete, onClose }) {
  const tagStyle = TAG_COLORS[notice.tag] || { bg: "var(--surface)", color: "var(--text-sub)" };
  const date = notice.createdAt?.toDate?.()?.toLocaleString("ko-KR") || "";

  return (
    <div className="notices-overlay" onClick={onClose}>
      <div className="notices-modal notices-modal-detail" onClick={e => e.stopPropagation()}>
        <div className="notices-modal-header">
          <div style={{ flex: 1 }}>
            <span className="notice-tag" style={{ background: tagStyle.bg, color: tagStyle.color }}>{notice.tag}</span>
            <h3 className="notices-modal-title" style={{ marginTop: 8 }}>{notice.title}</h3>
            <span className="notices-detail-meta">{notice.authorName} · {date}</span>
          </div>
          <button className="notices-close-btn" onClick={onClose}>✕</button>
        </div>

        {notice.imageUrl && (
          <img src={notice.imageUrl} alt="" className="notices-detail-img" onError={e => e.target.style.display = "none"} />
        )}

        <div className="notices-detail-content">{notice.content}</div>

        {notice.link && (
          <a href={notice.link} target="_blank" rel="noopener noreferrer" className="notices-detail-link">
            🔗 관련 링크 바로가기 →
          </a>
        )}

        {isAdmin && (
          <div className="notices-admin-actions">
            <button className="notices-delete-btn" onClick={onDelete}>🗑 공지 삭제</button>
          </div>
        )}
      </div>
    </div>
  );
}