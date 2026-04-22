import { useState } from "react";

const navItems = [
  { id: "timetable", label: "시간표", icon: "📅" },
  { id: "grades", label: "성적 계산", icon: "📊" },
  { id: "anthem", label: "기상곡 신청", icon: "🎵" },
  { id: "notices", label: "공지사항", icon: "📢" },
  { id: "agenda", label: "학교 안건", icon: "📋" },
];

export default function Sidebar({ user, activePage, setActivePage, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);

  const nameOnly = user.displayName.replace(/^[0-9]+/, "");
  const studentId = user.displayName.match(/^[0-9]+/)?.[0] || "";

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header" onClick={() => setActivePage("home")}>
        <span className="sidebar-logo-icon">🏫</span>
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
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className={`nav-item profile-item ${activePage === "profile" ? "active" : ""}`} onClick={() => setActivePage("profile")}>
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
      </div>
    </aside>
  );
}