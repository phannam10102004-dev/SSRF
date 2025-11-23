import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import "./FriendSuggestions.css";

const API_BASE_URL = "http://localhost:3001/api";

function FriendSuggestions({ onViewProfile }) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState([]);
  const [sentRequestIds, setSentRequestIds] = useState(new Set()); // Track các user đã gửi request
  const [requestIdMap, setRequestIdMap] = useState({}); // Map userId -> requestId

  useEffect(() => {
    if (user) {
      loadSuggestions();
      loadSentRequests();
    }
  }, [user]);

  const loadSentRequests = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE_URL}/users/friend-requests?type=sent`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const requests = response.data.requests || [];
      const newSentRequestIds = new Set();
      const newRequestIdMap = {};

      requests.forEach((req) => {
        const toUserId = req.to?._id || req.to;
        newSentRequestIds.add(toUserId);
        newRequestIdMap[toUserId] = req._id;
      });

      setSentRequestIds(newSentRequestIds);
      setRequestIdMap(newRequestIdMap);
    } catch (error) {
      console.error("Lỗi khi load sent requests:", error);
    }
  };

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/users/suggestions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Lọc bỏ những user đã bị dismiss
      const filtered = (response.data.users || []).filter(
        (u) => !dismissedIds.includes(u._id)
      );
      setSuggestions(filtered.slice(0, 10)); // Chỉ lấy 10 người đầu
    } catch (error) {
      console.error("Lỗi khi load suggestions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (userId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE_URL}/users/friend-requests`,
        { toUserId: userId },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Cập nhật state: đánh dấu đã gửi request (KHÔNG reload suggestions, giữ card hiển thị)
      setSentRequestIds((prev) => new Set([...prev, userId]));
      if (response.data.request?._id) {
        setRequestIdMap((prev) => ({
          ...prev,
          [userId]: response.data.request._id,
        }));
      } else if (response.data.requestId) {
        // Fallback nếu response format khác
        setRequestIdMap((prev) => ({
          ...prev,
          [userId]: response.data.requestId,
        }));
      }
      // KHÔNG gọi loadSuggestions() để giữ card trong UI
    } catch (error) {
      console.error("Lỗi khi gửi friend request:", error);
      alert(error.response?.data?.error || "Không thể gửi lời mời kết bạn");
    }
  };

  const handleCancelRequest = async (userId) => {
    try {
      const token = localStorage.getItem("token");
      const requestId = requestIdMap[userId];

      if (requestId) {
        await axios.delete(
          `${API_BASE_URL}/users/friend-requests/${requestId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      }

      // Cập nhật state: xóa khỏi danh sách đã gửi (card vẫn hiển thị, không reload)
      setSentRequestIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      setRequestIdMap((prev) => {
        const newMap = { ...prev };
        delete newMap[userId];
        return newMap;
      });
      // KHÔNG gọi loadSuggestions() để giữ card trong UI
    } catch (error) {
      console.error("Lỗi khi hủy friend request:", error);
      alert(error.response?.data?.error || "Không thể hủy yêu cầu");
    }
  };

  const handleDismiss = (userId) => {
    setDismissedIds((prev) => [...prev, userId]);
    setSuggestions((prev) => prev.filter((u) => u._id !== userId));
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="friend-suggestions-container">
      <div className="friend-suggestions-header">
        <div className="friend-suggestions-title">
          <span className="friend-suggestions-icon">👥</span>
          <span>Những người bạn có thể biết</span>
        </div>
        <button className="friend-suggestions-more">⋯</button>
      </div>

      <div className="friend-suggestions-list">
        {suggestions.map((suggestion) => (
          <div key={suggestion._id} className="friend-suggestion-card">
            <button
              className="friend-suggestion-dismiss"
              onClick={() => handleDismiss(suggestion._id)}
              title="Bỏ qua"
            >
              ×
            </button>
            <div
              className="friend-suggestion-avatar"
              onClick={() => {
                if (onViewProfile) {
                  onViewProfile(suggestion._id);
                }
              }}
            >
              {suggestion.avatar ? (
                <img src={suggestion.avatar} alt={suggestion.name} />
              ) : (
                <span>{getInitials(suggestion.name)}</span>
              )}
            </div>
            <div className="friend-suggestion-name">{suggestion.name}</div>
            {suggestion.mutualFriendsCount > 0 && (
              <div className="friend-suggestion-mutual">
                <span className="mutual-friends-icon">👥</span>
                <span>{suggestion.mutualFriendsCount} bạn chung</span>
              </div>
            )}
            {sentRequestIds.has(suggestion._id) ? (
              <button
                className="friend-suggestion-cancel-btn"
                onClick={() => handleCancelRequest(suggestion._id)}
              >
                Hủy yêu cầu kết bạn
              </button>
            ) : (
              <button
                className="friend-suggestion-add-btn"
                onClick={() => handleAddFriend(suggestion._id)}
              >
                <span>👤</span> Thêm bạn bè
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="friend-suggestions-footer">
        <button className="friend-suggestions-see-all">Xem tất cả</button>
      </div>
    </div>
  );
}

export default FriendSuggestions;
