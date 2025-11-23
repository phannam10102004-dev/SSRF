import React, { useState, useRef, useEffect } from "react";
import "./Header.css";
import {
  LinkIcon,
  SearchIcon,
  HomeIcon,
  AlertTriangleIcon,
  UserIcon,
  MessageIcon,
  HelpIcon,
  LogoutIcon,
  SettingsIcon,
} from "./Icons";
import Notifications from "./Notifications";
import MessagesList from "./MessagesList";

function Header({
  user,
  onLogout,
  onTabChange,
  activeTab = "home",
  onNotificationClick,
  onViewProfile,
  onChatsChange,
  onSocketChange,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null); // 'notifications' | 'messages' | null
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="main-header">
      <div className="header-left">
        <div className="fb-logo">
          <LinkIcon size={24} color="white" />
        </div>
        <div className="header-search">
          <SearchIcon size={18} />
          <input type="text" placeholder="Tìm kiếm trên Social Network" />
        </div>
      </div>

      <div className="header-center">
        <div
          className={`nav-tab ${activeTab === "home" ? "active" : ""}`}
          onClick={() => onTabChange?.("home")}
          title="Trang chủ - Secure Mode"
        >
          <HomeIcon size={24} />
        </div>
        <div
          className={`nav-tab ${activeTab === "ssrf" ? "active" : ""}`}
          onClick={() => onTabChange?.("ssrf")}
          title="Demo tấn công SSRF"
        >
          <AlertTriangleIcon size={24} />
        </div>
      </div>

      <div className="header-right">
        <MessagesList
          onChatsChange={onChatsChange}
          onSocketChange={onSocketChange}
          isOpen={activeDropdown === "messages"}
          onToggle={(isOpen) => {
            setActiveDropdown(isOpen ? "messages" : null);
          }}
        />
        <Notifications
          onNotificationClick={onNotificationClick}
          onViewProfile={onViewProfile}
          isOpen={activeDropdown === "notifications"}
          onToggle={(isOpen) => {
            setActiveDropdown(isOpen ? "notifications" : null);
          }}
        />
        <div className="user-menu" ref={menuRef}>
          <div className="user-avatar" onClick={() => setShowMenu(!showMenu)}>
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} />
            ) : (
              <span>{getInitials(user.name)}</span>
            )}
          </div>

          {showMenu && (
            <div className="user-dropdown">
              <div className="dropdown-header">
                <div className="dropdown-avatar">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} />
                  ) : (
                    <span>{getInitials(user.name)}</span>
                  )}
                </div>
                <div className="dropdown-user-info">
                  <div className="dropdown-name">{user.name}</div>
                  <div className="dropdown-email">{user.email}</div>
                </div>
              </div>
              <div className="dropdown-divider"></div>
              <div
                className="dropdown-item"
                onClick={() => {
                  if (onViewProfile) {
                    onViewProfile(null); // null = current user
                  }
                  setShowMenu(false);
                }}
              >
                <UserIcon size={20} />
                <span>Xem hồ sơ</span>
              </div>
              <div className="dropdown-item">
                <SettingsIcon size={20} />
                <span>Cài đặt</span>
              </div>
              <div className="dropdown-item">
                <HelpIcon size={20} />
                <span>Trợ giúp & Hỗ trợ</span>
              </div>
              <div className="dropdown-divider"></div>
              <div className="dropdown-item logout" onClick={onLogout}>
                <LogoutIcon size={20} />
                <span>Đăng xuất</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
