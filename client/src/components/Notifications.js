import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { BellIcon, UserIcon } from "./Icons";
import "./Notifications.css";

const API_BASE_URL = "http://localhost:3001/api";

function Notifications({
  onNotificationClick,
  onViewProfile,
  isOpen,
  onToggle,
}) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Đồng bộ với prop isOpen từ parent
  useEffect(() => {
    if (isOpen !== showDropdown) {
      setShowDropdown(isOpen);
    }
  }, [isOpen]);

  useEffect(() => {
    if (user) {
      loadNotifications();
      // Polling mỗi 5 giây để cập nhật realtime
      const interval = setInterval(loadNotifications, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showDropdown &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !event.target.closest(".notification-icon-btn")
      ) {
        setShowDropdown(false);
        if (onToggle) {
          onToggle(false);
        }
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown, onToggle]);

  const loadNotifications = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/notifications?unreadOnly=false`
      );
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error("Lỗi khi load notifications:", error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await axios.put(`${API_BASE_URL}/notifications/${notificationId}/read`);
      await loadNotifications();
    } catch (error) {
      console.error("Lỗi khi đánh dấu đã đọc:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await axios.put(`${API_BASE_URL}/notifications/read-all`);
      await loadNotifications();
    } catch (error) {
      console.error("Lỗi khi đánh dấu tất cả:", error);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Vừa xong";
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    return date.toLocaleDateString("vi-VN");
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "friend_request":
        return <UserIcon size={20} />;
      case "friend_accepted":
        return <UserIcon size={20} />;
      default:
        return <BellIcon size={20} />;
    }
  };

  return (
    <div className="notifications-container" ref={dropdownRef}>
      <div
        className="notification-icon-btn"
        onClick={() => {
          const newState = !showDropdown;
          setShowDropdown(newState);
          if (onToggle) {
            onToggle(newState);
          }
        }}
      >
        <BellIcon size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </div>

      {showDropdown && (
        <div className="notifications-dropdown">
          <div className="notifications-header">
            <h3>Thông báo</h3>
            {unreadCount > 0 && (
              <button
                className="mark-all-read-btn"
                onClick={handleMarkAllAsRead}
              >
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>

          <div className="notifications-list">
            {notifications.length === 0 ? (
              <div className="empty-notifications">
                <BellIcon size={32} />
                <p>Không có thông báo nào</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`notification-item ${
                    !notification.read ? "unread" : ""
                  }`}
                  onClick={() => {
                    if (!notification.read) {
                      handleMarkAsRead(notification._id);
                    }

                    // Nếu có from (user ID), chuyển đến profile của người đó
                    if (notification.from) {
                      const fromUserId =
                        notification.from._id || notification.from;
                      if (onViewProfile && fromUserId) {
                        onViewProfile(fromUserId);
                        setShowDropdown(false);
                        return;
                      }
                    }

                    // Fallback: Chuyển đến trang bạn bè nếu là friend request
                    if (
                      notification.type === "friend_request" ||
                      notification.type === "friend_accepted"
                    ) {
                      onNotificationClick?.("friends");
                      setShowDropdown(false);
                    }
                  }}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-message">
                      {notification.message}
                    </div>
                    <div className="notification-time">
                      {formatTime(notification.createdAt)}
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="notification-dot"></div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Notifications;
