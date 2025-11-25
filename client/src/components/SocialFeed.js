import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import CreatePost from "./CreatePost";
import Post from "./Post";
import FriendSuggestions from "./FriendSuggestions";
import "./SocialMedia.css";

const normalizePost = (post) => ({
  ...post,
  id: post._id || post.id,
  timestamp: post.createdAt || post.timestamp,
  author: post.author || null,
  reactions: post.reactions || [],
  commentDetails: post.commentDetails || [],
  comments:
    typeof post.comments === "number"
      ? post.comments
      : post.commentDetails?.length || 0,
  shares: post.shares || 0,
  sharedFrom: post.sharedFrom || null,
  sharedFromAuthorName: post.sharedFromAuthorName || "",
});

function SocialFeed({
  isVulnerable,
  onViewProfile,
  focusPostId,
  onFocusConsumed,
}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [isFetchingFocusedPost, setIsFetchingFocusedPost] = useState(false);
  const focusTimeoutRef = useRef(null);

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `http://localhost:3001/api/posts?isVulnerable=${isVulnerable}`
      );
      const formattedPosts = response.data.posts.map((post) =>
        normalizePost(post)
      );
      setPosts(formattedPosts);
    } catch (error) {
      console.error("Lỗi khi load posts:", error);
      if (error.response?.status === 401) {
        // Token hết hạn, sẽ được xử lý bởi AuthContext
      }
    } finally {
      setLoading(false);
    }
  }, [isVulnerable]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    const handlePostDeleted = (event) => {
      const deletedId = event.detail;
      setPosts((prev) =>
        prev.filter((post) => (post._id || post.id)?.toString() !== deletedId)
      );
    };

    window.addEventListener("post_deleted", handlePostDeleted);
    return () => window.removeEventListener("post_deleted", handlePostDeleted);
  }, []);

  const handlePostCreated = (newPost) => {
    const normalizedPost = normalizePost(newPost);
    setPosts((prev) => [normalizedPost, ...prev]);
  };

  const handlePostShared = (sharedPost, originalPostId, totalShares) => {
    const normalizedShared = normalizePost(sharedPost);
    setPosts((prev) => [
      normalizedShared,
      ...prev.map((post) =>
        (post._id || post.id)?.toString() === originalPostId?.toString()
          ? { ...post, shares: totalShares }
          : post
      ),
    ]);
  };

  const scrollToPost = useCallback(
    (targetPostId) => {
      if (!targetPostId) return false;
      const element = document.getElementById(`post-${targetPostId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedPostId(targetPostId);
        if (focusTimeoutRef.current) {
          clearTimeout(focusTimeoutRef.current);
        }
        focusTimeoutRef.current = setTimeout(() => {
          setHighlightedPostId(null);
        }, 2500);
        onFocusConsumed?.();
        return true;
      }
      return false;
    },
    [onFocusConsumed]
  );

  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!focusPostId) return;
    const targetId = focusPostId.toString();
    const hasPost =
      posts.findIndex(
        (post) => (post._id || post.id)?.toString() === targetId
      ) !== -1;

    if (hasPost) {
      scrollToPost(targetId);
    } else if (!isFetchingFocusedPost) {
      setIsFetchingFocusedPost(true);
      loadPosts()
        .then(() => {
          setTimeout(() => {
            scrollToPost(targetId);
          }, 200);
        })
        .finally(() => setIsFetchingFocusedPost(false));
    }
  }, [focusPostId, posts, scrollToPost, loadPosts, isFetchingFocusedPost]);

  return (
    <div className="social-feed">
      <CreatePost
        onPostCreated={handlePostCreated}
        isVulnerable={isVulnerable}
      />

      <FriendSuggestions onViewProfile={onViewProfile} />

      <div className="posts-container">
        {loading ? (
          <div className="loading-posts">
            <div className="spinner"></div>
            <p>Đang tải posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-feed">
            <div className="empty-feed-icon">📭</div>
            <h3>Chưa có bài viết nào</h3>
            <p>Tạo bài viết đầu tiên bằng cách paste link và tạo preview!</p>
          </div>
        ) : (
          posts.map((post) => (
            <Post
              key={post.id || post._id}
              post={post}
              isVulnerable={isVulnerable}
              onViewProfile={onViewProfile}
              onPostShared={handlePostShared}
              highlighted={
                highlightedPostId &&
                (post.id?.toString() === highlightedPostId.toString() ||
                  post._id?.toString() === highlightedPostId.toString())
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

export default SocialFeed;
