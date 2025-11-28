import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
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
  LockIcon,
} from "./Icons";
import Notifications from "./Notifications";
import MessagesList from "./MessagesList";
import SettingsModal from "./SettingsModal";

const API_BASE_URL = "http://localhost:3001/api";

function Header({
  user,
  onLogout,
  onTabChange,
  activeTab = "home",
  onNotificationClick,
  onViewProfile,
  onChatsChange,
  onOpenChat,
  openChats,
  onSocketChange,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null); // 'notifications' | 'messages' | null
  const menuRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef(null);
  const searchContainerRef = useRef(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchTerm || !searchTerm.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      setSearchLoading(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const response = await axios.get(`${API_BASE_URL}/users`, {
          params: { search: searchTerm.trim() },
        });
        setSearchResults(response.data.users || []);
        setShowSearchResults(true);
      } catch (error) {
        console.error("Lỗi tìm kiếm user:", error);
      } finally {
        setSearchLoading(false);
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSelectUser = (userId) => {
    if (!userId) return;
    onViewProfile?.(userId);
    setSearchTerm("");
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const navigate = useNavigate();

  return (
    <header className="main-header">
      <div className="header-left">
        <div className="fb-logo">
          <LinkIcon size={24} color="white" />
        </div>
        <div className="header-search" ref={searchContainerRef}>
          <SearchIcon size={18} />
          <input
            type="text"
            placeholder="Tìm kiếm bạn bè theo tên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) {
                setShowSearchResults(true);
              }
            }}
          />
          {showSearchResults && (
            <div className="search-results-dropdown">
              {searchLoading ? (
                <div className="search-result loading">Đang tìm kiếm...</div>
              ) : searchResults.length === 0 ? (
                <div className="search-result empty">
                  Không tìm thấy người dùng
                </div>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={item._id}
                    className="search-result"
                    onClick={() => handleSelectUser(item._id)}
                  >
                    <div className="search-result-avatar">
                      {item.avatar ? (
                        <img src={item.avatar} alt={item.name} />
                      ) : (
                        <span>{getInitials(item.name)}</span>
                      )}
                    </div>
                    <div className="search-result-info">
                      <span className="search-result-name">{item.name}</span>
                      <span className="search-result-meta">
                        {item.email || "Không có email"}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
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
          onOpenChat={onOpenChat}
          openChats={openChats}
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
              <div
                className="dropdown-item"
                onClick={() => {
                  setShowSettingsModal(true);
                  setShowMenu(false);
                }}
              >
                <LockIcon size={20} />
                <span>Đổi mật khẩu</span>
              </div>
              <div
                className="dropdown-item"
                onClick={() => {
                  navigate("/settings");
                  setShowMenu(false);
                }}
              >
                <SettingsIcon size={20} />
                <span>Cài đặt</span>
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
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </header>
  );
}

export default Header;
