import React, { useState } from "react";
import {
  Routes,
  Route,
  useNavigate,
  useLocation,
  useParams,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import "./App.css";
import AuthPage from "./components/AuthPage";
import SocialFeed from "./components/SocialFeed";
import FriendsPage from "./components/FriendsPage";
import ProfilePage from "./components/ProfilePage";
import Header from "./components/Header";
import { ChatWindows } from "./components/MessagesList";
import ContactsList from "./components/ContactsList";
import {
  HomeIcon,
  UserIcon,
  UsersIcon,
  SettingsIcon,
} from "./components/Icons";

function AppContent() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [headerTab, setHeaderTab] = useState("home"); // 'home' or 'ssrf'
  const [profileReloadKey, setProfileReloadKey] = useState(0);
  const [openChats, setOpenChats] = useState([]);
  const [messagesSocket, setMessagesSocket] = useState(null);

  const handleHeaderTabChange = (tab) => {
    setHeaderTab(tab);
    if (location.pathname !== "/") {
      navigate("/");
    }
  };

  const handleViewProfile = (userId) => {
    if (userId) {
      const targetPath = `/profile/${userId}`;
      // Nếu đang ở trang profile của user đó, reload lại
      if (location.pathname === targetPath) {
        setProfileReloadKey((prev) => prev + 1);
      } else {
        navigate(targetPath);
      }
    } else {
      const targetPath = "/profile";
      // Nếu đang ở trang profile của mình, reload lại
      if (location.pathname === targetPath) {
        setProfileReloadKey((prev) => prev + 1);
      } else {
        navigate(targetPath);
      }
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Đang tải...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="app-container">
      <Header
        user={user}
        onLogout={logout}
        onTabChange={handleHeaderTabChange}
        activeTab={headerTab}
        onNotificationClick={(page) => {
          if (page === "friends") {
            navigate("/friends");
          }
        }}
        onViewProfile={handleViewProfile}
        onChatsChange={setOpenChats}
        onSocketChange={setMessagesSocket}
      />

      <div className="main-layout">
        <div className="sidebar-left">
          <div
            className={`sidebar-item ${
              location.pathname === "/" ? "active" : ""
            }`}
            onClick={() => navigate("/")}
          >
            <div className="sidebar-icon">
              <HomeIcon size={20} />
            </div>
            <span>Trang chủ</span>
          </div>
          <div
            className={`sidebar-item ${
              location.pathname === "/profile" ? "active" : ""
            }`}
            onClick={() => navigate("/profile")}
          >
            <div className="sidebar-icon">
              <UserIcon size={20} />
            </div>
            <span>Hồ sơ</span>
          </div>
          <div
            className={`sidebar-item ${
              location.pathname === "/friends" ? "active" : ""
            }`}
            onClick={() => navigate("/friends")}
          >
            <div className="sidebar-icon">
              <UsersIcon size={20} />
            </div>
            <span>Bạn bè</span>
          </div>
          <div className="sidebar-item">
            <div className="sidebar-icon">
              <SettingsIcon size={20} />
            </div>
            <span>Cài đặt</span>
          </div>
        </div>

        <div className="feed-container">
          <Routes>
            <Route
              path="/"
              element={
                <div className="feed-wrapper">
                  <div className="content">
                    {headerTab === "ssrf" ? (
                      <SocialFeed
                        isVulnerable={true}
                        onViewProfile={handleViewProfile}
                      />
                    ) : (
                      <SocialFeed
                        isVulnerable={false}
                        onViewProfile={handleViewProfile}
                      />
                    )}
                  </div>
                </div>
              }
            />
            <Route
              path="/friends"
              element={<FriendsPage onViewProfile={handleViewProfile} />}
            />
            <Route
              path="/profile"
              element={
                <ProfilePage userId={null} reloadKey={profileReloadKey} />
              }
            />
            <Route
              path="/profile/:userId"
              element={<ProfilePageWithParams reloadKey={profileReloadKey} />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        <div className="sidebar-right">
          <div className="contacts-header">
            <span>Liên hệ</span>
          </div>
          <ContactsList
            onViewProfile={handleViewProfile}
            onOpenChat={(userId, userName, userAvatar) => {
              if (window.openChat) {
                window.openChat(userId, userName, userAvatar);
              }
            }}
          />
        </div>
      </div>

      {/* Chat Windows - Render ở ngoài để không bị ảnh hưởng bởi layout */}
      <ChatWindows
        openChats={openChats}
        onCloseChat={(userId) => {
          setOpenChats(openChats.filter((chat) => chat.userId !== userId));
        }}
        socket={messagesSocket}
      />
    </div>
  );
}

// Component wrapper để lấy userId từ URL params
function ProfilePageWithParams({ reloadKey }) {
  const { userId } = useParams();
  return <ProfilePage userId={userId} reloadKey={reloadKey} />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
