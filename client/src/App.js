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
import GoogleCallback from "./components/GoogleCallback";
import SocialFeed from "./components/SocialFeed";
import FriendsPage from "./components/FriendsPage";
import ProfilePage from "./components/ProfilePage";
import SettingsPage from "./components/SettingsPage";
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
  const [focusedPostId, setFocusedPostId] = useState(null);

  // Apply theme
  React.useEffect(() => {
    if (user?.settings?.theme === "dark") {
      document.body.classList.add("dark-mode");
    } else if (user?.settings?.theme === "light") {
      document.body.classList.remove("dark-mode");
    } else if (user?.settings?.theme === "system") {
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.body.classList.add("dark-mode");
      } else {
        document.body.classList.remove("dark-mode");
      }
    }
  }, [user?.settings?.theme]);

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
    if (location.pathname === "/auth/google/callback") {
      return <GoogleCallback />;
    }
    return <AuthPage />;
  }

  // Chat management
  const openChat = (userId, userName, userAvatar) => {
    // Check if chat is already open
    const existingChat = openChats.find((chat) => chat.userId === userId);
    if (existingChat) {
      return;
    }

    setOpenChats((prev) => {
      let newChats = [...prev, { userId, userName, userAvatar }];
      // Limit to 3 chat windows
      if (newChats.length > 3) {
        newChats = newChats.slice(-3);
      }
      return newChats;
    });
  };

  return (
    <div className="app-container">
      <Header
        user={user}
        onLogout={logout}
        onTabChange={handleHeaderTabChange}
        activeTab={headerTab}
        onNotificationClick={(payload) => {
          if (typeof payload === "string") {
            if (payload === "friends") {
              navigate("/friends");
            }
            return;
          }

          if (
            (payload?.type === "post_reaction" ||
              payload?.type === "post_comment") &&
            payload?.postId
          ) {
            setHeaderTab("home");
            setFocusedPostId(payload.postId.toString());
            if (location.pathname !== "/") {
              navigate("/");
            }
            return;
          }
        }}
        onViewProfile={handleViewProfile}
        onChatsChange={setOpenChats} // Keep for backward compatibility if needed, but openChat is preferred
        onOpenChat={openChat}
        openChats={openChats}
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
          <div
            className={`sidebar-item ${
              location.pathname === "/settings" ? "active" : ""
            }`}
            onClick={() => navigate("/settings")}
          >
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
                        focusPostId={focusedPostId}
                        onFocusConsumed={() => setFocusedPostId(null)}
                      />
                    ) : (
                      <SocialFeed
                        isVulnerable={false}
                        onViewProfile={handleViewProfile}
                        focusPostId={focusedPostId}
                        onFocusConsumed={() => setFocusedPostId(null)}
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
            <Route
              path="/profile/:userId"
              element={<ProfilePageWithParams reloadKey={profileReloadKey} />}
            />
            <Route
              path="/profile/:userId"
              element={<ProfilePageWithParams reloadKey={profileReloadKey} />}
            />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/auth/google/callback" element={<GoogleCallback />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        <div className="sidebar-right">
          <div className="contacts-header">
            <span>Liên hệ</span>
          </div>
          <ContactsList
            onViewProfile={handleViewProfile}
            onOpenChat={openChat}
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
