import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { useAuth } from "../contexts/AuthContext";
import "./ChatWindow.css";

const API_BASE_URL = "http://localhost:3001/api";

function ChatWindow({ userId, userName, userAvatar, onClose, socket }) {
  const { user: currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!userId || !socket) return;

    loadConversation();

    // Lắng nghe tin nhắn mới
    socket.on("receive_message", handleReceiveMessage);
    socket.on("message_sent", handleMessageSent);
    socket.on("user_typing", handleUserTyping);
    socket.on("messages_read", handleMessagesRead);
    socket.on("message_deleted", handleMessageDeleted);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("message_sent", handleMessageSent);
      socket.off("user_typing", handleUserTyping);
      socket.off("messages_read", handleMessagesRead);
      socket.off("message_deleted", handleMessageDeleted);
    };
  }, [userId, socket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversation = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      // Tìm hoặc tạo conversation
      const convResponse = await axios.post(
        `${API_BASE_URL}/conversations`,
        { userId },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const conversation = convResponse.data.conversation;
      setConversationId(conversation._id);

      // Lấy tin nhắn
      const messagesResponse = await axios.get(
        `${API_BASE_URL}/conversations/${conversation._id}/messages`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMessages(messagesResponse.data.messages || []);

      // Đánh dấu đã đọc
      await axios.put(
        `${API_BASE_URL}/conversations/${conversation._id}/read`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (error) {
      console.error("Lỗi khi load conversation:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveMessage = (data) => {
    console.log("📨 Nhận tin nhắn mới:", data);
    if (!data.message) return;

    // Lấy receiverId từ message
    const messageReceiverId =
      typeof data.message.receiver === "string"
        ? data.message.receiver
        : data.message.receiver?._id || data.message.receiver;

    // Lấy senderId từ message
    const messageSenderId =
      typeof data.message.sender === "string"
        ? data.message.sender
        : data.message.sender?._id || data.message.sender;

    // Kiểm tra xem message có phải cho chat này không
    // Message phải từ userId (người đang chat) và gửi đến currentUser
    // HOẶC message phải từ currentUser và gửi đến userId
    const isFromThisChat =
      (messageSenderId === userId && messageReceiverId === currentUser.id) ||
      (messageSenderId === currentUser.id && messageReceiverId === userId);

    // Hoặc nếu có conversationId, kiểm tra conversation
    const isSameConversation =
      conversationId &&
      data.conversation &&
      data.conversation._id === conversationId;

    if (isFromThisChat || isSameConversation) {
      console.log("✅ Thêm message vào chat:", data.message);
      setMessages((prev) => {
        // Kiểm tra xem message đã tồn tại chưa (tránh duplicate)
        const exists = prev.some((m) => m._id === data.message._id);
        if (exists) {
          console.log("⚠️ Message đã tồn tại, bỏ qua");
          return prev;
        }
        return [...prev, data.message];
      });
      scrollToBottom();
    } else {
      console.log("❌ Message không phải cho chat này", {
        messageSenderId,
        messageReceiverId,
        userId,
        currentUserId: currentUser.id,
        conversationId,
        isFromThisChat,
        isSameConversation,
      });
    }
  };

  const handleMessageSent = (data) => {
    console.log("✅ Tin nhắn đã gửi:", data);
    if (data.conversation && data.conversation._id === conversationId) {
      setMessages((prev) => {
        // Kiểm tra xem message đã tồn tại chưa (tránh duplicate)
        const exists = prev.some((m) => m._id === data.message._id);
        if (exists) return prev;
        return [...prev, data.message];
      });
      scrollToBottom();
    } else if (data.message && data.message.receiver) {
      // Nếu chưa có conversationId nhưng message có receiver đúng
      const receiverId =
        typeof data.message.receiver === "string"
          ? data.message.receiver
          : data.message.receiver._id;
      if (receiverId === userId) {
        setMessages((prev) => {
          const exists = prev.some((m) => m._id === data.message._id);
          if (exists) return prev;
          return [...prev, data.message];
        });
        scrollToBottom();
      }
    }
  };

  const handleUserTyping = (data) => {
    if (data.userId === userId) {
      setIsTyping(data.isTyping);
      setTypingUser(data.userName);
      if (data.isTyping) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          setTypingUser(null);
        }, 3000);
      }
    }
  };

  const handleMessagesRead = (data) => {
    // Có thể cập nhật UI nếu cần
  };

  const handleMessageDeleted = (data) => {
    if (data.conversationId === conversationId) {
      setMessages((prev) => prev.filter((msg) => msg._id !== data.messageId));
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending || !socket) {
      console.log("Cannot send:", {
        newMessage: newMessage.trim(),
        sending,
        socket: !!socket,
      });
      return;
    }

    try {
      setSending(true);
      const messageContent = newMessage.trim();
      setNewMessage("");

      console.log("Sending message:", {
        receiverId: userId,
        content: messageContent,
      });

      socket.emit("send_message", {
        receiverId: userId,
        content: messageContent,
        type: "text",
      });

      // Listen for error
      const errorHandler = (error) => {
        console.error("Socket error:", error);
        alert(error.message || "Không thể gửi tin nhắn");
        socket.off("error", errorHandler);
      };
      socket.once("error", errorHandler);
    } catch (error) {
      console.error("Lỗi khi gửi tin nhắn:", error);
      alert("Không thể gửi tin nhắn");
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    if (socket) {
      socket.emit("typing", {
        receiverId: userId,
        isTyping: true,
      });

      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("typing", {
          receiverId: userId,
          isTyping: false,
        });
      }, 1000);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !socket) return;

    try {
      setSending(true);
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await axios.post(
        `${API_BASE_URL}/messages/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const { fileUrl, fileName, fileType } = uploadResponse.data;

      socket.emit("send_message", {
        receiverId: userId,
        content: fileName,
        type: fileType,
        fileUrl: fileUrl,
        fileName: fileName,
      });
    } catch (error) {
      console.error("Lỗi khi upload file:", error);
      alert("Không thể gửi file");
    } finally {
      setSending(false);
      e.target.value = "";
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("Bạn có chắc muốn xóa tin nhắn này?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    } catch (error) {
      console.error("Lỗi khi xóa tin nhắn:", error);
      alert("Không thể xóa tin nhắn");
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
      <div className="chat-window">
        <div className="chat-header">
          <div className="chat-user-info">
            {userAvatar ? (
              <img src={userAvatar} alt={userName} />
            ) : (
              <span>{getInitials(userName)}</span>
            )}
            <span>{userName}</span>
          </div>
          <div className="chat-header-actions">
            <button
              className={
                isMinimized ? "chat-maximize-btn" : "chat-minimize-btn"
              }
              onClick={() => setIsMinimized(!isMinimized)}
              title={isMinimized ? "Mở rộng" : "Thu gọn"}
            >
              {isMinimized ? "□" : "−"}
            </button>
            <button className="chat-close-btn" onClick={onClose} title="Đóng">
              ×
            </button>
          </div>
        </div>
        {!isMinimized && <div className="chat-loading">Đang tải...</div>}
      </div>
    );
  }

  return (
    <div className={`chat-window ${isMinimized ? "minimized" : ""}`}>
      <div className="chat-header">
        <div className="chat-user-info">
          {userAvatar ? (
            <img src={userAvatar} alt={userName} />
          ) : (
            <span>{getInitials(userName)}</span>
          )}
          <span>{userName}</span>
          {isTyping && !isMinimized && (
            <span className="typing-indicator">đang gõ...</span>
          )}
        </div>
        <div className="chat-header-actions">
          <button
            className={isMinimized ? "chat-maximize-btn" : "chat-minimize-btn"}
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? "Mở rộng" : "Thu gọn"}
          >
            {isMinimized ? "□" : "−"}
          </button>
          <button className="chat-close-btn" onClick={onClose} title="Đóng">
            ×
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="chat-messages">
            {messages.map((message) => {
              const isOwn = message.sender._id === currentUser.id;
              const isDeleted =
                message.deleted && message.deletedBy?.includes(currentUser.id);

              if (isDeleted) {
                return (
                  <div key={message._id} className="message-item deleted">
                    <span className="deleted-text">Tin nhắn đã được xóa</span>
                  </div>
                );
              }

              return (
                <div
                  key={message._id}
                  className={`message-item ${isOwn ? "own" : "other"}`}
                >
                  {!isOwn && (
                    <div className="message-avatar">
                      {message.sender.avatar ? (
                        <img
                          src={message.sender.avatar}
                          alt={message.sender.name}
                        />
                      ) : (
                        <span>{getInitials(message.sender.name)}</span>
                      )}
                    </div>
                  )}
                  <div className="message-content">
                    {message.type === "image" ? (
                      <img
                        src={message.fileUrl}
                        alt={message.content}
                        className="message-image"
                      />
                    ) : message.type === "file" ? (
                      <a
                        href={message.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="message-file"
                      >
                        📎 {message.fileName || message.content}
                      </a>
                    ) : (
                      <div className="message-text">{message.content}</div>
                    )}
                    <div className="message-time">
                      {new Date(message.createdAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  {isOwn && (
                    <button
                      className="message-delete-btn"
                      onClick={() => handleDeleteMessage(message._id)}
                      title="Xóa tin nhắn"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input">
            <label className="file-upload-btn">
              📎
              <input
                type="file"
                accept="image/*,application/pdf,.doc,.docx"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </label>
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={handleTyping}
              onKeyPress={handleKeyPress}
              placeholder="Nhập tin nhắn..."
              rows={1}
              disabled={sending}
            />
            <button
              className="send-btn"
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sending}
            >
              ➤
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default ChatWindow;
