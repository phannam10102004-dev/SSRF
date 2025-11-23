import React, { useState, useEffect } from "react";
import axios from "axios";
import CreatePost from "./CreatePost";
import Post from "./Post";
import FriendSuggestions from "./FriendSuggestions";
import "./SocialMedia.css";

function SocialFeed({ isVulnerable, onViewProfile }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPosts();
  }, [isVulnerable]);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `http://localhost:3001/api/posts?isVulnerable=${isVulnerable}`
      );
      const formattedPosts = response.data.posts.map((post) => ({
        ...post,
        id: post._id,
        timestamp: post.createdAt,
        author: post.author || null,
      }));
      setPosts(formattedPosts);
    } catch (error) {
      console.error("Lỗi khi load posts:", error);
      if (error.response?.status === 401) {
        // Token hết hạn, sẽ được xử lý bởi AuthContext
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePostCreated = (newPost) => {
    setPosts([newPost, ...posts]);
  };

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
            />
          ))
        )}
      </div>
    </div>
  );
}

export default SocialFeed;
