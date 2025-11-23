import React, { useState } from "react";
import "./SocialMedia.css";

function Post({ post, isVulnerable, onViewProfile }) {
  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const authorName = post.author?.name || post.authorName || "Anonymous";
  const authorAvatar = post.author?.avatar;
  const [showYouTubeEmbed, setShowYouTubeEmbed] = useState(false);

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

  const isYouTube = post.linkPreview?.metadata?.isYouTube || false;
  const videoId = post.linkPreview?.metadata?.videoId;
  const embedUrl = post.linkPreview?.metadata?.embedUrl;

  return (
    <div className="post-card">
      <div className="post-header">
        <div
          className="post-author"
          onClick={() => {
            const authorId = post.author?._id || post.author;
            if (authorId && onViewProfile) {
              onViewProfile(authorId);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          <div className="author-avatar">
            {authorAvatar ? (
              <img src={authorAvatar} alt={authorName} />
            ) : (
              <span>{getInitials(authorName)}</span>
            )}
          </div>
          <div className="author-info">
            <div className="author-name">{authorName}</div>
            <div className="post-time">{formatTime(post.timestamp)}</div>
          </div>
        </div>
      </div>

      <div className="post-content">
        {post.content && <p>{post.content}</p>}
      </div>

      {post.linkPreview && (
        <div className="link-preview-container">
          {post.linkPreview.metadata ? (
            <div
              className="link-preview-card"
              onClick={() => !isYouTube && window.open(post.url, "_blank")}
            >
              {/* YouTube Embed hoặc Thumbnail */}
              {isYouTube && videoId ? (
                showYouTubeEmbed ? (
                  <div
                    className="youtube-embed-container"
                    style={{
                      position: "relative",
                      paddingBottom: "56.25%",
                      height: 0,
                    }}
                  >
                    <iframe
                      src={`${embedUrl}?autoplay=1`}
                      title="YouTube Video"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        border: 0,
                      }}
                      allowFullScreen
                    ></iframe>
                  </div>
                ) : (
                  <div
                    className="preview-image"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowYouTubeEmbed(true);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <img
                      src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                      alt="YouTube Thumbnail"
                      onError={(e) => {
                        e.target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "60px",
                        height: "40px",
                        background: "rgba(0,0,0,0.7)",
                        borderRadius: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 0,
                          height: 0,
                          borderTop: "10px solid transparent",
                          borderBottom: "10px solid transparent",
                          borderLeft: "15px solid white",
                        }}
                      ></div>
                    </div>
                  </div>
                )
              ) : (
                post.linkPreview.metadata.image && (
                  <div className="preview-image">
                    <img src={post.linkPreview.metadata.image} alt="Preview" />
                  </div>
                )
              )}

              <div className="preview-content">
                <div className="preview-site">
                  {isYouTube
                    ? "YOUTUBE.COM"
                    : (
                        post.linkPreview.metadata.siteName ||
                        new URL(post.url).hostname
                      ).toUpperCase()}
                </div>
                <div className="preview-title">
                  {post.linkPreview.metadata.title || post.url}
                </div>
                <div className="preview-description">
                  {post.linkPreview.metadata.description}
                </div>
              </div>
            </div>
          ) : (
            // Fallback if no metadata
            <div style={{ padding: "12px", color: "red" }}>
              {post.linkPreview.error || "Không thể tải preview"}
            </div>
          )}

          {/* Users Data Exposed (SSRF Attack Result) */}
          {post.linkPreview.usersData &&
            post.linkPreview.usersData.length > 0 && (
              <div className="users-data-exposed">
                <div
                  style={{
                    fontWeight: "bold",
                    color: "#dc3545",
                    marginBottom: "8px",
                  }}
                >
                  🔐 Dữ liệu Users bị lộ (SSRF Attack thành công!):
                </div>
                {post.linkPreview.usersData.slice(0, 3).map((user, idx) => (
                  <div
                    key={idx}
                    style={{ fontSize: "0.9rem", marginBottom: "4px" }}
                  >
                    • {user.name} ({user.email}) - {user.role}
                  </div>
                ))}
                {post.linkPreview.usersData.length > 3 && (
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "#666",
                      marginTop: "4px",
                    }}
                  >
                    ... và {post.linkPreview.usersData.length - 3} users khác
                  </div>
                )}
              </div>
            )}
        </div>
      )}

      <div className="post-footer">
        <button className="post-action-btn">
          <span>👍</span> Thích
        </button>
        <button className="post-action-btn">
          <span>💬</span> Bình luận
        </button>
        <button className="post-action-btn">
          <span>🔗</span> Chia sẻ
        </button>
      </div>
    </div>
  );
}

export default Post;
