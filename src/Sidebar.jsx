import { useState, useEffect } from "react";

const Icon = ({ name }) => {
  const icons = {
    home: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    chart: <><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></>,
    music: <><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
    clipboard: <><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></>,
    run: <><circle cx="13" cy="4" r="2"/><path d="M4 22l5-9 4 2-2 4 5-1m-3-9l3 3-3 4"/></>,
    utensils: <><path d="M3 2v7c0 1.1.9 2 2 2h2v11M7 2v20M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></>,
    leaf: <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></>,
  };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

const navItems = [
  { id: "timetable", label: "시간표", icon: "calendar" },
  { id: "grades", label: "성적 계산", icon: "chart" },
  { id: "anthem", label: "기상곡 신청", icon: "music" },
  { id: "notices", label: "공지사항", icon: "bell" },
  { id: "agenda", label: "학교 안건", icon: "clipboard" },
  { id: "attendance", label: "이석/외출 현황", icon: "run" },
  { id: "volunteer", label: "벌점 경감 봉사", icon: "leaf" },
  { id: "meal", label: "급식표", icon: "utensils" },
];

const THEMES = ["dark", "light", "colorful", "pastel"];

export default function Sidebar({ user, activePage, setActivePage, onLogout, onLogin }) {
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.classList.remove(...THEMES);
    if (theme !== "dark") document.documentElement.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const nameOnly = user?.displayName?.replace(/^[0-9]+/, "") || "";
  const studentId = user?.displayName?.match(/^[0-9]+/)?.[0] || "";

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header" onClick={() => setActivePage("home")}>
        <Icon name="home" />
        {!collapsed && <span className="sidebar-logo-text">SSHS Portal</span>}
      </div>

      <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? "›" : "‹"}
      </button>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activePage === item.id ? "active" : ""}`}
            onClick={() => setActivePage(item.id)}
          >
            <Icon name={item.icon} />
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="theme-selector">
            <div className="theme-selector-label">테마</div>
            <div className="theme-btns">
              <button className={`theme-btn theme-btn-dark ${theme === "dark" ? "selected" : ""}`} onClick={() => setTheme("dark")} title="다크" />
              <button className={`theme-btn theme-btn-light ${theme === "light" ? "selected" : ""}`} onClick={() => setTheme("light")} title="라이트" />
              <button className={`theme-btn theme-btn-colorful ${theme === "colorful" ? "selected" : ""}`} onClick={() => setTheme("colorful")} title="컬러풀" />
              <button className={`theme-btn theme-btn-pastel ${theme === "pastel" ? "selected" : ""}`} onClick={() => setTheme("pastel")} title="파스텔" />
            </div>
          </div>
        )}

        {user ? (
          <>
            <button
              className={`nav-item profile-item ${activePage === "profile" ? "active" : ""}`}
              onClick={() => setActivePage("profile")}
            >
              <img src={user.photoURL} alt="프로필" className="profile-avatar" />
              {!collapsed && (
                <div className="profile-info">
                  <span className="profile-name">{nameOnly}</span>
                  <span className="profile-id">{studentId}</span>
                </div>
              )}
            </button>
            <button className="logout-btn" onClick={onLogout}>
              {collapsed ? "↩" : "로그아웃"}
            </button>
          </>
        ) : (
          <button className="sidebar-login-btn" onClick={onLogin}>
            {collapsed ? "→" : "🔑 로그인"}
          </button>
        )}
      </div>
    </aside>
  );
}