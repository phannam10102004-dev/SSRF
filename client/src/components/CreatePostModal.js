import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import "./CreatePostModal.css";

const API_BASE_URL = "http://localhost:3001/api";

function CreatePostModal({ isOpen, onClose, onPostCreated, isVulnerable }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [images, setImages] = useState([]);
  const [linkPreview, setLinkPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const previewTimeoutRef = useRef(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Tự động detect và fetch preview khi có link trong content
  useEffect(() => {
    // Clear timeout cũ
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    // Đợi 1 giây sau khi user ngừng gõ để fetch preview
    previewTimeoutRef.current = setTimeout(() => {
      if (content.trim()) {
        const urlPattern = /(https?:\/\/[^\s]+)/g;
        const matches = content.match(urlPattern);
        if (matches && matches.length > 0) {
          const detectedUrl = matches[0];
          fetchLinkPreview(detectedUrl);
        } else {
          setLinkPreview(null);
        }
      } else {
        setLinkPreview(null);
      }
    }, 1000);

    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [content]);

  const fetchLinkPreview = async (linkUrl) => {
    if (!linkUrl || linkUrl.trim() === "") {
      setLinkPreview(null);
      return;
    }

    // Kiểm tra xem URL có thay đổi không (tránh fetch lại cùng URL)
    if (linkPreview && linkPreview.url === linkUrl) {
      return;
    }

    setPreviewLoading(true);
    setError(null);

    try {
      const endpoint = isVulnerable
        ? `${API_BASE_URL}/vulnerable/preview`
        : `${API_BASE_URL}/secure/preview`;

      const response = await axios.post(endpoint, { url: linkUrl });
      setLinkPreview({
        ...response.data,
        url: linkUrl, // Lưu URL để so sánh
      });
    } catch (err) {
      console.error("Lỗi khi fetch preview:", err);
      // Vẫn cho phép tạo post dù preview lỗi
      setLinkPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length === 0) {
      setError("Vui lòng chọn file ảnh");
      return;
    }

    // Preview images trước khi upload
    const newImages = imageFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setImages((prev) => [...prev, ...newImages]);
    e.target.value = ""; // Reset input
  };

  const removeImage = (index) => {
    setImages((prev) => {
      const newImages = prev.filter((_, i) => i !== index);
      // Revoke object URL để tránh memory leak
      URL.revokeObjectURL(prev[index].preview);
      return newImages;
    });
  };

  const removeLinkPreview = () => {
    setLinkPreview(null);
    // Xóa link khỏi content
    if (content) {
      const urlPattern = /(https?:\/\/[^\s]+)/g;
      const newContent = content.replace(urlPattern, "").trim();
      setContent(newContent);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!content.trim() && images.length === 0 && !linkPreview) {
      setError("Vui lòng nhập nội dung, thêm ảnh hoặc link");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();

      // Lấy URL từ content hoặc từ linkPreview
      let url = "";
      if (linkPreview && linkPreview.url) {
        url = linkPreview.url;
      } else if (content) {
        const urlPattern = /(https?:\/\/[^\s]+)/g;
        const matches = content.match(urlPattern);
        if (matches && matches.length > 0) {
          url = matches[0];
        }
      }

      // Xóa URL khỏi content khi submit (vì đã có preview riêng)
      let cleanContent = content.trim();
      if (url && linkPreview) {
        cleanContent = cleanContent.replace(url, "").trim();
      }

      formData.append("content", cleanContent);
      if (linkPreview) {
        formData.append("url", url);
        formData.append("linkPreview", JSON.stringify(linkPreview));
      }
      formData.append("isVulnerable", isVulnerable);

      // Upload images
      images.forEach((img, index) => {
        formData.append("images", img.file);
      });

      const response = await axios.post(`${API_BASE_URL}/posts`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      const createdPost = response.data.post;
      const newPost = {
        ...createdPost,
        id: createdPost._id,
        timestamp: createdPost.createdAt,
        reactions: createdPost.reactions || [],
        commentDetails: createdPost.commentDetails || [],
        comments:
          typeof createdPost.comments === "number"
            ? createdPost.comments
            : createdPost.commentDetails?.length || 0,
        shares: createdPost.shares || 0,
      };

      onPostCreated(newPost);
      handleClose();
    } catch (err) {
      console.error("Lỗi khi tạo post:", err);
      setError(err.response?.data?.error || "Có lỗi xảy ra khi tạo bài đăng");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setContent("");
    setImages([]);
    setLinkPreview(null);
    setError(null);
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    onClose();
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

  if (!isOpen) return null;

  return (
    <div className="create-post-modal-overlay" onClick={handleClose}>
      <div className="create-post-modal" onClick={(e) => e.stopPropagation()}>
        <div className="create-post-modal-header">
          <h2>Tạo bài viết</h2>
          <button className="create-post-modal-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="create-post-modal-body">
          <div className="create-post-modal-user">
            <div className="create-post-modal-avatar">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} />
              ) : (
                <span>{getInitials(user.name)}</span>
              )}
            </div>
            <div className="create-post-modal-user-info">
              <div className="create-post-modal-name">{user.name}</div>
              <button className="create-post-modal-privacy">
                <span>🌐</span> Công khai <span>▼</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <textarea
              ref={textareaRef}
              className="create-post-modal-textarea"
              placeholder="Bạn đang nghĩ gì?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={(e) => {
                // Cho phép paste bình thường, useEffect sẽ tự detect link
                const pastedText = e.clipboardData.getData("text");
                const currentContent = content;
                const cursorPos = e.target.selectionStart;
                const newContent =
                  currentContent.slice(0, cursorPos) +
                  pastedText +
                  currentContent.slice(cursorPos);
                setContent(newContent);
              }}
              rows={4}
            />

            {/* Link Preview */}
            {previewLoading && (
              <div className="create-post-modal-preview-loading">
                Đang tải preview...
              </div>
            )}

            {linkPreview && linkPreview.metadata && (
              <div className="create-post-modal-link-preview">
                <button
                  type="button"
                  className="create-post-modal-remove-preview"
                  onClick={removeLinkPreview}
                  title="Xóa preview"
                >
                  ×
                </button>
                {linkPreview.metadata.image && (
                  <div className="create-post-modal-preview-image">
                    <img
                      src={linkPreview.metadata.image}
                      alt={linkPreview.metadata.title}
                    />
                    <div className="create-post-modal-preview-controls">
                      <button type="button" title="Refresh">
                        🔄
                      </button>
                      <button type="button" title="Delete">
                        🗑️
                      </button>
                    </div>
                  </div>
                )}
                <div className="create-post-modal-preview-content">
                  <div className="create-post-modal-preview-site">
                    {linkPreview.metadata.siteName || "YOUTUBE.COM"}
                  </div>
                  <div className="create-post-modal-preview-title">
                    {linkPreview.metadata.title}
                  </div>
                  {linkPreview.metadata.description && (
                    <div className="create-post-modal-preview-description">
                      {linkPreview.metadata.description}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Images Preview */}
            {images.length > 0 && (
              <div className="create-post-modal-images">
                {images.map((img, index) => (
                  <div key={index} className="create-post-modal-image-item">
                    <img src={img.preview} alt={`Preview ${index + 1}`} />
                    <button
                      type="button"
                      className="create-post-modal-remove-image"
                      onClick={() => removeImage(index)}
                      title="Xóa ảnh"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && <div className="create-post-modal-error">{error}</div>}

            <div className="create-post-modal-actions">
              <div className="create-post-modal-add-options">
                <label className="create-post-modal-add-btn">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    style={{ display: "none" }}
                  />
                  <span>📷</span> Ảnh/Video
                </label>
                <button type="button" className="create-post-modal-add-btn">
                  <span>👤</span> Gắn thẻ
                </button>
                <button type="button" className="create-post-modal-add-btn">
                  <span>😊</span> Cảm xúc
                </button>
                <button type="button" className="create-post-modal-add-btn">
                  <span>📍</span> Vị trí
                </button>
                <button type="button" className="create-post-modal-add-btn">
                  <span>💬</span>
                </button>
                <button type="button" className="create-post-modal-add-btn">
                  <span>⋯</span>
                </button>
              </div>
            </div>

            <div className="create-post-modal-footer">
              <button
                type="submit"
                className="create-post-modal-submit"
                disabled={
                  loading ||
                  (!content.trim() && images.length === 0 && !linkPreview)
                }
              >
                {loading ? "Đang đăng..." : "Đăng"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreatePostModal;
