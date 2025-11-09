# 🔗 Link Preview Generator - SSRF Demo

Ứng dụng web **Link Preview Generator** (giống Facebook/LinkedIn) để demo tấn công SSRF (Server-Side Request Forgery) và cách phòng chống, được xây dựng với **React** và **Node.js**.

## 📋 Mục đích

Ứng dụng này là một **Link Preview Generator** thực tế - tính năng phổ biến trong các ứng dụng social media. Demo này giúp hiểu rõ:

- SSRF là gì và cách hoạt động trong ứng dụng thực tế
- Các kịch bản tấn công SSRF phổ biến (localhost, metadata endpoints, internal network)
- Cách phòng chống và bảo vệ ứng dụng khỏi SSRF attacks
- So sánh giữa code vulnerable và secure trong cùng một tính năng
- Ứng dụng thực tế có thể bị tấn công SSRF như thế nào

## 🚀 Cài đặt và Chạy

### Yêu cầu

- **Node.js >= 14.0.0** (khuyến nghị: Node.js 16.x hoặc 18.x LTS)
- **npm >= 6.0.0** hoặc yarn

**Kiểm tra phiên bản Node.js:**

```bash
node --version
npm --version
```

**Khuyến nghị:** Sử dụng Node.js 18.x LTS để có hiệu suất và bảo mật tốt nhất.

### Bước 1: Cài đặt dependencies

```bash
# Cài đặt tất cả dependencies (root, server, client)
npm run install-all
```

Hoặc cài đặt từng phần:

```bash
# Root
npm install

# Server
cd server
npm install

# Client
cd ../client
npm install
```

### Bước 2: Chạy ứng dụng

**Cách 1: Chạy cả server và client cùng lúc**

```bash
npm run dev
```

**Cách 2: Chạy riêng biệt**

Terminal 1 - Server:

```bash
npm run server
# hoặc
cd server
npm start
```

Terminal 2 - Client:

```bash
npm run client
# hoặc
cd client
npm start
```

### Bước 3: Truy cập ứng dụng

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## 📁 Cấu trúc Project

```
SSRF/
├── server/                      # Backend Node.js/Express
│   ├── index.js                # Server chính với vulnerable & secure endpoints
│   ├── utils/
│   │   └── metadataParser.js   # Parse Open Graph metadata từ HTML
│   └── package.json
├── client/                      # Frontend React
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── VulnerablePreview.js  # Vulnerable link preview
│   │   │   ├── SecurePreview.js      # Secure link preview
│   │   │   ├── InfoPanel.js          # Thông tin về SSRF
│   │   │   └── Preview.css           # Styles cho preview cards
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── package.json
└── README.md
```

## 🎯 Tính năng

### 1. Vulnerable Version (⚠️ Dễ bị tấn công SSRF)

**POST `/api/vulnerable/preview`**

- Fetch URL và parse metadata **KHÔNG kiểm tra**
- Cho phép bất kỳ URL nào (localhost, internal IPs, metadata endpoints)
- Có thể bị tấn công SSRF để:
  - Truy cập internal services
  - Đọc metadata từ cloud providers (AWS, Azure, GCP)
  - Quét mạng nội bộ
  - Đọc file system

### 2. Secure Version (✅ Đã được bảo vệ)

**POST `/api/secure/preview`**

- Validate URL protocol (chỉ HTTP/HTTPS)
- Chặn các protocol nguy hiểm (file://, gopher://, etc.)
- Resolve DNS và kiểm tra IP address
- Chặn private/internal IP ranges (127.x, 10.x, 192.168.x, etc.)
- Có thể sử dụng domain whitelist (optional)
- Giới hạn redirects và timeout

## 🔍 Các kịch bản tấn công demo

### 1. Tấn công Localhost

```
URL: http://localhost:3001/api/health
```

**Vulnerable version:** Có thể truy cập các service chỉ expose trong localhost.
**Secure version:** Bị chặn vì là internal IP.

### 2. Tấn công Metadata Endpoint (AWS EC2)

```
URL: http://169.254.169.254/latest/meta-data/
```

**Vulnerable version:** Có thể lấy metadata, credentials từ cloud providers.
**Secure version:** Bị chặn vì là link-local IP (169.254.x.x).

### 3. Tấn công Internal Network

```
URL: http://192.168.1.1
```

**Vulnerable version:** Có thể truy cập router, internal services.
**Secure version:** Bị chặn vì là private IP range.

### 4. Tấn công Public Website (Test)

```
URL: https://github.com
```

**Cả 2 version:** Hoạt động bình thường, tạo preview card đẹp với metadata.

## 🛡️ Các biện pháp phòng chống đã implement

1. **URL Validation**

   - Chỉ cho phép HTTP/HTTPS
   - Chặn file://, gopher://, dict://, ldap://

2. **IP Address Checking**

   - Resolve DNS và kiểm tra IP thực tế
   - Chặn private IP ranges:
     - 127.0.0.0/8 (localhost)
     - 10.0.0.0/8
     - 172.16.0.0/12
     - 192.168.0.0/16
     - 169.254.0.0/16 (link-local)
     - IPv6 localhost và private ranges

3. **Domain Whitelist**

   - Chỉ cho phép các domain trong whitelist
   - Không dùng blacklist (dễ bị bypass)

4. **Response Validation**

   - Kiểm tra Content-Type
   - Giới hạn response size
   - Giới hạn redirects

5. **Network Segmentation**
   - Giới hạn network access
   - Sử dụng firewall rules

## 📚 Tài liệu tham khảo

- [OWASP - SSRF](https://owasp.org/www-community/attacks/Server_Side_Request_Forgery)
- [PortSwigger - SSRF](https://portswigger.net/web-security/ssrf)
- [CWE-918: SSRF](https://cwe.mitre.org/data/definitions/918.html)

## ⚠️ Lưu ý

- **Đây là ứng dụng demo cho mục đích giáo dục**
- Không sử dụng trong production environment
- Chỉ chạy trong môi trường local/development
- Không expose ra internet

## 🐛 Troubleshooting

### Port đã được sử dụng

Nếu port 3000 hoặc 3001 đã được sử dụng:

- Thay đổi port trong `client/package.json` (React)
- Thay đổi PORT trong `server/index.js`

### Lỗi CORS

Nếu gặp lỗi CORS, kiểm tra:

- Server đã chạy chưa
- Proxy trong `client/package.json` đúng chưa
- CORS middleware trong server đã enable chưa

## 📝 License

MIT

## 👨‍💻 Tác giả

Demo application cho mục đích giáo dục về SSRF security.
