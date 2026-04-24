import { useState, useEffect, useCallback } from "react";
import {
  collection, addDoc, getDocs, doc, deleteDoc,
  query, orderBy, limit, startAfter, where,
  serverTimestamp, getCountFromServer
} from "firebase/firestore";
import { db } from "./firebase";

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

// 관리자 목록 — Firestore admins 컬렉션으로 관리
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
  const [cursors, setCursors] = useState([null]); // cursors[i] = startAfter for page i+1
  const [filterTag, setFilterTag] = useState("전체");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showWrite, setShowWrite] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);

  useEffect(() => {
    checkAdmin(user.uid).then(setIsAdmin);
  }, [user.uid]);

  const loadPage = useCallback(async (pageNum, tag, cursorSnap) => {
    setLoading(true);
    try {
      let q;
      const base = tag === "전체"
        ? collection(db, "notices")
        : null;

      // 전체 카운트
      const countQ = tag === "전체"
        ? query(collection(db, "notices"))
        : query(collection(db, "notices"), where("tag", "==", tag));
      const countSnap = await getCountFromServer(countQ);
      const total = countSnap.data().count;
      setTotalPages(Math.max(1, Math.ceil(total / PAGE_SIZE)));

      // 데이터 쿼리
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
      setNotices(snap.docs.map(d => ({ id: d.id, ...d.data(), _snap: d })));

      // 다음 페이지 커서 저장
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
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>📢 공지사항</h2>
          <p style={s.subtitle}>학교 공지, 행사, 가정통신문 등을 확인하세요.</p>
        </div>
        {isAdmin && (
          <button style={s.writeBtn} onClick={() => setShowWrite(true)}>
            ✏️ 공지 작성
          </button>
        )}
      </div>

      {/* 태그 필터 */}
      <div style={s.tagRow}>
        {TAGS.map(tag => (
          <button
            key={tag}
            style={{
              ...s.tagBtn,
              ...(filterTag === tag ? s.tagBtnActive : {}),
              ...(tag !== "전체" && filterTag === tag ? { background: TAG_COLORS[tag]?.bg, color: TAG_COLORS[tag]?.color, borderColor: TAG_COLORS[tag]?.color } : {}),
            }}
            onClick={() => setFilterTag(tag)}
          >{tag}</button>
        ))}
      </div>

      {/* 공지 목록 */}
      {loading ? (
        <div style={s.empty}>불러오는 중...</div>
      ) : notices.length === 0 ? (
        <div style={s.empty}>공지사항이 없어요.</div>
      ) : (
        <div style={s.list}>
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

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={s.pagination}>
          <button style={s.pageBtn} disabled={page === 1} onClick={() => goToPage(page - 1)}>←</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              style={{ ...s.pageBtn, ...(p === page ? s.pageBtnActive : {}) }}
              onClick={() => goToPage(p)}
            >{p}</button>
          ))}
          <button style={s.pageBtn} disabled={page === totalPages} onClick={() => goToPage(page + 1)}>→</button>
        </div>
      )}

      {/* 공지 작성 모달 */}
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

      {/* 공지 상세 모달 */}
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

// ── 공지 카드 ─────────────────────────────────────────────
function NoticeCard({ notice, num, onClick }) {
  const tagStyle = TAG_COLORS[notice.tag] || { bg: "#1a2032", color: "#6b7494" };
  const date = notice.createdAt?.toDate?.()?.toLocaleDateString("ko-KR") || "";

  return (
    <div style={s.card} onClick={onClick}>
      <div style={s.cardLeft}>
        <div style={s.cardTop}>
          <span style={{ ...s.tag, background: tagStyle.bg, color: tagStyle.color }}>
            {notice.tag}
          </span>
          {notice.imageUrl && <span style={s.hasImg}>🖼</span>}
          {notice.link && <span style={s.hasImg}>🔗</span>}
        </div>
        <span style={s.cardTitle}>{notice.title}</span>
        <span style={s.cardMeta}>{notice.authorName} · {date}</span>
      </div>
      <span style={s.cardNum}>#{num}</span>
    </div>
  );
}

// ── 작성 모달 ─────────────────────────────────────────────
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
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <h3 style={s.modalTitle}>공지 작성</h3>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* 태그 */}
        <div style={s.field}>
          <label style={s.label}>태그</label>
          <div style={s.tagGrid}>
            {TAGS.filter(t => t !== "전체").map(t => {
              const ts = TAG_COLORS[t];
              return (
                <button
                  key={t}
                  style={{
                    ...s.tagSelectBtn,
                    ...(tag === t ? { background: ts.bg, color: ts.color, borderColor: ts.color } : {}),
                  }}
                  onClick={() => setTag(t)}
                >{t}</button>
              );
            })}
          </div>
        </div>

        {/* 제목 */}
        <div style={s.field}>
          <label style={s.label}>제목</label>
          <input style={s.input} placeholder="공지 제목" value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        {/* 내용 */}
        <div style={s.field}>
          <label style={s.label}>내용</label>
          <textarea
            style={{ ...s.input, minHeight: 140, resize: "vertical" }}
            placeholder="공지 내용을 입력하세요."
            value={content}
            onChange={e => setContent(e.target.value)}
          />
        </div>

        {/* 이미지 URL */}
        <div style={s.field}>
          <label style={s.label}>이미지 URL <span style={s.optional}>(선택)</span></label>
          <input style={s.input} placeholder="https://..." value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
        </div>

        {/* 링크 */}
        <div style={s.field}>
          <label style={s.label}>링크 <span style={s.optional}>(선택)</span></label>
          <input style={s.input} placeholder="https://..." value={link} onChange={e => setLink(e.target.value)} />
        </div>

        {error && <div style={s.errorMsg}>{error}</div>}
        <button
          style={{ ...s.primaryBtn, ...(submitting ? s.btnDisabled : {}) }}
          onClick={handleSubmit}
          disabled={submitting}
        >{submitting ? "저장 중..." : "✓ 게시하기"}</button>
      </div>
    </div>
  );
}

