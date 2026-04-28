import { useState, useEffect } from "react";
import {
  collection, addDoc, getDocs, doc, setDoc, deleteDoc,
  query, orderBy, serverTimestamp, updateDoc, increment, where
} from "firebase/firestore";
import { db } from "./firebase";
import "./Agenda.css";

export default function Agenda({ user }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWrite, setShowWrite] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [myVotes, setMyVotes] = useState({});
  const [myReports, setMyReports] = useState({});

  const nameOnly = user?.displayName?.replace(/^[0-9]+/, "") || "";
  const isAdmin = user?.email === "26027@sshs.hs.kr";
  const fetchPosts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "agenda_posts"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

      if (user?.uid) {
        const vSnap = await getDocs(query(collection(db, "agenda_votes"), where("userId", "==", user?.uid)));
        const votes = {};
        vSnap.forEach((d) => { votes[d.data().postId] = d.data().type; });
        setMyVotes(votes);

        const rSnap = await getDocs(query(collection(db, "agenda_reports"), where("userId", "==", user?.uid)));
        const reports = {};
        rSnap.forEach((d) => { reports[d.data().postId] = true; });
        setMyReports(reports);
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchPosts(); }, []);

  const handleVote = async (postId, type) => {
    const voteId = `${user?.uid}_${postId}`;
    const voteRef = doc(db, "agenda_votes", voteId);
    const postRef = doc(db, "agenda_posts", postId);
    const current = myVotes[postId];

    if (current === type) {
      await deleteDoc(voteRef);
      await updateDoc(postRef, { [`votes.${type}`]: increment(-1) });
      setMyVotes((v) => { const n = { ...v }; delete n[postId]; return n; });
      setPosts((p) => p.map((post) => post.id === postId
        ? { ...post, votes: { ...post.votes, [type]: (post.votes?.[type] || 1) - 1 } } : post));
    } else {
      if (current) {
        await updateDoc(postRef, { [`votes.${current}`]: increment(-1), [`votes.${type}`]: increment(1) });
        setPosts((p) => p.map((post) => post.id === postId
          ? { ...post, votes: { ...post.votes, [current]: (post.votes?.[current] || 1) - 1, [type]: (post.votes?.[type] || 0) + 1 } } : post));
      } else {
        await updateDoc(postRef, { [`votes.${type}`]: increment(1) });
        setPosts((p) => p.map((post) => post.id === postId
          ? { ...post, votes: { ...post.votes, [type]: (post.votes?.[type] || 0) + 1 } } : post));
      }
      await setDoc(voteRef, { userId: user?.uid, postId, type });
      setMyVotes((v) => ({ ...v, [postId]: type }));
    }
  };

  const handleReport = async (postId) => {
    if (myReports[postId]) return;
    const reportId = `${user?.uid}_${postId}`;
    await setDoc(doc(db, "agenda_reports", reportId), { userId: user?.uid, postId });
    await updateDoc(doc(db, "agenda_posts", postId), { reportCount: increment(1) });
    setMyReports((r) => ({ ...r, [postId]: true }));
    setPosts((p) => p.map((post) => post.id === postId
      ? { ...post, reportCount: (post.reportCount || 0) + 1 } : post));
    alert("신고가 접수됐어요.");
  };

  const handleDelete = async (postId) => {
    if (!window.confirm("삭제할까요?")) return;
    await deleteDoc(doc(db, "agenda_posts", postId));
    setPosts((p) => p.filter((post) => post.id !== postId));
  };

  if (selectedPost) {
    return (
      <PostDetail
        post={selectedPost}
        user={user}
        isAdmin={isAdmin}
        myVote={myVotes[selectedPost.id]}
        myReport={myReports[selectedPost.id]}
        onVote={handleVote}
        onReport={handleReport}
        onDelete={handleDelete}
        onBack={() => { setSelectedPost(null); fetchPosts(); }}
      />
    );
  }

  return (
    <div className="agenda-wrap">
      <div className="agenda-header">
        <h2 className="agenda-title">📋 학교 안건</h2>
        <button className="agenda-write-btn" onClick={() => setShowWrite(true)}>+ 안건 올리기</button>
      </div>

      {loading && <div className="agenda-loading">불러오는 중...</div>}

      <div className="agenda-list">
        {posts.map((post) => (
          <div
            key={post.id}
            className={`agenda-card ${post.reportCount >= 5 && !isAdmin ? "blurred" : ""}`}
            onClick={() => setSelectedPost(post)}
          >
            {post.reportCount >= 5 && !isAdmin && (
              <div className="report-notice">⚠️ 신고가 많은 게시물입니다.</div>
            )}
            <div className="agenda-card-header">
              <span className="agenda-card-title">{post.title}</span>
              <span className="agenda-card-date">{post.createdAt?.toDate?.().toLocaleDateString("ko-KR")}</span>
            </div>
            <p className="agenda-card-preview">{post.content?.slice(0, 80)}...</p>
            <div className="agenda-card-footer">
              <span className="agenda-author">{post.authorName}</span>
              <div className="agenda-votes">
                <span className={`vote-badge up ${myVotes[post.id] === "up" ? "active" : ""}`}>👍 {post.votes?.up || 0}</span>
                <span className={`vote-badge down ${myVotes[post.id] === "down" ? "active" : ""}`}>👎 {post.votes?.down || 0}</span>
                <span className="comment-badge">💬 {post.commentCount || 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showWrite && (
        <WriteModal
          user={user}
          nameOnly={nameOnly}
          onClose={() => setShowWrite(false)}
          onSubmit={() => { setShowWrite(false); fetchPosts(); }}
        />
      )}
    </div>
  );
}

function PostDetail({ post, user, isAdmin, myVote, myReport, onVote, onReport, onDelete, onBack }) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const nameOnly = user?.displayName?.replace(/^[0-9]+/, "") || "";

  useEffect(() => {
    const fetchComments = async () => {
      const q = query(
        collection(db, "agenda_comments"),
        where("postId", "==", post.id),
        orderBy("createdAt", "asc")
      );
      const snap = await getDocs(q);
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    fetchComments();
  }, [post.id]);

  const handleComment = async () => {
    if (!commentText.trim()) return;
    await addDoc(collection(db, "agenda_comments"), {
      postId: post.id,
      authorId: user?.uid,
      authorName: nameOnly,
      content: commentText.trim(),
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "agenda_posts", post.id), { commentCount: increment(1) });
    setComments((c) => [...c, { authorName: nameOnly, content: commentText.trim(), createdAt: null }]);
    setCommentText("");
  };

  const handleDeleteComment = async (commentId) => {
    await deleteDoc(doc(db, "agenda_comments", commentId));
    setComments((c) => c.filter((cm) => cm.id !== commentId));
    await updateDoc(doc(db, "agenda_posts", post.id), { commentCount: increment(-1) });
  };

  return (
    <div className="agenda-wrap">
      <button className="back-btn" onClick={onBack}>← 목록으로</button>
      <div className="post-detail">
        <div className="post-detail-header">
          <h2 className="post-title">{post.title}</h2>
          <div className="post-meta">
            <span>{post.authorName}</span>
            <span>{post.createdAt?.toDate?.().toLocaleDateString("ko-KR")}</span>
          </div>
        </div>
        <div className="post-content">{post.content}</div>

        <div className="post-actions">
          <button className={`vote-btn up ${myVote === "up" ? "active" : ""}`} onClick={() => onVote(post.id, "up")}>
            👍 찬성 {post.votes?.up || 0}
          </button>
          <button className={`vote-btn down ${myVote === "down" ? "active" : ""}`} onClick={() => onVote(post.id, "down")}>
            👎 반대 {post.votes?.down || 0}
          </button>
          {!myReport && post.authorId !== user?.uid && (
            <button className="report-btn" onClick={() => onReport(post.id)}>🚨 신고</button>
          )}
          {(isAdmin || post.authorId === user?.uid) && (
            <button className="delete-btn" onClick={() => onDelete(post.id)}>🗑️ 삭제</button>
          )}
        </div>

        <div className="comments-section">
          <h3 className="comments-title">댓글 {comments.length}개</h3>
          {comments.map((cm, i) => (
            <div key={i} className="comment-item">
              <div className="comment-header">
                <span className="comment-author">{cm.authorName}</span>
                <span className="comment-date">{cm.createdAt?.toDate?.().toLocaleDateString("ko-KR") || "방금"}</span>
                {(isAdmin || cm.authorId === user?.uid) && (
                  <button className="comment-delete" onClick={() => handleDeleteComment(cm.id)}>삭제</button>
                )}
              </div>
              <p className="comment-content">{cm.content}</p>
            </div>
          ))}
          <div className="comment-input-wrap">
            <input
              className="comment-input"
              placeholder="댓글 달기..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleComment()}
            />
            <button className="comment-submit" onClick={handleComment}>등록</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WriteModal({ user, nameOnly, onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    await addDoc(collection(db, "agenda_posts"), {
      title: title.trim(),
      content: content.trim(),
      authorId: user?.uid,
      authorName: nameOnly,
      createdAt: serverTimestamp(),
      votes: { up: 0, down: 0 },
      commentCount: 0,
      reportCount: 0,
    });
    setSubmitting(false);
    onSubmit();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box agenda-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">📋 안건 올리기</h3>
        <input
          className="agenda-input"
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="agenda-textarea"
          placeholder="내용을 입력하세요..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
        />
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>취소</button>
          <button className="modal-confirm" onClick={handleSubmit} disabled={submitting || !title.trim() || !content.trim()}>
            {submitting ? "올리는 중..." : "올리기"}
          </button>
        </div>
      </div>
    </div>
  );
}