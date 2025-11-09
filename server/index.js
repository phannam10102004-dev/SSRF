const express = require("express");
const cors = require("cors");
const axios = require("axios");
const dns = require("dns").promises;
const { URL } = require("url");
const { parseMetadata } = require("./utils/metadataParser");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Danh sách IP nội bộ cần chặn
const PRIVATE_IP_RANGES = [
  /^127\./, // localhost
  /^10\./, // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
  /^192\.168\./, // 192.168.0.0/16
  /^169\.254\./, // Link-local
  /^::1$/, // IPv6 localhost
  /^fc00:/, // IPv6 private
  /^fe80:/, // IPv6 link-local
];

// Kiểm tra IP có phải private/internal không
function isPrivateIP(ipAddress) {
  return PRIVATE_IP_RANGES.some((range) => range.test(ipAddress));
}

// Kiểm tra URL có an toàn không
function isSafeURL(urlString) {
  try {
    const url = new URL(urlString);

    // Chặn các protocol nguy hiểm
    const dangerousProtocols = ["file:", "gopher:", "ldap:", "dict:"];
    if (dangerousProtocols.includes(url.protocol.toLowerCase())) {
      return { safe: false, reason: "Protocol không được phép" };
    }

    // Chỉ cho phép http và https
    if (!["http:", "https:"].includes(url.protocol.toLowerCase())) {
      return { safe: false, reason: "Chỉ cho phép HTTP/HTTPS" };
    }

    return { safe: true };
  } catch (error) {
    return { safe: false, reason: "URL không hợp lệ" };
  }
}

// Resolve DNS và kiểm tra IP
async function validateURL(urlString) {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname;

    // Resolve DNS
    const addresses = await dns
      .resolve4(hostname)
      .catch(() => dns.resolve6(hostname).catch(() => []));

    if (addresses.length === 0) {
      return { valid: false, reason: "Không thể resolve DNS" };
    }

    // Kiểm tra tất cả IP addresses
    for (const address of addresses) {
      if (isPrivateIP(address)) {
        return { valid: false, reason: `IP nội bộ bị chặn: ${address}` };
      }
    }

    return { valid: true, addresses };
  } catch (error) {
    return { valid: false, reason: error.message };
  }
}

// ========== VULNERABLE ENDPOINT - Link Preview ==========

// VULNERABLE: Link Preview Generator không kiểm tra URL
app.post("/api/vulnerable/preview", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL là bắt buộc" });
    }

    console.log("\n🚨 [VULNERABLE] Nhận request preview cho URL:", url);

    // ⚠️ VULNERABLE: Không kiểm tra URL, cho phép bất kỳ URL nào
    // Có thể bị tấn công SSRF để truy cập internal services
    const response = await axios.get(url, {
      timeout: 5000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      validateStatus: () => true,
    });

    // Parse metadata từ HTML
    const metadata = parseMetadata(response.data, url);

    console.log("✅ [VULNERABLE] Fetch thành công:", {
      status: response.status,
      contentType: response.headers["content-type"],
    });

    res.json({
      success: true,
      metadata: metadata,
      vulnerable: true,
      warning:
        "⚠️ Endpoint này dễ bị tấn công SSRF! Có thể truy cập internal services.",
      rawResponse: {
        status: response.status,
        headers: Object.keys(response.headers),
      },
    });
  } catch (error) {
    console.error("❌ [VULNERABLE] Lỗi khi fetch URL:", error.message);
    res.status(500).json({
      error: error.message,
      vulnerable: true,
    });
  }
});

// ========== SECURE ENDPOINT - Link Preview ==========

// SECURE: Link Preview Generator với validation đầy đủ
app.post("/api/secure/preview", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL là bắt buộc" });
    }

    console.log("\n🛡️ [SECURE] Nhận request preview cho URL:", url);

    // ✅ SECURE: Kiểm tra URL an toàn
    const urlCheck = isSafeURL(url);
    if (!urlCheck.safe) {
      console.warn(
        "⚠️ [SECURE] Bị chặn do protocol/định dạng:",
        urlCheck.reason
      );
      return res.status(400).json({
        error: urlCheck.reason,
        secure: true,
      });
    }

    // ✅ SECURE: Validate DNS và IP
    const validation = await validateURL(url);
    if (!validation.valid) {
      console.warn("⚠️ [SECURE] Bị chặn do DNS/IP:", validation.reason);
      return res.status(403).json({
        error: validation.reason,
        secure: true,
        message: "✅ Đã chặn request đến internal IP",
      });
    }

    // ✅ SECURE: Domain whitelist (optional - có thể bật/tắt)
    // Uncomment để enable whitelist
    /*
    const allowedDomains = [
      "github.com",
      "stackoverflow.com",
      "medium.com",
      "youtube.com",
      "twitter.com",
      "facebook.com",
      "linkedin.com",
    ];
    const urlObj = new URL(url);
    if (!allowedDomains.some((domain) => urlObj.hostname.endsWith(domain))) {
      return res.status(403).json({
        error: "Domain không được phép",
        secure: true,
        message: "✅ Chỉ cho phép các domain trong whitelist",
      });
    }
    */

    // Fetch và parse metadata
    const response = await axios.get(url, {
      timeout: 5000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      validateStatus: () => true,
    });

    const metadata = parseMetadata(response.data, url);

    console.log("✅ [SECURE] Fetch thành công:", {
      status: response.status,
      contentType: response.headers["content-type"],
      resolvedIPs: validation.addresses,
    });

    res.json({
      success: true,
      metadata: metadata,
      secure: true,
      message: "✅ Link preview đã được tạo an toàn",
      resolvedIPs: validation.addresses,
    });
  } catch (error) {
    console.error("❌ [SECURE] Lỗi khi fetch URL:", error.message);
    res.status(500).json({
      error: error.message,
      secure: true,
    });
  }
});

// Endpoint để test metadata (giả lập AWS metadata endpoint)
app.get("/api/metadata/:path(*)", (req, res) => {
  // Giả lập metadata endpoint (thường là 169.254.169.254 trên AWS)
  res.json({
    message: "⚠️ Đây là giả lập metadata endpoint",
    path: req.params.path,
    warning:
      "Nếu server có thể truy cập metadata endpoint, attacker có thể lấy thông tin nhạy cảm",
    example: "http://169.254.169.254/latest/meta-data/",
    // Giả lập metadata response
    instanceId: "i-1234567890abcdef0",
    region: "us-east-1",
    availabilityZone: "us-east-1a",
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server đang chạy" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📝 API endpoints:`);
  console.log(`   - POST /api/vulnerable/preview (⚠️ Vulnerable)`);
  console.log(`   - POST /api/secure/preview (✅ Secure)`);
  console.log(`   - GET  /api/metadata/:path (Test metadata endpoint)`);
});
