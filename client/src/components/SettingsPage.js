import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import "./SettingsPage.css";
import {
  UserIcon,
  LockIcon,
  BellIcon,
  ShieldIcon,
  MoonIcon,
  GlobeIcon,
  EyeIcon,
  EyeOffIcon,
} from "./Icons";

function SettingsPage() {
  const { user, updateSettings, enable2FA, confirm2FA, disable2FA } = useAuth();
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(false);
  const [localSettings, setLocalSettings] = useState({
    language: "vi",
    theme: "light",
    privacy: "public",
    notifications: { push: true, email: false },
  });

  // 2FA States
  const [show2FAOtp, setShow2FAOtp] = useState(false);
  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (user?.settings) {
      setLocalSettings(user.settings);
    }
  }, [user]);

  const handleSettingChange = async (key, value, nestedKey = null) => {
    let newSettings = { ...localSettings };
    if (nestedKey) {
      newSettings[key] = { ...newSettings[key], [nestedKey]: value };
    } else {
      newSettings[key] = value;
    }
    setLocalSettings(newSettings);
    await updateSettings(newSettings);
  };

  const handleEnable2FA = async () => {
    setLoading(true);
    setMessage({ type: "", text: "" });
    const result = await enable2FA();
    setLoading(false);
    if (result.success) {
      // 2FA is now enabled immediately
      setMessage({ type: "success", text: result.message });
    } else {
      setMessage({ type: "error", text: result.error });
    }
  };

  // Auto-dismiss message
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ type: "", text: "" });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleDisable2FA = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await disable2FA(password);
    setLoading(false);
    if (result.success) {
      setShowDisable2FA(false);
      setPassword("");
      setMessage({ type: "success", text: "Đã tắt xác thực 2 lớp" });
    } else {
      setMessage({ type: "error", text: result.error });
    }
  };

  const tabs = [
    { id: "general", label: "Chung", icon: <GlobeIcon size={20} /> },
    { id: "security", label: "Bảo mật", icon: <LockIcon size={20} /> },
    { id: "privacy", label: "Quyền riêng tư", icon: <ShieldIcon size={20} /> },
    { id: "notifications", label: "Thông báo", icon: <BellIcon size={20} /> },
  ];

  return (
    <div className="settings-page">
      <div className="settings-container">
        <div className="settings-sidebar">
          <h2>Cài đặt</h2>
          <nav className="settings-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`settings-nav-item ${
                  activeTab === tab.id ? "active" : ""
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="settings-content">
          {message.text && (
            <div className={`settings-message ${message.type}`}>
              {message.text}
            </div>
          )}

          {activeTab === "general" && (
            <div className="settings-section">
              <h3>Cài đặt chung</h3>
              <div className="settings-group">
                <div className="settings-item">
                  <div className="settings-info">
                    <label>Ngôn ngữ</label>
                    <p>Chọn ngôn ngữ hiển thị</p>
                  </div>
                  <select
                    value={localSettings.language}
                    onChange={(e) =>
                      handleSettingChange("language", e.target.value)
                    }
                  >
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div className="settings-item">
                  <div className="settings-info">
                    <label>Giao diện</label>
                    <p>Chọn giao diện sáng/tối</p>
                  </div>
                  <select
                    value={localSettings.theme}
                    onChange={(e) =>
                      handleSettingChange("theme", e.target.value)
                    }
                  >
                    <option value="light">Sáng</option>
                    <option value="dark">Tối</option>
                    <option value="system">Hệ thống</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="settings-section">
              <h3>Bảo mật & Đăng nhập</h3>
              <div className="settings-group">
                <div className="settings-item">
                  <div className="settings-info">
                    <label>Xác thực 2 lớp</label>
                    <p>Tăng cường bảo mật cho tài khoản</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={user?.twoFactor?.enabled || false}
                      onChange={() => {
                        if (user?.twoFactor?.enabled) {
                          setShowDisable2FA(true);
                        } else {
                          handleEnable2FA();
                        }
                      }}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                {showDisable2FA && (
                  <div className="settings-sub-form">
                    <h4>Xác nhận tắt 2FA</h4>
                    <p>Vui lòng nhập mật khẩu để xác nhận</p>
                    <form onSubmit={handleDisable2FA}>
                      <div className="password-input-wrapper">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Mật khẩu hiện tại"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
                        </button>
                      </div>
                      <div className="form-actions">
                        <button type="submit" disabled={loading}>
                          Xác nhận
                        </button>
                        <button
                          type="button"
                          className="cancel-btn"
                          onClick={() => setShowDisable2FA(false)}
                        >
                          Hủy
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="settings-item">
                  <div className="settings-info">
                    <label>Cảnh báo đăng nhập</label>
                    <p>Nhận thông báo khi có thiết bị lạ</p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" defaultChecked />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === "privacy" && (
            <div className="settings-section">
              <h3>Quyền riêng tư</h3>
              <div className="settings-group">
                <div className="settings-item">
                  <div className="settings-info">
                    <label>Ai có thể xem bài viết của bạn?</label>
                  </div>
                  <select
                    value={localSettings.privacy}
                    onChange={(e) =>
                      handleSettingChange("privacy", e.target.value)
                    }
                  >
                    <option value="public">Mọi người</option>
                    <option value="friends">Bạn bè</option>
                    <option value="only_me">Chỉ mình tôi</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="settings-section">
              <h3>Cài đặt thông báo</h3>
              <div className="settings-group">
                <div className="settings-item">
                  <div className="settings-info">
                    <label>Thông báo đẩy</label>
                    <p>Nhận thông báo trên trình duyệt</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={localSettings.notifications?.push}
                      onChange={(e) =>
                        handleSettingChange(
                          "notifications",
                          e.target.checked,
                          "push"
                        )
                      }
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
                <div className="settings-item">
                  <div className="settings-info">
                    <label>Email thông báo</label>
                    <p>Nhận email về hoạt động mới</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={localSettings.notifications?.email}
                      onChange={(e) =>
                        handleSettingChange(
                          "notifications",
                          e.target.checked,
                          "email"
                        )
                      }
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
