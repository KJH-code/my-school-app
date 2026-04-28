import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "./firebase";
import { updateProfile } from "firebase/auth";
import "./Profile.css";

const CLOUDINARY_CLOUD = "doh2vmeur";
const CLOUDINARY_PRESET = "sshs_profile";

export default function Profile({ user, setActivePage }) {
  const [bio, setBio] = useState("");
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoURL, setPhotoURL] = useState(user.photoURL);
  const [stats, setStats] = useState({ anthemCount: 0, agendaCount: 0, noticesCount: 0 });

  const nameOnly = user.displayName.replace(/^[0-9]+/, "");
  const studentId = user.displayName.match(/^[0-9]+/)?.[0] || "";
  const grade = studentId[0];
  const cls = studentId[1];
  const num = studentId.slice(2);

  // 프로필 데이터 로드
  useEffect(() => {
    const loadProfile = async () => {
      const ref = doc(db, "profiles", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setBio(data.bio || "");
        if (data.photoURL) setPhotoURL(data.photoURL);
      }
    };
    loadProfile();
  }, [user.uid]);

  // 활동 통계
  useEffect(() => {
    const loadStats = async () => {
      try {
        const [anthemSnap, agendaSnap, noticesSnap] = await Promise.all([
          getDocs(query(collection(db, "anthem_songs"), where("authorId", "==", user.uid))),
          getDocs(query(collection(db, "agenda_posts"), where("authorId", "==", user.uid))),
          getDocs(query(collection(db, "notices"), where("authorId", "==", user.uid))),
        ]);
        setStats({
          anthemCount: anthemSnap.size,
          agendaCount: agendaSnap.size,
          noticesCount: noticesSnap.size,
        });
      } catch (e) { console.error(e); }
    };
    loadStats();
  }, [user.uid]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("5MB 이하 이미지만 가능해요."); return; }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_PRESET);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.secure_url) {
        setPhotoURL(data.secure_url);
        await setDoc(doc(db, "profiles", user.uid), { photoURL: data.secure_url }, { merge: true });
        await updateProfile(auth.currentUser, { photoURL: data.secure_url });
      } else {
        alert("업로드 실패. 다시 시도해주세요.");
      }
    } catch (e) {
      alert("업로드 오류: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const saveBio = async () => {
    await setDoc(doc(db, "profiles", user.uid), { bio: bioDraft }, { merge: true });
    setBio(bioDraft);
    setEditingBio(false);
  };

  return (
    <div className="profile-wrap">
      <div className="profile-header">
        <h2 className="profile-title">내 프로필</h2>
      </div>

      {/* 프로필 카드 */}
      <div className="profile-card">
        <div className="profile-photo-section">
          <div className="profile-photo-wrap">
            <img src={photoURL} alt="프로필" className="profile-photo" />
            {uploading && <div className="profile-photo-uploading">업로드 중...</div>}
          </div>
          <label className="profile-photo-btn">
            📷 사진 변경
            <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />
          </label>
        </div>

        <div className="profile-info-section">
          <div className="profile-name-row">
            <h3 className="profile-name">{nameOnly}</h3>
            <span className="profile-id-badge">{studentId}</span>
          </div>
          <div className="profile-meta">
            <div className="profile-meta-item">
              <span className="profile-meta-label">학년/반</span>
              <span className="profile-meta-value">{grade}학년 {cls}반 {parseInt(num)}번</span>
            </div>
            <div className="profile-meta-item">
              <span className="profile-meta-label">이메일</span>
              <span className="profile-meta-value">{user.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 자기소개 */}
      <div className="profile-section">
        <div className="profile-section-header">
          <h3 className="profile-section-title">📝 자기소개</h3>
          {!editingBio && (
            <button className="profile-edit-btn" onClick={() => { setBioDraft(bio); setEditingBio(true); }}>
              {bio ? "수정" : "+ 추가"}
            </button>
          )}
        </div>
        {editingBio ? (
          <div className="profile-bio-edit">
            <textarea
              className="profile-bio-textarea"
              placeholder="자기소개를 입력하세요..."
              value={bioDraft}
              onChange={(e) => setBioDraft(e.target.value)}
              maxLength={200}
              rows={4}
            />
            <div className="profile-bio-actions">
              <span className="profile-char-count">{bioDraft.length}/200</span>
              <div>
                <button className="profile-cancel-btn" onClick={() => setEditingBio(false)}>취소</button>
                <button className="profile-save-btn" onClick={saveBio}>저장</button>
              </div>
            </div>
          </div>
        ) : (
          <p className="profile-bio">{bio || <span className="profile-bio-empty">아직 자기소개가 없어요.</span>}</p>
        )}
      </div>

      {/* 활동 통계 */}
      <div className="profile-section">
        <h3 className="profile-section-title">📊 내 활동</h3>
        <div className="profile-stats">
          <div className="profile-stat" onClick={() => setActivePage("anthem")}>
            <span className="profile-stat-num">{stats.anthemCount}</span>
            <span className="profile-stat-label">신청한 기상곡</span>
          </div>
          <div className="profile-stat" onClick={() => setActivePage("agenda")}>
            <span className="profile-stat-num">{stats.agendaCount}</span>
            <span className="profile-stat-label">올린 안건</span>
          </div>
          <div className="profile-stat" onClick={() => setActivePage("notices")}>
            <span className="profile-stat-num">{stats.noticesCount}</span>
            <span className="profile-stat-label">작성한 공지</span>
          </div>
        </div>
      </div>
    </div>
  );
}