// ── 상세 모달 ─────────────────────────────────────────────
function DetailModal({ notice, isAdmin, onDelete, onClose }) {
  const tagStyle = TAG_COLORS[notice.tag] || { bg: "#1a2032", color: "#6b7494" };
  const date = notice.createdAt?.toDate?.()?.toLocaleString("ko-KR") || "";

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div style={{ flex: 1 }}>
            <span style={{ ...s.tag, background: tagStyle.bg, color: tagStyle.color, marginBottom: 10, display: "inline-block" }}>
              {notice.tag}
            </span>
            <h3 style={{ ...s.modalTitle, marginTop: 6, fontSize: 20 }}>{notice.title}</h3>
            <span style={s.detailMeta}>{notice.authorName} · {date}</span>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* 이미지 */}
        {notice.imageUrl && (
          <img
            src={notice.imageUrl}
            alt=""
            style={s.detailImg}
            onError={e => e.target.style.display = "none"}
          />
        )}

        {/* 내용 */}
        <div style={s.detailContent}>{notice.content}</div>

        {/* 링크 */}
        {notice.link && (
          <a href={notice.link} target="_blank" rel="noopener noreferrer" style={s.detailLink}>
            🔗 관련 링크 바로가기 →
          </a>
        )}

        {/* 관리자 삭제 */}
        {isAdmin && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #1e2535" }}>
            <button style={s.deleteBtn} onClick={onDelete}>🗑 공지 삭제</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 스타일 ────────────────────────────────────────────────
const s = {
  container: { maxWidth: 800, margin: "0 auto", padding: "0 0 60px", fontFamily: "'Noto Sans KR', sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 700, color: "#e8eaf2", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#6b7494" },
  writeBtn: { background: "#4f8ef7", border: "none", color: "#fff", padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontFamily: "'Noto Sans KR', sans-serif", flexShrink: 0 },

  tagRow: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 },
  tagBtn: { background: "#1a2032", border: "1px solid #1e2535", color: "#6b7494", padding: "5px 14px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontFamily: "'Noto Sans KR', sans-serif", transition: "all 0.15s" },
  tagBtnActive: { background: "rgba(79,142,247,0.15)", color: "#4f8ef7", borderColor: "#4f8ef7" },

  empty: { textAlign: "center", color: "#3d4461", padding: "60px 0", fontSize: 14 },

  list: { display: "flex", flexDirection: "column", gap: 6 },
  card: { background: "#161b27", border: "1px solid #1e2535", borderRadius: 12, padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, transition: "border-color 0.2s, background 0.2s" },
  cardLeft: { flex: 1, minWidth: 0 },
  cardTop: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  tag: { fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 600 },
  hasImg: { fontSize: 13 },
  cardTitle: { display: "block", fontSize: 15, fontWeight: 600, color: "#e8eaf2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 },
  cardMeta: { fontSize: 12, color: "#6b7494" },
  cardNum: { fontSize: 11, color: "#3d4461", fontFamily: "monospace", flexShrink: 0 },

  pagination: { display: "flex", justifyContent: "center", gap: 6, marginTop: 28 },
  pageBtn: { background: "#1a2032", border: "1px solid #1e2535", color: "#6b7494", width: 36, height: 36, borderRadius: 8, cursor: "pointer", fontSize: 14, fontFamily: "monospace", transition: "all 0.15s" },
  pageBtnActive: { background: "rgba(79,142,247,0.15)", color: "#4f8ef7", borderColor: "#4f8ef7" },

  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "#161b27", border: "1px solid #1e2535", borderRadius: 16, padding: 28, width: "100%", maxHeight: "90vh", overflowY: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#e8eaf2", margin: 0 },
  closeBtn: { background: "none", border: "none", color: "#6b7494", fontSize: 20, cursor: "pointer", flexShrink: 0 },

  field: { marginBottom: 16 },
  label: { display: "block", fontSize: 12, color: "#6b7494", marginBottom: 7, fontWeight: 500 },
  optional: { color: "#3d4461", fontWeight: 400 },
  input: { width: "100%", background: "#0f1117", border: "1px solid #1e2535", borderRadius: 8, padding: "10px 14px", color: "#e8eaf2", fontSize: 14, fontFamily: "'Noto Sans KR', sans-serif", outline: "none", boxSizing: "border-box" },
  tagGrid: { display: "flex", flexWrap: "wrap", gap: 6 },
  tagSelectBtn: { background: "#0f1117", border: "1px solid #1e2535", color: "#6b7494", padding: "5px 14px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontFamily: "'Noto Sans KR', sans-serif", transition: "all 0.15s" },

  errorMsg: { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 14 },
  primaryBtn: { width: "100%", background: "#4f8ef7", border: "none", color: "#fff", padding: "12px", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif" },
  btnDisabled: { opacity: 0.5, cursor: "not-allowed" },

  detailMeta: { fontSize: 12, color: "#6b7494", display: "block", marginTop: 4 },
  detailImg: { width: "100%", borderRadius: 10, marginBottom: 16, maxHeight: 400, objectFit: "cover" },
  detailContent: { fontSize: 15, color: "#c8cad8", lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 16 },
  detailLink: { display: "inline-block", color: "#4f8ef7", fontSize: 14, textDecoration: "none", background: "rgba(79,142,247,0.1)", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(79,142,247,0.3)" },
  deleteBtn: { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "'Noto Sans KR', sans-serif" },
};
