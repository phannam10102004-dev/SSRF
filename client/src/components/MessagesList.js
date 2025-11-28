import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { useAuth } from "../contexts/AuthContext";
import ChatWindow from "./ChatWindow";
import "./MessagesList.css";

const API_BASE_URL = "http://localhost:3001/api";
const SOCKET_URL = "http://localhost:3001";

function MessagesList({ onChatsChange, onSocketChange, isOpen, onToggle, onOpenChat, openChats }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  // const [openChats, setOpenChats] = useState([]); // Removed local state
  const [conversations, setConversations] = useState([]);
  const [showList, setShowList] = useState(false);
  const iconRef = useRef(null);
  const dropdownRef = useRef(null);

  // Đồng bộ với prop isOpen từ parent
  useEffect(() => {
    if (isOpen !== showList) {
      setShowList(isOpen);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!user) return;

    // Kết nối Socket.io
    const token = localStorage.getItem("token");
    const newSocket = io(SOCKET_URL, {
      auth: {
        token: token,
      },
      query: {
        token: token,
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      console.log("✅ Đã kết nối Socket.io");
    });

    newSocket.on("connect_error", (error) => {
      console.error("❌ Lỗi kết nối Socket.io:", error);
    });

    setSocket(newSocket);

    // Load conversations
    loadConversations();

    return () => {
      newSocket.close();
    };
  }, [user]);

  // Tính toán vị trí dropdown dựa trên vị trí icon
  useEffect(() => {
    if (showList && iconRef.current && dropdownRef.current) {
      const updatePosition = () => {
        const iconRect = iconRef.current.getBoundingClientRect();
        const dropdown = dropdownRef.current;

        if (iconRect && dropdown) {
          // Đặt vị trí dropdown dựa trên vị trí icon
          dropdown.style.top = `${iconRect.bottom + 8}px`;
          dropdown.style.right = `${window.innerWidth - iconRect.right}px`;
          // Đảm bảo z-index cao nhất
          dropdown.style.zIndex = "999999";
        }
      };

      updatePosition();

      // Cập nhật lại khi scroll hoặc resize
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);

      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [showList]);

  // Xử lý click outside để đóng dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showList &&
        iconRef.current &&
        dropdownRef.current &&
        !iconRef.current.contains(event.target) &&
        !dropdownRef.current.contains(event.target)
      ) {
        setShowList(false);
        if (onToggle) {
          onToggle(false);
        }
      }
    };

    if (showList) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showList, onToggle]);

  // Tách riêng useEffect để set socket cho parent
  useEffect(() => {
    if (socket && onSocketChange) {
      onSocketChange(socket);
    }
  }, [socket, onSocketChange]);

  const loadConversations = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error("Lỗi khi load conversations:", error);
    }
  };

  const openChat = (userId, userName, userAvatar) => {
      if (onOpenChat) {
          onOpenChat(userId, userName, userAvatar);
      }
  };

  // Expose openChat globally - Keep for backward compatibility if needed
  useEffect(() => {
    window.openChat = openChat;
    return () => {
      delete window.openChat;
    };
  }, [openChat]);

  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const totalUnread = conversations.reduce(
    (sum, conv) => sum + (conv.unreadCount || 0),
    0
  );

  return (
    <>
      {/* Icon Messages */}
      <div className="messages-icon-container" ref={iconRef}>
        <div
          className="messages-icon-btn"
          onClick={() => {
            const newState = !showList;
            setShowList(newState);
            if (onToggle) {
              onToggle(newState);
            }
          }}
        >
          💬
          {totalUnread > 0 && (
            <span className="messages-badge">{totalUnread}</span>
          )}
        </div>
      </div>

      {/* Dropdown list conversations - Render ra ngoài để tránh stacking context của Header */}
      {showList && (
        <div className="messages-dropdown" ref={dropdownRef}>
          <div className="messages-header">
            <h3>Tin nhắn</h3>
          </div>
          <div className="messages-list">
            {conversations.length === 0 ? (
              <div className="empty-messages">
                <p>Chưa có cuộc trò chuyện nào</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const otherUser = conv.participants.find(
                  (p) => p._id !== user.id
                );
                if (!otherUser) return null;

                return (
                  <div
                    key={conv._id}
                    className="conversation-item"
                    onClick={() => {
                      openChat(otherUser._id, otherUser.name, otherUser.avatar);
                      setShowList(false);
                    }}
                  >
                    <div className="conversation-avatar">
                      {otherUser.avatar ? (
                        <img src={otherUser.avatar} alt={otherUser.name} />
                      ) : (
                        <span>{getInitials(otherUser.name)}</span>
                      )}
                    </div>
                    <div className="conversation-info">
                      <div className="conversation-name">{otherUser.name}</div>
                      <div className="conversation-preview">
                        {conv.lastMessage
                          ? conv.lastMessage.type === "image"
                            ? "📷 Hình ảnh"
                            : conv.lastMessage.type === "file"
                            ? `📎 ${conv.lastMessage.fileName || "File"}`
                            : conv.lastMessage.content
                          : "Chưa có tin nhắn"}
                      </div>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="conversation-unread">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Export component để render chat windows riêng
export function ChatWindows({ openChats, onCloseChat, socket }) {
  return (
    <div className="chat-windows-container">
      {openChats.map((chat) => (
        <div key={chat.userId} className="chat-window-wrapper">
          <ChatWindow
            userId={chat.userId}
            userName={chat.userName}
            userAvatar={chat.userAvatar}
            onClose={() => onCloseChat(chat.userId)}
            socket={socket}
          />
        </div>
      ))}
    </div>
  );
}

export default MessagesList;
