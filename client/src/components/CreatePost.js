import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import CreatePostModal from "./CreatePostModal";
import "./CreatePost.css";

function CreatePost({ onPostCreated, isVulnerable }) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <div className="create-post-prompt" onClick={() => setShowModal(true)}>
        <div className="create-post-prompt-avatar">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} />
          ) : (
            <span>{getInitials(user.name)}</span>
          )}
        </div>
        <div className="create-post-prompt-input">Bạn đang nghĩ gì?</div>
      </div>

      <CreatePostModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onPostCreated={onPostCreated}
        isVulnerable={isVulnerable}
      />
    </>
  );
}

export default CreatePost;
