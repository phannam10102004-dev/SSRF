import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { UserIcon, SettingsIcon } from "./Icons";
import "./ProfilePage.css";
import MessagesList from "./MessagesList";

const API_BASE_URL = "http://localhost:3001/api";

function ProfilePage({ userId: propUserId, reloadKey = 0 }) {
  const { user: currentUser } = useAuth();
  const userId = propUserId || currentUser?.id;
  const isOwnProfile = userId === currentUser?.id;

  const [profileUser, setProfileUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", bio: "" });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [relationshipStatus, setRelationshipStatus] = useState(null); // 'friend', 'sent', 'received', null
  const [friendRequestId, setFriendRequestId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      loadProfile();
    }
  }, [userId, reloadKey]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [profileResponse, postsResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/users/${userId}`, { headers }),
        axios.get(`${API_BASE_URL}/posts?authorId=${userId}`, { headers }),
      ]);

      const userData = profileResponse.data.user;
      setProfileUser(userData);
      setPosts(postsResponse.data.posts || []);
      setEditForm({
        name: userData.name,
        bio: userData.bio || "",
      });

      // Cập nhật trạng thái quan hệ
      if (userData.isFriend) {
        setRelationshipStatus("friend");
      } else if (userData.friendRequestStatus === "sent") {
        setRelationshipStatus("sent");
        setFriendRequestId(userData.friendRequestId);
      } else if (userData.friendRequestStatus === "received") {
        setRelationshipStatus("received");
        setFriendRequestId(userData.friendRequestId);
      } else {
        setRelationshipStatus(null);
        setFriendRequestId(null);
      }
    } catch (error) {
      console.error("Lỗi khi load profile:", error);
      if (error.response?.status === 404) {
        setProfileUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File quá lớn. Vui lòng chọn file nhỏ hơn 5MB");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      setUploadingAvatar(true);
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE_URL}/users/avatar`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setProfileUser({ ...profileUser, avatar: response.data.avatar });
      alert("Đã cập nhật avatar thành công!");
    } catch (error) {
      console.error("Lỗi khi upload avatar:", error);
      alert(error.response?.data?.error || "Không thể upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API_BASE_URL}/users/profile`, editForm, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      await loadProfile();
      setEditing(false);
      alert("Đã cập nhật profile thành công!");
    } catch (error) {
      console.error("Lỗi khi cập nhật profile:", error);
      alert(error.response?.data?.error || "Không thể cập nhật profile");
    }
  };

  // Friend request handlers
  const handleSendFriendRequest = async () => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE_URL}/users/friend-requests`,
        { toUserId: userId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      await loadProfile(); // Reload để cập nhật trạng thái
      alert("Đã gửi lời mời kết bạn!");
    } catch (error) {
      console.error("Lỗi khi gửi lời mời:", error);
      const errorMessage =
        error.response?.data?.error || "Không thể gửi lời mời";

      // Nếu đã có request rồi, reload profile để hiển thị đúng trạng thái
      if (errorMessage === "Đã có yêu cầu kết bạn") {
        await loadProfile(); // Reload để hiển thị "Đang gửi yêu cầu"
        // Không hiển thị alert vì UI đã cập nhật đúng trạng thái
        return;
      }

      alert(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE_URL}/users/friend-requests/${friendRequestId}/accept`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      await loadProfile();
      alert("Đã chấp nhận lời mời kết bạn!");
    } catch (error) {
      console.error("Lỗi khi chấp nhận:", error);
      alert(error.response?.data?.error || "Không thể chấp nhận");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRequest = async () => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem("token");
      await axios.delete(
        `${API_BASE_URL}/users/friend-requests/${friendRequestId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      await loadProfile();
      alert("Đã từ chối lời mời");
    } catch (error) {
      console.error("Lỗi khi từ chối:", error);
      alert(error.response?.data?.error || "Không thể từ chối");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!window.confirm("Bạn có chắc muốn hủy kết bạn?")) {
      return;
    }
    try {
      setActionLoading(true);
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/users/friends/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Reset trạng thái ngay lập tức
      setRelationshipStatus(null);
      setFriendRequestId(null);

      // Reload profile để cập nhật đầy đủ
      await loadProfile();
      alert("Đã hủy kết bạn");
    } catch (error) {
      console.error("Lỗi khi hủy kết bạn:", error);
      alert(error.response?.data?.error || "Không thể hủy kết bạn");
    } finally {
      setActionLoading(false);
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

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading-profile">
          <div className="spinner"></div>
          <p>Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="profile-page">
        <div className="empty-state">
          <p>Không tìm thấy user</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-cover">
          <div className="profile-avatar-container">
            {isOwnProfile ? (
              <label className="avatar-upload-label">
                <div className="profile-avatar-large">
                  {profileUser.avatar ? (
                    <img src={profileUser.avatar} alt={profileUser.name} />
                  ) : (
                    <span>{getInitials(profileUser.name)}</span>
                  )}
                </div>
                {uploadingAvatar ? (
                  <div className="upload-overlay">
                    <div className="spinner-small"></div>
                  </div>
                ) : (
                  <div className="avatar-edit-icon">📷</div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  style={{ display: "none" }}
                  disabled={uploadingAvatar}
                />
              </label>
            ) : (
              <div className="profile-avatar-large">
                {profileUser.avatar ? (
                  <img src={profileUser.avatar} alt={profileUser.name} />
                ) : (
                  <span>{getInitials(profileUser.name)}</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="profile-info">
          <div className="profile-name-section">
            <h1>{profileUser.name}</h1>
            <div className="profile-actions">
              {isOwnProfile ? (
                <button
                  className="edit-profile-btn"
                  onClick={() => setEditing(!editing)}
                >
                  <SettingsIcon size={18} />
                  {editing ? "Hủy" : "Chỉnh sửa"}
                </button>
              ) : (
                <div className="friend-actions">
                  <button
                    className="message-btn-profile"
                    onClick={() => {
                      if (window.openChat) {
                        window.openChat(
                          userId,
                          profileUser.name,
                          profileUser.avatar
                        );
                      }
                    }}
                    title="Nhắn tin"
                  >
                    💬 Nhắn tin
                  </button>
                  {relationshipStatus === "friend" ? (
                    <button
                      className="remove-friend-btn-profile"
                      onClick={handleRemoveFriend}
                      disabled={actionLoading}
                    >
                      <UserIcon size={18} />
                      {actionLoading ? "Đang xử lý..." : "Hủy kết bạn"}
                    </button>
                  ) : relationshipStatus === "sent" ? (
                    <button className="pending-friend-btn-profile" disabled>
                      <UserIcon size={18} />
                      Đang gửi yêu cầu
                    </button>
                  ) : relationshipStatus === "received" ? (
                    <div className="request-actions-profile">
                      <button
                        className="accept-friend-btn-profile"
                        onClick={handleAcceptRequest}
                        disabled={actionLoading}
                      >
                        {actionLoading ? "Đang xử lý..." : "Chấp nhận"}
                      </button>
                      <button
                        className="reject-friend-btn-profile"
                        onClick={handleRejectRequest}
                        disabled={actionLoading}
                      >
                        {actionLoading ? "Đang xử lý..." : "Từ chối"}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="add-friend-btn-profile"
                      onClick={handleSendFriendRequest}
                      disabled={actionLoading}
                    >
                      <UserIcon size={18} />
                      {actionLoading ? "Đang xử lý..." : "Thêm bạn"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {editing ? (
            <div className="edit-profile-form">
              <div className="form-group">
                <label>Tên</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Giới thiệu</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) =>
                    setEditForm({ ...editForm, bio: e.target.value })
                  }
                  className="form-textarea"
                  rows={4}
                  maxLength={200}
                />
                <div className="char-count">{editForm.bio.length}/200</div>
              </div>
              <div className="form-actions">
                <button className="save-btn" onClick={handleSaveProfile}>
                  Lưu
                </button>
                <button
                  className="cancel-btn"
                  onClick={() => {
                    setEditing(false);
                    setEditForm({
                      name: profileUser.name,
                      bio: profileUser.bio || "",
                    });
                  }}
                >
                  Hủy
                </button>
              </div>
            </div>
          ) : (
            <div className="profile-details">
              {!isOwnProfile && (
                <div className="relationship-status">
                  {relationshipStatus === "friend" && (
                    <span className="status-badge friend-badge">✓ Bạn bè</span>
                  )}
                  {relationshipStatus === "sent" && (
                    <span className="status-badge sent-badge">
                      ⏳ Đã gửi lời mời kết bạn
                    </span>
                  )}
                  {relationshipStatus === "received" && (
                    <span className="status-badge received-badge">
                      📩 Đã nhận lời mời kết bạn
                    </span>
                  )}
                  {relationshipStatus === null && (
                    <span className="status-badge none-badge">
                      Chưa kết bạn
                    </span>
                  )}
                </div>
              )}
              {profileUser.bio && (
                <p className="profile-bio">{profileUser.bio}</p>
              )}
              <div className="profile-stats">
                <div className="stat-item">
                  <span className="stat-value">{posts.length}</span>
                  <span className="stat-label">Bài viết</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">
                    {profileUser.friends?.length || 0}
                  </span>
                  <span className="stat-label">Bạn bè</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="profile-content">
        <h2>Bài viết</h2>
        {posts.length === 0 ? (
          <div className="empty-posts">
            <p>Chưa có bài viết nào</p>
          </div>
        ) : (
          <div className="profile-posts">
            {posts.map((post) => (
              <div key={post._id} className="profile-post-card">
                <div className="post-preview">
                  {post.linkPreview?.metadata?.image && (
                    <img
                      src={post.linkPreview.metadata.image}
                      alt="Preview"
                      className="post-preview-img"
                    />
                  )}
                  <div className="post-preview-content">
                    <div className="post-preview-title">
                      {post.linkPreview?.metadata?.title || post.url}
                    </div>
                    <div className="post-preview-time">
                      {new Date(post.createdAt).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
