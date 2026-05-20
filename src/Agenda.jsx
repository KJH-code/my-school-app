import { useState, useEffect } from "react";
import {
  collection, addDoc, getDocs, doc, setDoc, deleteDoc,
  query, orderBy, serverTimestamp, updateDoc, increment, where, onSnapshot
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

  const isAdmin = user?.email === "26027@sshs.hs.kr";

  // 글 목록 실시간 구독
  useEffect(() => {
    const q = query(collection(db, "agenda_posts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("글 구독 실패", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 내 투표/신고 실시간 구독 (로그인한 경우만)
  useEffect(() => {
    if (!user?.uid) {
      setMyVotes({});
      setMyReports({});
      return;
    }
    const vQ = query(collection(db, "agenda_votes"), where("userId", "==", user.uid));
    const rQ = query(collection(db, "agenda_reports"), where("userId", "==", user.uid));

    const unsubV = onSnapshot(vQ, (snap) => {
      const votes = {};
      snap.forEach((d) => { votes[d.data().postId] = d.data().type; });
      setMyVotes(votes);
    });
    const unsubR = onSnapshot(rQ, (snap) => {
      const reports = {};
      snap.forEach((d) => { reports[d.data().postId] = true; });
      setMyReports(reports);
    });
    return () => { unsubV(); unsubR(); };
  }, [user?.uid]);

  const handleVote = async (postId, type) => {
    if (!user?.uid) return;
    const voteId = `${user?.uid}_${postId}`;
    const voteRef = doc(db, "agenda_votes", voteId);
    const postRef = doc(db, "agenda_posts", postId);
    const current = myVotes[postId];

    const prevVotes = myVotes;
    const prevPosts = posts;

    if (current === type) {
      setMyVotes((v) => { const n = { ...v }; delete n[postId]; return n; });
      setPosts((p) => p.map((post) => post.id === postId
        ? { ...post, votes: { ...post.votes, [type]: Math.max(0, (post.votes?.[type] || 1) - 1) } }
        : post));
    } else if (current) {
      setMyVotes((v) => ({ ...v, [postId]: type }));
      setPosts((p) => p.map((post) => post.id === postId
        ? { ...post, votes: {
            ...post.votes,
            [current]: Math.max(0, (post.votes?.[current] || 1) - 1),
            [type]: (post.votes?.[type] || 0) + 1
          } }
        : post));
    } else {
      setMyVotes((v) => ({ ...v, [postId]: type }));
      setPosts((p) => p.map((post) => post.id === postId
        ? { ...post, votes: { ...post.votes, [type]: (post.votes?.[type] || 0) + 1 } }
        : post));
    }

    try {
      if (current === type) {
        await deleteDoc(voteRef);
        await updateDoc(postRef, { [`votes.${type}`]: increment(-1) });
      } else if (current) {
        await updateDoc(postRef, {
          [`votes.${current}`]: increment(-1),
          [`votes.${type}`]: increment(1)
        });
        await setDoc(voteRef, { userId: user?.uid, postId, type });
      } else {
        await updateDoc(postRef, { [`votes.${type}`]: increment(1) });
        await setDoc(voteRef, { userId: user?.uid, postId, type });
      }
    } catch (e) {
      console.error("투표 실패", e);
      setMyVotes(prevVotes);
      setPosts(prevPosts);
      alert("투표에 실패했어요. 다시 시도해주세요.");
    }
  };

  const handleReport = async (postId) => {
    if (myReports[postId]) return;
    const reportId = `${user?.uid}_${postId}`;

    const prevReports = myReports;
    const prevPosts = posts;
    setMyReports((r) => ({ ...r, [postId]: true }));
    setPosts((p) => p.map((post) => post.id === postId
      ? { ...post, reportCount: (post.reportCount || 0) + 1 }
      : post));

    try {
      await setDoc(doc(db, "agenda_reports", reportId), { userId: user?.uid, postId });
      await updateDoc(doc(db, "agenda_posts", postId), { reportCount: increment(1) });
      alert("신고가 접수됐어요.");
    } catch (e) {
      console.error("신고 실패", e);
      setMyReports(prevReports);
      setPosts(prevPosts);
      alert("신고에 실패했어요. 다시 시도해주세요.");
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm("삭제할까요?")) return;

    const prevPosts = posts;
    setPosts((p) => p.filter((post) => post.id !== postId));
    if (selectedPost?.id === postId) setSelectedPost(null);

    try {
      await deleteDoc(doc(db, "agenda_posts", postId));
    } catch (e) {
      console.error("삭제 실패", e);
      setPosts(prevPosts);
      alert("삭제에 실패했어요.");
    }
  };

  if (selectedPost) {
    const livePost = posts.find((p) => p.id === selectedPost.id) || selectedPost;
    return (
      <PostDetail
        post={livePost}
        user={user}
        isAdmin={isAdmin}
        myVote={myVotes[livePost.id]}
        myReport={myReports[livePost.id]}
        onVote={handleVote}
        onReport={handleReport}
        onDelete={handleDelete}
        onBack={() => setSelectedPost(null)}
        setPosts={setPosts}
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
          onClose={() => setShowWrite(false)}
          onSubmit={() => setShowWrite(false)}
        />
      )}
    </div>
  );
}

function PostDetail({ post, user, isAdmin, myVote, myReport, onVote, onReport, onDelete, onBack, setPosts }) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");

  // 댓글 실시간 구독
  useEffect(() => {
    const q = query(
      collection(db, "agenda_comments"),
      where("postId", "==", post.id),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [post.id]);

  const handleComment = async () => {
    if (!commentText.trim()) return;
    const text = commentText.trim();
    setCommentText("");

    const tempId = `temp_${Date.now()}`;
    setComments((c) => [...c, { id: tempId, authorName: user.displayName, authorId: user?.uid, content: text, createdAt: null }]);
    setPosts((p) => p.map((pp) => pp.id === post.id
      ? { ...pp, commentCount: (pp.commentCount || 0) + 1 }
      : pp));

    try {
      const docRef = await addDoc(collection(db, "agenda_comments"), {
        postId: post.id,
        authorId: user?.uid,
        authorName: user.displayName,
        content: text,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "agenda_posts", post.id), { commentCount: increment(1) });
      setComments((c) => c.map((cm) => cm.id === tempId ? { ...cm, id: docRef.id } : cm));
    } catch (e) {
      console.error("댓글 실패", e);
      setComments((c) => c.filter((cm) => cm.id !== tempId));
      setPosts((p) => p.map((pp) => pp.id === post.id
        ? { ...pp, commentCount: Math.max(0, (pp.commentCount || 1) - 1) }
        : pp));
      alert("댓글 등록에 실패했어요.");
    }
  };

  const handleDeleteComment = async (commentId) => {
    const prev = comments;
    setComments((c) => c.filter((cm) => cm.id !== commentId));
    setPosts((p) => p.map((pp) => pp.id === post.id
      ? { ...pp, commentCount: Math.max(0, (pp.commentCount || 1) - 1) }
      : pp));

    try {
      await deleteDoc(doc(db, "agenda_comments", commentId));
      await updateDoc(doc(db, "agenda_posts", post.id), { commentCount: increment(-1) });
    } catch (e) {
      console.error("댓글 삭제 실패", e);
      setComments(prev);
      setPosts((p) => p.map((pp) => pp.id === post.id
        ? { ...pp, commentCount: (pp.commentCount || 0) + 1 }
        : pp));
    }
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
          {comments.map((cm) => (
            <div key={cm.id} className="comment-item">
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

function WriteModal({ user, onClose, onSubmit }) {
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
      authorName: user.displayName,
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