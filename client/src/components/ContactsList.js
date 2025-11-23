import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import "./ContactsList.css";

const API_BASE_URL = "http://localhost:3001/api";

function ContactsList({ onViewProfile, onOpenChat }) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadContacts();
    }
  }, [user]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/contacts`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setContacts(response.data.contacts || []);
    } catch (error) {
      console.error("Lỗi khi load contacts:", error);
    } finally {
      setLoading(false);
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
      <div className="contacts-list">
        <div className="contacts-loading">Đang tải...</div>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="contacts-list">
        <div className="contacts-empty">
          <p>Chưa có liên hệ nào</p>
        </div>
      </div>
    );
  }

  return (
    <div className="contacts-list">
      {contacts.map((contact) => (
        <div
          key={contact._id}
          className="contact-item"
          onClick={() => {
            if (onViewProfile) {
              onViewProfile(contact._id);
            }
          }}
        >
          <div className="contact-avatar">
            {contact.avatar ? (
              <img src={contact.avatar} alt={contact.name} />
            ) : (
              <span>{getInitials(contact.name)}</span>
            )}
          </div>
          <div className="contact-info">
            <div className="contact-name">{contact.name}</div>
            <div className="contact-status">
              {contact.isFriend ? "Bạn bè" : "Đã nhắn tin"}
            </div>
          </div>
          <button
            className="contact-chat-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenChat) {
                onOpenChat(contact._id, contact.name, contact.avatar);
              }
            }}
            title="Nhắn tin"
          >
            💬
          </button>
        </div>
      ))}
    </div>
  );
}

export default ContactsList;
