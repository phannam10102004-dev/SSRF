import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { UserIcon } from "./Icons";
import "./FriendsPage.css";

const API_BASE_URL = "http://localhost:3001/api";

function FriendsPage({ onViewProfile }) {
  const { user } = useAuth();
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState({
    sent: [],
    received: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("suggestions"); // 'suggestions', 'friends', or 'requests'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([
      loadSuggestedUsers(),
      loadFriends(),
      loadFriendRequests(),
    ]);
    setLoading(false);
  };

  const loadSuggestedUsers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/users/suggestions`);
      setSuggestedUsers(response.data.users || []);
    } catch (error) {
      console.error("Lỗi khi load suggested users:", error);
    }
  };

  const loadFriends = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/users/friends`);
      setFriends(response.data.friends || []);
    } catch (error) {
      console.error("Lỗi khi load friends:", error);
    }
  };

  const loadFriendRequests = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/users/friend-requests`);
      setFriendRequests(response.data.requests || { sent: [], received: [] });
    } catch (error) {
      console.error("Lỗi khi load friend requests:", error);
    }
  };

  const handleSendFriendRequest = async (toUserId) => {
    try {
      await axios.post(`${API_BASE_URL}/users/friend-requests`, {
        toUserId,
      });
      // Reload để cập nhật trạng thái
      await loadFriendRequests();
      await loadSuggestedUsers();
    } catch (error) {
      console.error("Lỗi khi gửi yêu cầu:", error);
      alert(error.response?.data?.error || "Không thể gửi yêu cầu");
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await axios.post(
        `${API_BASE_URL}/users/friend-requests/${requestId}/accept`
      );
      await loadData();
    } catch (error) {
      console.error("Lỗi khi chấp nhận:", error);
      alert(error.response?.data?.error || "Không thể chấp nhận");
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await axios.delete(`${API_BASE_URL}/users/friend-requests/${requestId}`);
      await loadFriendRequests();
      await loadSuggestedUsers();
    } catch (error) {
      console.error("Lỗi khi từ chối:", error);
      alert(error.response?.data?.error || "Không thể từ chối");
    }
  };

  const handleCancelSentRequest = async (requestId) => {
    try {
      await axios.delete(`${API_BASE_URL}/users/friend-requests/${requestId}`);
      await loadFriendRequests();
      await loadSuggestedUsers();
    } catch (error) {
      console.error("Lỗi khi hủy yêu cầu:", error);
      alert(error.response?.data?.error || "Không thể hủy yêu cầu");
    }
  };

  const handleRemoveFriend = async (friendId) => {
    try {
      await axios.delete(`${API_BASE_URL}/users/friends/${friendId}`);
      await loadData();
    } catch (error) {
      console.error("Lỗi khi xóa bạn:", error);
      alert(error.response?.data?.error || "Không thể xóa bạn");
    }
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

  const getRequestStatus = (userId) => {
    const sentRequest = friendRequests.sent?.find(
      (r) => r.to?._id === userId || r.to === userId
    );
    if (sentRequest) return "sent";

    const receivedRequest = friendRequests.received?.find(
      (r) => r.from?._id === userId || r.from === userId
    );
    if (receivedRequest)
      return { type: "received", requestId: receivedRequest._id };

    return null;
  };

  if (loading) {
    return (
      <div className="friends-page">
        <div className="loading-friends">
          <div className="spinner"></div>
          <p>Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="friends-page">
      <div className="friends-header">
        <h2>Bạn bè</h2>
        <div className="friends-tabs">
          <button
            className={`friends-tab ${
              activeTab === "suggestions" ? "active" : ""
            }`}
            onClick={() => setActiveTab("suggestions")}
          >
            Đề xuất
          </button>
          <button
            className={`friends-tab ${
              activeTab === "requests" ? "active" : ""
            }`}
            onClick={() => setActiveTab("requests")}
          >
            Yêu cầu (
            {(friendRequests.received?.length || 0) +
              (friendRequests.sent?.length || 0)}
            )
          </button>
          <button
            className={`friends-tab ${activeTab === "friends" ? "active" : ""}`}
            onClick={() => setActiveTab("friends")}
          >
            Bạn bè ({friends.length})
          </button>
        </div>
      </div>

      <div className="friends-content">
        {activeTab === "suggestions" ? (
          <div className="suggestions-list">
            <h3 className="section-title">Đề xuất kết bạn</h3>
            {suggestedUsers.length === 0 ? (
              <div className="empty-state">
                <UserIcon size={48} />
                <p>Không có đề xuất nào</p>
              </div>
            ) : (
              <div className="users-grid">
                {suggestedUsers.map((suggestedUser) => {
                  const requestStatus = getRequestStatus(suggestedUser._id);
                  return (
                    <div
                      key={suggestedUser._id}
                      className="user-card"
                      onClick={() =>
                        onViewProfile && onViewProfile(suggestedUser._id)
                      }
                      style={{ cursor: "pointer" }}
                    >
                      <div className="user-card-avatar">
                        {suggestedUser.avatar ? (
                          <img
                            src={suggestedUser.avatar}
                            alt={suggestedUser.name}
                          />
                        ) : (
                          <span>{getInitials(suggestedUser.name)}</span>
                        )}
                      </div>
                      <div className="user-card-info">
                        <div className="user-card-name">
                          {suggestedUser.name}
                        </div>
                        <div className="user-card-email">
                          {suggestedUser.email}
                        </div>
                        {suggestedUser.bio && (
                          <div className="user-card-bio">
                            {suggestedUser.bio}
                          </div>
                        )}
                      </div>
                      {requestStatus === "sent" ? (
                        <button
                          className="pending-friend-btn"
                          disabled
                          onClick={(e) => e.stopPropagation()}
                        >
                          <UserIcon size={16} />
                          Đang gửi yêu cầu
                        </button>
                      ) : requestStatus?.type === "received" ? (
                        <div
                          className="request-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="accept-friend-btn"
                            onClick={() =>
                              handleAcceptRequest(requestStatus.requestId)
                            }
                          >
                            Chấp nhận
                          </button>
                          <button
                            className="reject-friend-btn"
                            onClick={() =>
                              handleRejectRequest(requestStatus.requestId)
                            }
                          >
                            Từ chối
                          </button>
                        </div>
                      ) : (
                        <button
                          className="add-friend-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendFriendRequest(suggestedUser._id);
                          }}
                        >
                          <UserIcon size={16} />
                          Thêm bạn
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === "requests" ? (
          <div className="requests-list">
            <div className="requests-section">
              <h3 className="section-title">
                Yêu cầu đã nhận ({friendRequests.received?.length || 0})
              </h3>
              {friendRequests.received?.length === 0 ? (
                <div className="empty-state">
                  <UserIcon size={48} />
                  <p>Không có yêu cầu nào</p>
                </div>
              ) : (
                <div className="users-grid">
                  {friendRequests.received.map((request) => {
                    const fromUser = request.from;
                    return (
                      <div
                        key={request._id}
                        className="user-card"
                        onClick={() =>
                          onViewProfile &&
                          onViewProfile(fromUser?._id || request.from)
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <div className="user-card-avatar">
                          {fromUser?.avatar ? (
                            <img src={fromUser.avatar} alt={fromUser.name} />
                          ) : (
                            <span>{getInitials(fromUser?.name || "")}</span>
                          )}
                        </div>
                        <div className="user-card-info">
                          <div className="user-card-name">
                            {fromUser?.name || "Unknown"}
                          </div>
                          <div className="user-card-email">
                            {fromUser?.email || ""}
                          </div>
                        </div>
                        <div
                          className="request-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="accept-friend-btn"
                            onClick={() => handleAcceptRequest(request._id)}
                          >
                            Chấp nhận
                          </button>
                          <button
                            className="reject-friend-btn"
                            onClick={() => handleRejectRequest(request._id)}
                          >
                            Từ chối
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="requests-section">
              <h3 className="section-title">
                Yêu cầu đã gửi ({friendRequests.sent?.length || 0})
              </h3>
              {friendRequests.sent?.length === 0 ? (
                <div className="empty-state">
                  <UserIcon size={48} />
                  <p>Chưa gửi yêu cầu nào</p>
                </div>
              ) : (
                <div className="users-grid">
                  {friendRequests.sent.map((request) => {
                    const toUser = request.to;
                    const toUserId = toUser?._id || toUser || request.to;
                    return (
                      <div
                        key={request._id}
                        className="user-card"
                        onClick={() => onViewProfile && onViewProfile(toUserId)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="user-card-avatar">
                          {toUser?.avatar ? (
                            <img src={toUser.avatar} alt={toUser.name} />
                          ) : (
                            <span>{getInitials(toUser?.name || "")}</span>
                          )}
                        </div>
                        <div className="user-card-info">
                          <div className="user-card-name">
                            {toUser?.name || "Unknown"}
                          </div>
                          <div className="user-card-email">
                            {toUser?.email || ""}
                          </div>
                        </div>
                        <button
                          className="cancel-sent-request-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelSentRequest(request._id);
                          }}
                        >
                          Hủy yêu cầu kết bạn
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="friends-list">
            <h3 className="section-title">Danh sách bạn bè</h3>
            {friends.length === 0 ? (
              <div className="empty-state">
                <UserIcon size={48} />
                <p>Bạn chưa có bạn bè nào</p>
                <button
                  className="view-suggestions-btn"
                  onClick={() => setActiveTab("suggestions")}
                >
                  Xem đề xuất
                </button>
              </div>
            ) : (
              <div className="users-grid">
                {friends.map((friend) => (
                  <div
                    key={friend._id}
                    className="user-card"
                    onClick={() => onViewProfile && onViewProfile(friend._id)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="user-card-avatar">
                      {friend.avatar ? (
                        <img src={friend.avatar} alt={friend.name} />
                      ) : (
                        <span>{getInitials(friend.name)}</span>
                      )}
                    </div>
                    <div className="user-card-info">
                      <div className="user-card-name">{friend.name}</div>
                      <div className="user-card-email">{friend.email}</div>
                      {friend.bio && (
                        <div className="user-card-bio">{friend.bio}</div>
                      )}
                    </div>
                    <button
                      className="remove-friend-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFriend(friend._id);
                      }}
                    >
                      Xóa bạn
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default FriendsPage;
