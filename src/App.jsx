import { signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider } from "firebase/auth";
import { auth, provider } from "./firebase";
import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import "./App.css";
import Grades from "./Grades";
import Anthem from "./Anthem";
import Timetable from "./Timetable";
import Notices from "./Notices";
import Attendance from "./Attendance";
function App() {
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState("home");

  useEffect(() => {
    onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
  }, []);

  const login = async () => {
    const result = await signInWithPopup(auth, provider);
  // Sheets 접근용 OAuth 토큰 저장
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      sessionStorage.setItem("sheets_token", credential.accessToken);
    }
  };
  const logout = () => signOut(auth);

  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">
            <span className="logo-icon">🏫</span>
          </div>
          <h1 className="login-title">SSHS Portal</h1>
          <p className="login-subtitle">서울과학고등학교 학생 포털</p>
          <button className="login-btn" onClick={login}>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            학교 계정으로 로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar user={user} activePage={activePage} setActivePage={setActivePage} onLogout={logout} />
      <main className="main-content">
        <PageContent activePage={activePage} user={user} />
      </main>
    </div>
  );
}

function PageContent({ activePage, user }) {
  const pages = {
    timetable: { title: "시간표", emoji: "📅" },
    grades: { title: "성적 계산", emoji: "📊" },
    anthem: { title: "기상곡 신청", emoji: "🎵" },
    notices: { title: "공지사항", emoji: "📢" },
    agenda: { title: "학교 안건", emoji: "📋" },
  };

  if (activePage === "home") {
    return (
      <div className="home-page">
        <h1 className="home-greeting">안녕하세요, {user.displayName.replace(/^[0-9]+/, "")}님 👋</h1>
        <p className="home-sub">왼쪽 메뉴에서 기능을 선택하세요.</p>
      </div>
    );
  }
  if (activePage === "grades")
     return <Grades />;
  if (activePage === "anthem") 
    return <Anthem user={user} />;
  if (activePage === "timetable")
     return <Timetable user={user} />;
  if (activePage === "notices") 
    return <Notices user={user} />;
if (activePage === "attendance") 
  return <Attendance user={user} />;
  const page = pages[activePage];
  return (
    <div className="placeholder-page">
      <span className="placeholder-emoji">{page?.emoji}</span>
      <h2 className="placeholder-title">{page?.title}</h2>
      <p className="placeholder-desc">준비 중입니다.</p>
    </div>
  );
}

export default App;