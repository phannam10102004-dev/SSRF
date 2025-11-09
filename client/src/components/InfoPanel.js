import React from "react";
import "./Preview.css";

function InfoPanel() {
  return (
    <div className="info-container">
      <h2>📚 SSRF (Server-Side Request Forgery) là gì?</h2>

      <section className="info-section">
        <h3>🔍 Định nghĩa</h3>
        <p>
          SSRF là một lỗ hổng bảo mật cho phép attacker buộc server thực hiện
          HTTP requests đến bất kỳ URL nào mà attacker chỉ định. Điều này có thể
          dẫn đến:
        </p>
        <ul>
          <li>Truy cập internal services và APIs</li>
          <li>Đọc metadata từ cloud providers (AWS, Azure, GCP)</li>
          <li>Quét mạng nội bộ (port scanning)</li>
          <li>Đọc file system thông qua file:// protocol</li>
          <li>Tấn công các service chỉ expose trong internal network</li>
        </ul>
      </section>

      <section className="info-section">
        <h3>⚡ Các kịch bản tấn công phổ biến</h3>

        <div className="attack-scenario">
          <h4>1. Tấn công Localhost</h4>
          <pre>{`URL: http://localhost:8080/admin
Kết quả: Có thể truy cập admin panel chỉ expose trong localhost`}</pre>
        </div>

        <div className="attack-scenario">
          <h4>2. Tấn công Metadata Endpoint</h4>
          <pre>{`URL: http://169.254.169.254/latest/meta-data/
Kết quả: Lấy credentials, instance metadata từ AWS EC2`}</pre>
        </div>

        <div className="attack-scenario">
          <h4>3. Tấn công Internal Network</h4>
          <pre>{`URL: http://192.168.1.100:8080/api/secret
Kết quả: Truy cập internal APIs không public`}</pre>
        </div>

        <div className="attack-scenario">
          <h4>4. File Protocol Attack</h4>
          <pre>{`URL: file:///etc/passwd
Kết quả: Đọc file system (nếu server hỗ trợ file://)`}</pre>
        </div>
      </section>

      <section className="info-section">
        <h3>🛡️ Cách phòng chống SSRF</h3>

        <div className="prevention-method">
          <h4>1. Validate và Sanitize URL</h4>
          <ul>
            <li>Chỉ cho phép HTTP và HTTPS protocols</li>
            <li>
              Chặn các protocol nguy hiểm: file://, gopher://, dict://, ldap://
            </li>
            <li>Validate URL format đúng chuẩn</li>
          </ul>
        </div>

        <div className="prevention-method">
          <h4>2. Kiểm tra IP Address</h4>
          <ul>
            <li>Resolve DNS và kiểm tra IP thực tế</li>
            <li>
              Chặn private IP ranges:
              <ul>
                <li>127.0.0.0/8 (localhost)</li>
                <li>10.0.0.0/8</li>
                <li>172.16.0.0/12</li>
                <li>192.168.0.0/16</li>
                <li>169.254.0.0/16 (link-local)</li>
              </ul>
            </li>
            <li>Chặn IPv6 localhost và private ranges</li>
          </ul>
        </div>

        <div className="prevention-method">
          <h4>3. Sử dụng Whitelist</h4>
          <ul>
            <li>Chỉ cho phép các domain/IP trong whitelist</li>
            <li>Không dùng blacklist (dễ bị bypass)</li>
            <li>Validate cả hostname và resolved IP</li>
          </ul>
        </div>

        <div className="prevention-method">
          <h4>4. Network Segmentation</h4>
          <ul>
            <li>Giới hạn network access của application server</li>
            <li>Sử dụng firewall rules</li>
            <li>Tách biệt public và internal services</li>
          </ul>
        </div>

        <div className="prevention-method">
          <h4>5. Giới hạn Response</h4>
          <ul>
            <li>Không trả về full response từ target URL</li>
            <li>Validate Content-Type</li>
            <li>Giới hạn response size</li>
            <li>Disable redirects hoặc giới hạn số lượng redirects</li>
          </ul>
        </div>
      </section>

      <section className="info-section">
        <h3>💡 Best Practices</h3>
        <ul>
          <li>Luôn validate input từ user</li>
          <li>Sử dụng URL parsing library thay vì regex</li>
          <li>Kiểm tra cả hostname và resolved IP</li>
          <li>Log tất cả SSRF attempts để phát hiện attacks</li>
          <li>Regular security audits và penetration testing</li>
          <li>Follow OWASP guidelines</li>
        </ul>
      </section>

      <section className="info-section">
        <h3>📖 Tài liệu tham khảo</h3>
        <ul>
          <li>
            <a
              href="https://owasp.org/www-community/attacks/Server_Side_Request_Forgery"
              target="_blank"
              rel="noopener noreferrer"
            >
              OWASP SSRF
            </a>
          </li>
          <li>
            <a
              href="https://portswigger.net/web-security/ssrf"
              target="_blank"
              rel="noopener noreferrer"
            >
              PortSwigger - SSRF
            </a>
          </li>
          <li>
            <a
              href="https://cwe.mitre.org/data/definitions/918.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              CWE-918: SSRF
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default InfoPanel;
