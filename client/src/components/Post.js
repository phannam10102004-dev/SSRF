import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import "./SocialMedia.css";
import { LikeIcon, CommentBubbleIcon, ShareIcon, MoreIcon } from "./Icons";
import CreatePostModal from "./CreatePostModal";

const API_BASE_URL = "http://localhost:3001/api";
const REACTION_OPTIONS = [
  { type: "like", emoji: "👍", label: "Thích" },
  { type: "love", emoji: "❤️", label: "Yêu thích" },
  { type: "haha", emoji: "😆", label: "Haha" },
  { type: "wow", emoji: "😮", label: "Wow" },
  { type: "sad", emoji: "😢", label: "Buồn" },
  { type: "angry", emoji: "😡", label: "Phẫn nộ" },
];

const normalizeComment = (comment) => {
  if (!comment) return null;
  const normalizedUser =
    typeof comment.user === "object" && comment.user !== null
      ? comment.user
      : null;

  return {
    ...comment,
    user: normalizedUser,
    userName:
      normalizedUser?.name ||
      comment.userName ||
      comment.authorName ||
      "Người dùng",
    userAvatar: normalizedUser?.avatar || comment.userAvatar || null,
  };
};

function Post({
  post,
  isVulnerable,
  onViewProfile,
  onPostShared,
  highlighted = false,
}) {
  const { user } = useAuth();
  const postId = post._id || post.id;
  const rawUserId = user?.id || user?._id;
  const currentUserId = rawUserId ? rawUserId.toString() : null;
  const [reactions, setReactions] = useState(post.reactions || []);
  const [showReactions, setShowReactions] = useState(false);
  const [updatingReaction, setUpdatingReaction] = useState(false);
  const [reactionError, setReactionError] = useState("");
  const [comments, setComments] = useState(
    (post.commentDetails || []).map(normalizeComment).filter(Boolean)
  );
  const [commentCount, setCommentCount] = useState(
    typeof post.comments === "number"
      ? post.comments
      : post.commentDetails?.length || 0
  );
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [commentError, setCommentError] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  const [shareCount, setShareCount] = useState(post.shares || 0);
  const [sharing, setSharing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [showActions, setShowActions] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const popoverTimeoutRef = useRef(null);
  const actionsRef = useRef(null);

  // ... (keep getInitials and other hooks)

  // ... (keep useEffects)

  // ... (keep helper functions)

  // ... (keep reaction logic)

  // ... (keep comment logic)

  // ... (keep share logic)

  const canDeletePost =
    currentUserId &&
    (currentUserId ===
      (post.author?._id?.toString() || post.author?.toString()) ||
      user?.role === "admin");

  const handleDeletePost = async () => {
    if (!canDeletePost) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa bài viết này?")) return;

    try {
      await axios.delete(`${API_BASE_URL}/posts/${postId}`);
      window.dispatchEvent(new CustomEvent("post_deleted", { detail: postId }));
    } catch (error) {
      setReactionError(error.response?.data?.error || "Không thể xóa bài viết");
    } finally {
      setShowActions(false);
    }
  };

  const handlePostUpdated = (updatedPost) => {
    // Dispatch event to update parent list or update local state if we had it.
    // Since Post receives 'post' as prop, ideally parent should update.
    // We can dispatch an event that SocialFeed listens to.
    window.dispatchEvent(new CustomEvent("post_updated", { detail: updatedPost }));
    setShowEditModal(false);
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

  const authorName = post.author?.name || post.authorName || "Anonymous";
  const authorAvatar = post.author?.avatar;
  const [showYouTubeEmbed, setShowYouTubeEmbed] = useState(false);
  const sharedFromAuthorName = post.sharedFromAuthorName;

  useEffect(() => {
    setReactions(post.reactions || []);
  }, [post.reactions]);

  useEffect(() => {
    setComments(
      (post.commentDetails || []).map(normalizeComment).filter(Boolean)
    );
    setCommentCount(
      typeof post.comments === "number"
        ? post.comments
        : post.commentDetails?.length || 0
    );
  }, [post.commentDetails, post.comments]);

  useEffect(() => {
    setShareCount(post.shares || 0);
  }, [post.shares]);

  useEffect(() => {
    if (!reactionError) return;
    const timer = setTimeout(() => setReactionError(""), 3000);
    return () => clearTimeout(timer);
  }, [reactionError]);

  useEffect(() => {
    if (!commentError) return;
    const timer = setTimeout(() => setCommentError(""), 3000);
    return () => clearTimeout(timer);
  }, [commentError]);

  useEffect(() => {
    return () => {
      if (popoverTimeoutRef.current) {
        clearTimeout(popoverTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target)) {
        setShowActions(false);
      }
    };

    if (showActions) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showActions]);

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

  const getReactionUserId = (reaction) => {
    if (!reaction || !reaction.user) return null;
    if (typeof reaction.user === "string") return reaction.user;
    if (reaction.user._id) return reaction.user._id.toString();
    if (typeof reaction.user === "object" && reaction.user.toString) {
      return reaction.user.toString();
    }
    return null;
  };

  const userReaction = useMemo(() => {
    if (!currentUserId) return null;
    return reactions.find(
      (reaction) => getReactionUserId(reaction) === currentUserId
    );
  }, [currentUserId, reactions]);

  const reactionCounts = useMemo(() => {
    if (!Array.isArray(reactions)) return {};
    return reactions.reduce((acc, reaction) => {
      if (!reaction?.type) {
        return acc;
      }
      acc[reaction.type] = (acc[reaction.type] || 0) + 1;
      return acc;
    }, {});
  }, [reactions]);

  const reactionSummary = useMemo(() => {
    return Object.entries(reactionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => ({
        type,
        count,
        emoji: REACTION_OPTIONS.find((opt) => opt.type === type)?.emoji || "",
      }));
  }, [reactionCounts]);

  const currentReactionOption = useMemo(() => {
    if (!userReaction) return null;
    return REACTION_OPTIONS.find((opt) => opt.type === userReaction.type);
  }, [userReaction]);

  const sortedComments = useMemo(() => {
    if (!Array.isArray(comments)) return [];
    return [...comments].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
  }, [comments]);

  const updateReactions = async (type) => {
    if (!currentUserId) {
      setReactionError("Bạn cần đăng nhập để thả cảm xúc");
      return;
    }
    if (updatingReaction) return;

    const prevState = Array.isArray(reactions) ? [...reactions] : [];
    const isSameReaction = userReaction?.type === type;
    setUpdatingReaction(true);
    setReactionError("");

    // Optimistic update
    if (isSameReaction) {
      setReactions(
        reactions.filter(
          (reaction) => getReactionUserId(reaction) !== currentUserId
        )
      );
    } else {
      const filtered = reactions.filter(
        (reaction) => getReactionUserId(reaction) !== currentUserId
      );
      setReactions([
        ...filtered,
        {
          user: currentUserId,
          type,
        },
      ]);
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/posts/${postId}/reactions`,
        { type }
      );
      setReactions(response.data.post.reactions || []);
    } catch (error) {
      setReactions(prevState);
      setReactionError(
        error.response?.data?.error || "Không thể cập nhật cảm xúc"
      );
    } finally {
      setUpdatingReaction(false);
    }
  };

  const handleMainReactionClick = () => {
    if (userReaction?.type) {
      updateReactions(userReaction.type);
    } else {
      updateReactions("like");
    }
  };

  const handleReactionOptionClick = (type) => {
    updateReactions(type);
    hideReactionPopover();
  };

  const showReactionPopover = () => {
    if (!currentUserId) {
      setReactionError("Bạn cần đăng nhập để thả cảm xúc");
      return;
    }
    if (popoverTimeoutRef.current) {
      clearTimeout(popoverTimeoutRef.current);
    }
    setShowReactions(true);
  };

  const hideReactionPopover = () => {
    if (popoverTimeoutRef.current) {
      clearTimeout(popoverTimeoutRef.current);
    }
    popoverTimeoutRef.current = setTimeout(() => {
      setShowReactions(false);
    }, 150);
  };

  const loadComments = async () => {
    try {
      setLoadingComments(true);
      const response = await axios.get(
        `${API_BASE_URL}/posts/${postId}/comments`
      );
      const normalized = (response.data.comments || [])
        .map(normalizeComment)
        .filter(Boolean);
      setComments(normalized);
      setCommentCount(response.data.total || 0);
    } catch (error) {
      setCommentError("Không thể tải bình luận");
    } finally {
      setLoadingComments(false);
    }
  };

  const handleToggleComments = () => {
    if (!currentUserId) {
      setCommentError("Bạn cần đăng nhập để xem bình luận");
      return;
    }
    const nextState = !showComments;
    setShowComments(nextState);
    if (nextState && comments.length === 0) {
      loadComments();
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!currentUserId) {
      setCommentError("Bạn cần đăng nhập để bình luận");
      return;
    }
    if (!commentInput.trim()) {
      setCommentError("Vui lòng nhập nội dung bình luận");
      return;
    }
    if (commentInput.trim().length > 500) {
      setCommentError("Bình luận tối đa 500 ký tự");
      return;
    }

    try {
      setAddingComment(true);
      const response = await axios.post(
        `${API_BASE_URL}/posts/${postId}/comments`,
        { content: commentInput.trim() }
      );

      if (response.data?.comment) {
        const normalizedComment = normalizeComment(response.data.comment) || {
          ...response.data.comment,
          user: {
            _id: currentUserId,
            name: user?.name || "Bạn",
            avatar: user?.avatar || null,
          },
          userName: user?.name || "Bạn",
          userAvatar: user?.avatar || null,
        };
        setComments((prev) => [...prev, normalizedComment].filter(Boolean));
      }
      if (typeof response.data?.total === "number") {
        setCommentCount(response.data.total);
      } else {
        setCommentCount((prev) => prev + 1);
      }
      setCommentInput("");
      setShowComments(true);
    } catch (error) {
      setCommentError(error.response?.data?.error || "Không thể gửi bình luận");
    } finally {
      setAddingComment(false);
    }
  };

  const handleSharePost = async () => {
    if (!currentUserId) {
      setShareFeedback("Bạn cần đăng nhập để chia sẻ");
      return;
    }

    try {
      setSharing(true);
      setShareFeedback("");
      const response = await axios.post(
        `${API_BASE_URL}/posts/${postId}/share`
      );
      const latestShares =
        typeof response.data?.shares === "number"
          ? response.data.shares
          : shareCount + 1;
      setShareCount(latestShares);

      if (response.data?.sharedPost) {
        onPostShared?.(
          response.data.sharedPost,
          response.data.originalPostId || postId,
          latestShares
        );
      }

      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: authorName,
            text: post.content || "Xem bài viết này",
            url: post.url || window.location.href,
          });
        } catch (err) {
          // user canceled share; ignore
        }
      } else if (
        post.url &&
        typeof navigator !== "undefined" &&
        navigator.clipboard
      ) {
        await navigator.clipboard.writeText(post.url);
        setShareFeedback("Đã sao chép liên kết bài viết");
      } else {
        setShareFeedback("Đã cập nhật lượt chia sẻ");
      }
    } catch (error) {
      setShareFeedback(
        error.response?.data?.error || "Không thể chia sẻ bài viết"
      );
    } finally {
      setSharing(false);
      setTimeout(() => setShareFeedback(""), 3000);
    }
  };





  return (
    <div
      className={`post-card ${highlighted ? "post-highlight" : ""}`}
      id={`post-${postId}`}
    >
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
            {sharedFromAuthorName && (
              <div className="shared-from">
                Đã chia sẻ bài viết của <span>{sharedFromAuthorName}</span>
              </div>
            )}
          </div>
        </div>
        {canDeletePost && (
          <div className="post-actions" ref={actionsRef}>
            <button
              className="post-action-menu"
              onClick={() => setShowActions((prev) => !prev)}
              title="Tùy chọn"
            >
              <MoreIcon size={18} color="var(--text-muted)" />
            </button>
            {showActions && (
              <div className="post-action-dropdown">
                {currentUserId === (post.author?._id?.toString() || post.author?.toString()) && (
                  <button onClick={() => {
                    setShowEditModal(true);
                    setShowActions(false);
                  }}>Sửa bài viết</button>
                )}
                <button onClick={handleDeletePost}>Xóa bài viết</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="post-content">
        {post.content && <p>{post.content}</p>}
      </div>

      {showEditModal && (
        <CreatePostModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          postToEdit={post}
          onPostUpdated={handlePostUpdated}
          isVulnerable={isVulnerable}
        />
      )}

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

      {reactions.length > 0 && (
        <div className="reaction-summary">
          <div className="reaction-summary-icons">
            {reactionSummary.map((item) => (
              <span key={item.type} className="reaction-summary-icon">
                {item.emoji}
              </span>
            ))}
          </div>
          <span className="reaction-total">{reactions.length}</span>
        </div>
      )}

      <div className="post-footer">
        <div
          className="reaction-wrapper"
          onMouseEnter={showReactionPopover}
          onMouseLeave={hideReactionPopover}
        >
          <button
            className={`post-action-btn reaction-btn ${
              userReaction ? "active" : ""
            }`}
            onClick={handleMainReactionClick}
            disabled={updatingReaction}
          >
            <LikeIcon size={18} />
            <span>{currentReactionOption?.label || "Thích"}</span>
          </button>
          {showReactions && (
            <div
              className="reaction-popover"
              onMouseEnter={showReactionPopover}
              onMouseLeave={hideReactionPopover}
            >
              {REACTION_OPTIONS.map((option) => (
                <button
                  key={option.type}
                  className={`reaction-option ${
                    option.type === userReaction?.type ? "selected" : ""
                  }`}
                  onClick={() => handleReactionOptionClick(option.type)}
                  disabled={updatingReaction}
                  title={option.label}
                >
                  <span className="reaction-option-emoji">{option.emoji}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="post-action-btn" onClick={handleToggleComments}>
          <CommentBubbleIcon size={18} />
          <span>
            {commentCount > 0 ? `Bình luận (${commentCount})` : "Bình luận"}
          </span>
        </button>
        <button
          className="post-action-btn"
          onClick={handleSharePost}
          disabled={sharing}
        >
          <ShareIcon size={18} />
          <span>
            {sharing
              ? "Đang chia sẻ..."
              : shareCount > 0
              ? `Chia sẻ (${shareCount})`
              : "Chia sẻ"}
          </span>
        </button>
      </div>
      {reactionError && <div className="reaction-error">{reactionError}</div>}
      {shareFeedback && <div className="share-feedback">{shareFeedback}</div>}

      {showComments && (
        <div className="comments-box">
          {loadingComments ? (
            <div className="loading-posts" style={{ padding: "12px 0" }}>
              <div className="spinner" style={{ width: 24, height: 24 }}></div>
              <p style={{ marginTop: 8 }}>Đang tải bình luận...</p>
            </div>
          ) : sortedComments.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Hãy là người bình luận đầu tiên!
            </p>
          ) : (
            sortedComments.map((comment) => {
              const commentUser =
                typeof comment.user === "object" ? comment.user : null;
              const commentDisplayName =
                comment.userName || commentUser?.name || "Người dùng";
              const commentInitials = getInitials(commentDisplayName);
              return (
                <div
                  key={comment._id || comment.createdAt}
                  className="comment-item"
                >
                  <div className="author-avatar comment-avatar">
                    {commentUser?.avatar || comment.userAvatar ? (
                      <img
                        src={commentUser?.avatar || comment.userAvatar}
                        alt={commentDisplayName}
                      />
                    ) : (
                      <span>{commentInitials}</span>
                    )}
                  </div>
                  <div className="comment-bubble">
                    <span className="comment-author">{commentDisplayName}</span>
                    <span className="comment-text">{comment.content}</span>
                    <div className="comment-time">
                      {formatTime(comment.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <form className="comment-input" onSubmit={handleSubmitComment}>
            <input
              type="text"
              placeholder="Viết bình luận..."
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              disabled={addingComment}
            />
            <button type="submit" disabled={addingComment}>
              {addingComment ? "Đang gửi..." : "Gửi"}
            </button>
          </form>
          {commentError && <div className="comment-error">{commentError}</div>}
        </div>
      )}
    </div>
  );
}

export default Post;
