import { signInWithCustomToken, signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import "./App.css";
import Grades from "./Grades";
import Anthem from "./Anthem";
import Timetable from "./Timetable";
import Notices from "./Notices";
import Attendance from "./Attendance";
import Agenda from "./Agenda";
import Meal from "./Meal";
import Profile from "./Profile";
import Volunteer from "./Volunteer";
import Calendar from "./Calendar";   // ★추가

const Icon = ({ name, size = 24 }) => {
  const icons = {
    music: <><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
    run: <><circle cx="13" cy="4" r="2"/><path d="M4 22l5-9 4 2-2 4 5-1m-3-9l3 3-3 4"/></>,
    clipboard: <><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></>,
    arrow: <path d="M5 12h14M13 5l7 7-7 7"/>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    chart: <><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></>,
    utensils: <><path d="M3 2v7c0 1.1.9 2 2 2h2v11M7 2v20M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></>,
    zap: <path d="M13 2L3 14h9l-1 8 10-12h-9z"/>,
    leaf: <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

// OAuth client ID (공개돼도 되는 정보)
const GOOGLE_CLIENT_ID = "493777626300-rdavqmp61i5g1b3u63rm8dkha6elj66s.apps.googleusercontent.com";

// 전역 로그인 함수 — Google OAuth 페이지로 통째로 이동
export const requireLogin = () => {
  if (auth.currentUser) return auth.currentUser;

  const redirectUri = `${window.location.origin}/api/auth/callback`;

  const scope = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/spreadsheets',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent',
    hd: 'sshs.hs.kr',
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
};

function App() {
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState("home");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const authError = params.get('auth_error');

    if (token) {
      signInWithCustomToken(auth, token)
        .catch((err) => console.error('Custom token sign-in failed', err))
        .finally(() => {
          window.history.replaceState({}, '', window.location.pathname);
        });
    } else if (authError) {
      alert(`로그인 실패: ${authError}`);
      window.history.replaceState({}, '', window.location.pathname);
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const logout = () => signOut(auth);

  const pageLabels = {
    home: "홈", timetable: "시간표", grades: "성적 계산",
    anthem: "기상곡 신청", notices: "공지사항", agenda: "학교 안건",
    attendance: "이석/외출 현황", meal: "급식표",
    calendar: "학사일정",   // ★추가
    volunteer: "벌점 경감 봉사", profile: "내 프로필",
  };

  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  return (
    <div className="app-layout">
      <Sidebar user={user} activePage={activePage} setActivePage={setActivePage} onLogout={logout} onLogin={requireLogin} />
      <div className="main-wrapper">
        <header className="top-header">
          <div className="top-header-left">
            <h2 className="top-header-title">{pageLabels[activePage] || "홈"}</h2>
          </div>
          <div className="top-header-right">
            <span className="top-header-date">{today}</span>
            {user ? (
              <img src={user.photoURL} alt="프로필" className="top-header-avatar" />
            ) : (
              <button className="top-header-login-btn" onClick={requireLogin}>로그인</button>
            )}
          </div>
        </header>
        <main className="main-content">
          <PageContent activePage={activePage} user={user} setActivePage={setActivePage} />
        </main>
      </div>
    </div>
  );
}

function PageContent({ activePage, user, setActivePage }) {
  const needsAuth = ["attendance", "volunteer", "profile"];
  if (needsAuth.includes(activePage) && !user) {
    return (
      <div className="auth-required">
        <span className="auth-required-icon">🔒</span>
        <h2 className="auth-required-title">로그인이 필요해요</h2>
        <p className="auth-required-desc">이 페이지를 보려면 학교 계정으로 로그인해주세요.</p>
        <button className="auth-required-btn" onClick={requireLogin}>학교 계정으로 로그인</button>
      </div>
    );
  }

  if (activePage === "home") return <HomePage user={user} setActivePage={setActivePage} />;
  if (activePage === "grades") return <Grades />;
  if (activePage === "anthem") return user ? <Anthem user={user} /> : <ReadOnlyAnthem />;
  if (activePage === "timetable") return user ? <Timetable user={user} /> : <ReadOnlyTimetable />;
  if (activePage === "notices") return <Notices user={user} />;
  if (activePage === "attendance") return <Attendance user={user} />;
  if (activePage === "agenda") return <Agenda user={user} />;
  if (activePage === "meal") return <Meal />;
  if (activePage === "calendar") return <Calendar />;   // ★추가
  if (activePage === "volunteer") return <Volunteer />;
  if (activePage === "profile") return <Profile user={user} setActivePage={setActivePage} />;

  return null;
}

function ReadOnlyAnthem() {
  return (
    <div className="auth-required">
      <span className="auth-required-icon">🎵</span>
      <h2 className="auth-required-title">기상곡 신청</h2>
      <p className="auth-required-desc">기상곡 목록 보기와 투표는 로그인이 필요해요.</p>
      <button className="auth-required-btn" onClick={requireLogin}>학교 계정으로 로그인</button>
    </div>
  );
}

function ReadOnlyTimetable() {
  return (
    <div className="auth-required">
      <span className="auth-required-icon">📅</span>
      <h2 className="auth-required-title">시간표</h2>
      <p className="auth-required-desc">시간표를 보려면 로그인이 필요해요.</p>
      <button className="auth-required-btn" onClick={requireLogin}>학교 계정으로 로그인</button>
    </div>
  );
}

function HomePage({ user, setActivePage }) {
  const nameOnly = user?.displayName?.replace(/^[0-9]+/, "") || "방문자";
  const [meals, setMeals] = useState(null);

  useEffect(() => {
    const fetchMeal = async () => {
      try {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        const dateStr = `${y}${m}${d}`;
        const API_KEY = "b239e5a1b3ec421dbad518ed199277bb";
        const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=B10&SD_SCHUL_CODE=7010084&MLSV_YMD=${dateStr}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.mealServiceDietInfo) {
          const rows = data.mealServiceDietInfo[1].row;
          const parsed = {};
          rows.forEach((row) => {
            parsed[row.MMEAL_SC_CODE] = row.DDISH_NM
              .split("<br/>")
              .map((item) => item.replace(/\s*\(.*?\)/g, "").trim())
              .filter(Boolean);
          });
          setMeals(parsed);
        }
      } catch (e) {}
    };
    fetchMeal();
  }, []);

  const mealLabels = { "1": "아침", "2": "점심", "3": "저녁" };

  const cards = [
    { id: "anthem", icon: "music", label: "기상곡 신청", cls: "home-card-1" },
    { id: "notices", icon: "bell", label: "공지사항", cls: "home-card-2" },
    { id: "attendance", icon: "run", label: "이석/외출", cls: "home-card-3" },
    { id: "volunteer", icon: "leaf", label: "봉사 신청", cls: "home-card-4" },
  ];

  const shortcuts = [
    { id: "timetable", icon: "calendar", label: "시간표 보기" },
    { id: "grades", icon: "chart", label: "성적 계산하기" },
    { id: "meal", icon: "utensils", label: "급식표 전체 보기" },
    { id: "calendar", icon: "calendar", label: "학사일정 보기" },   // ★추가
  ];

  return (
    <div className="home-page">
      <div className="home-greeting">안녕하세요{user ? `, ${nameOnly}님` : ""}</div>
      <div className="home-sub">{user ? "오늘도 좋은 하루 되세요." : "로그인하면 더 많은 기능을 쓸 수 있어요."}</div>

      <div className="home-cards">
        {cards.map((item) => (
          <div key={item.id} className={`home-card ${item.cls}`} onClick={() => setActivePage(item.id)}>
            <div className="home-card-top">
              <Icon name={item.icon} size={28} />
              <Icon name="arrow" size={18} />
            </div>
            <div className="home-card-label">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="home-sections">
        <div className="home-section">
          <div className="home-section-header">
            <span className="home-section-title">
              <Icon name="utensils" size={16} /> 오늘의 급식
            </span>
            <button className="home-section-more" onClick={() => setActivePage("meal")}>더보기 →</button>
          </div>
          {meals ? (
            Object.entries(mealLabels).map(([code, label]) =>
              meals[code] ? (
                <div key={code} className="home-meal-row">
                  <span className="home-meal-type">{label}</span>
                  <span className="home-meal-items">{meals[code].slice(0, 4).join(" · ")}</span>
                </div>
              ) : null
            )
          ) : (
            <div className="home-empty">급식 정보를 불러오는 중...</div>
          )}
        </div>

        <div className="home-section">
          <div className="home-section-header">
            <span className="home-section-title">
              <Icon name="zap" size={16} /> 바로가기
            </span>
          </div>
          {shortcuts.map((item) => (
            <div key={item.id} className="home-shortcut" onClick={() => setActivePage(item.id)}>
              <Icon name={item.icon} size={16} />
              <span className="home-shortcut-label">{item.label}</span>
              <Icon name="arrow" size={14} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;