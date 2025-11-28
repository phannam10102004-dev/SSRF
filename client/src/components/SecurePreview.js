import React, { useState } from "react";
import axios from "axios";
import "./Preview.css";
import { getBackendUrl } from "../util";

const API_BASE_URL = getBackendUrl();

const SECURE_EXAMPLES = [
  {
    name: "GitHub",
    url: "https://github.com",
    description: "Website công khai được phép",
  },
  {
    name: "Stack Overflow",
    url: "https://stackoverflow.com",
    description: "Domain công khai",
  },
  {
    name: "Localhost (Bị chặn)",
    url: `${API_BASE_URL}/api/health`,
    description: "Sẽ bị chặn vì là internal IP",
  },
  {
    name: "IP riêng (Bị chặn)",
    url: "http://192.168.1.1",
    description: "Sẽ bị chặn vì là private IP range",
  },
];

function SecurePreview() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    console.log("🚀 Gọi API với URL:", url);
    setLoading(true);
    setPreview(null);
    setError(null);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/secure/preview`,
        { url }
      );
      console.log("✅ API Response:", response.data);
      setPreview(response.data);
    } catch (err) {
      console.error("❌ API Error:", err.response?.data || err.message);
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          "Có lỗi xảy ra"
      );
      // Nếu bị chặn, vẫn hiển thị thông tin
      if (err.response?.data) {
        setPreview(err.response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (exampleUrl) => {
    setUrl(exampleUrl);
  };

  return (
    <div className="preview-container">
      <div className="success-banner">
        <h2>✅ Secure Version - Đã được bảo vệ</h2>
        <p>Phiên bản này có validation đầy đủ để ngăn chặn SSRF attacks</p>
      </div>

      <form onSubmit={handleSubmit} className="preview-form">
        <div className="form-group">
          <label htmlFor="url">Nhập URL để tạo preview:</label>
          <div className="input-group">
            <input
              id="url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="url-input"
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="submit-btn"
            >
              {loading ? "Đang tải..." : "Tạo Preview"}
            </button>
          </div>
        </div>

        <div className="examples">
          <p className="examples-title">Ví dụ test:</p>
          <div className="example-buttons">
            {SECURE_EXAMPLES.map((example, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleExampleClick(example.url)}
                className="example-btn"
                title={example.description}
              >
                {example.name}
              </button>
            ))}
          </div>
        </div>
      </form>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Đang tải preview...</p>
        </div>
      )}

      {error && (
        <div className="error-box">
          <h3>🛡️ Bị chặn:</h3>
          <p>{error}</p>
          {preview?.message && (
            <div className="success-message">{preview.message}</div>
          )}
        </div>
      )}

      {preview && preview.metadata && (
        <div className="preview-result">
          <div className="success-box">
            <strong>✅ Thành công:</strong> Link preview đã được tạo an toàn với
            validation đầy đủ.
          </div>

          <div className="preview-card secure">
            {preview.metadata.image && (
              <div className="preview-image">
                <img src={preview.metadata.image} alt="Xem trước" />
              </div>
            )}
            <div className="preview-content">
              <div className="preview-site">{preview.metadata.siteName}</div>
              <h3 className="preview-title">
                {preview.metadata.title || preview.metadata.url}
              </h3>
              {preview.metadata.description && (
                <p className="preview-description">
                  {preview.metadata.description}
                </p>
              )}
              <div className="preview-url">{preview.metadata.url}</div>
            </div>
          </div>

          {preview.resolvedIPs && (
            <div className="debug-info">
              <h4>✅ Resolved IPs (đã validate):</h4>
              <pre>{JSON.stringify(preview.resolvedIPs, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      <div className="explanation">
        <h3>🛡️ Các biện pháp bảo vệ:</h3>
        <ul>
          <li>✅ Validate URL protocol (chỉ cho phép HTTP/HTTPS)</li>
          <li>
            ✅ Chặn các protocol nguy hiểm (file://, gopher://, dict://, etc.)
          </li>
          <li>✅ Resolve DNS và kiểm tra IP address</li>
          <li>
            ✅ Chặn private/internal IP ranges (127.x, 10.x, 192.168.x, etc.)
          </li>
          <li>✅ Có thể sử dụng domain whitelist (optional)</li>
          <li>✅ Giới hạn redirects và timeout</li>
        </ul>
      </div>
    </div>
  );
}

export default SecurePreview;
