import React, { useState } from "react";
import axios from "axios";
import "./Preview.css";
import { getBackendUrl } from "../util";

const API_BASE_URL = getBackendUrl();

const VULNERABLE_EXAMPLES = [
  {
    name: "🏠 Localhost Attack",
    url: `${API_BASE_URL}/api/health`,
    description: "Tấn công đến localhost - có thể truy cập internal services",
    level: "Dễ",
  },
  {
    name: "🔐 Internal API (Users)",
    url: `${API_BASE_URL}/api/internal/users`,
    description: "Lấy danh sách users từ internal API - dữ liệu nhạy cảm!",
    level: "Thú vị",
  },
  {
    name: "⚙️ Internal Config",
    url: `${API_BASE_URL}/api/internal/config`,
    description: "Lấy config và secrets từ internal endpoint - rất nguy hiểm!",
    level: "Nguy hiểm",
  },
  {
    name: "☁️ Metadata Endpoint",
    url: "http://169.254.169.254/latest/meta-data/",
    description:
      "Tấn công AWS metadata endpoint (giả lập) - phổ biến trong thực tế",
    level: "Phổ biến",
  },
  {
    name: "🌐 Internal Network",
    url: "http://192.168.1.1",
    description:
      "Tấn công đến IP nội bộ trong mạng (router, internal services)",
    level: "Khám phá",
  },
  {
    name: "🔍 Port Scan Demo",
    url: `${API_BASE_URL}/api/internal/scan/3306`,
    description: "Demo quét port để tìm service (MySQL port 3306)",
    level: "Thú vị",
  },
  {
    name: "✅ Public Website",
    url: "https://github.com",
    description: "Test với website công khai (sẽ hoạt động bình thường)",
    level: "Test",
  },
];

function VulnerablePreview() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setPreview(null);
    setError(null);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/vulnerable/preview`,
        { url }
      );
      setPreview(response.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (exampleUrl) => {
    setUrl(exampleUrl);
  };

  return (
    <div className="preview-container">
      <div className="warning-banner">
        <h2>⚠️ Vulnerable Version - Dễ bị tấn công SSRF</h2>
        <p>
          Phiên bản này KHÔNG có validation, cho phép attacker truy cập internal
          services thông qua SSRF attack
        </p>
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
          <p className="examples-title">Ví dụ tấn công SSRF (click để thử):</p>
          <div className="example-buttons">
            {VULNERABLE_EXAMPLES.map((example, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleExampleClick(example.url)}
                className="example-btn"
                title={`${example.description} [${example.level}]`}
              >
                {example.name}
                <span className="example-level">({example.level})</span>
              </button>
            ))}
          </div>
          <p className="examples-hint">
            💡 <strong>Gợi ý:</strong> Bắt đầu với "Localhost Attack" để thấy
            kết quả rõ nhất, sau đó thử "Internal API" và "Internal Config" để
            thấy mức độ nguy hiểm!
          </p>
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
          <h3>❌ Lỗi:</h3>
          <p>{error}</p>
        </div>
      )}

      {preview && (
        <div className="preview-result">
          <div className="warning-box">
            <strong>⚠️ Cảnh báo:</strong> Endpoint này đã fetch thành công từ
            URL bạn cung cấp. Nếu đây là internal URL, bạn đã thực hiện SSRF
            attack thành công!
          </div>

          {preview.metadata && (
            <div className="preview-card vulnerable">
              {preview.metadata.image && (
                <div className="preview-image">
                  <img src={preview.metadata.image} alt="Preview" />
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
          )}

          {preview.rawResponse && (
            <div className="debug-info">
              <h4>Debug Info:</h4>
              <pre>{JSON.stringify(preview.rawResponse, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      <div className="explanation">
        <h3>🔍 Tại sao đây là lỗ hổng?</h3>
        <ul>
          <li>Không kiểm tra URL có phải internal IP không</li>
          <li>
            Không validate protocol (có thể dùng file://, gopher://, etc.)
          </li>
          <li>Không có whitelist domain</li>
          <li>Cho phép truy cập localhost và private network</li>
          <li>
            Có thể đọc metadata, internal services, hoặc file system thông qua
            SSRF
          </li>
        </ul>
      </div>
    </div>
  );
}

export default VulnerablePreview;
