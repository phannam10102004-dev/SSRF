require("dotenv").config();

// Polyfill File for Node 18 + undici compatibility
if (typeof global.File === "undefined") {
  try {
    const { Blob } = require("buffer");
    const BlobClass = global.Blob || Blob;
    if (BlobClass) {
      global.File = class File extends BlobClass {
        constructor(fileBits, fileName, options) {
          super(fileBits, options);
          this.name = fileName;
          this.lastModified = options?.lastModified || Date.now();
        }
      };
    }
  } catch (e) {
    console.error('Error applying File polyfill:', e);
  }
}

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const dns = require("dns").promises;
const { URL } = require("url");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  parseMetadata,
  extractYouTubeVideoId,
  createYouTubeMetadata,
} = require("./utils/metadataParser");
const User = require("./models/User");
const Post = require("./models/Post");
const FriendRequest = require("./models/FriendRequest");
const Notification = require("./models/Notification");
const Message = require("./models/Message");
const Conversation = require("./models/Conversation");
const { upload: uploadAvatar, cloudinary } = require("./utils/cloudinary");
const multer = require("multer");
const fs = require("fs");
const upload = multer({ dest: "uploads/" });
const http = require("http");
const socketIo = require("socket.io");
const passport = require("./config/passport");
const { sendOTP } = require("./utils/emailService");
const crypto = require("crypto");

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3002", "https://ssrf-client.onrender.com", CLIENT_URL],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  transports: ["websocket", "polling"],
});
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/ssrf-demo";
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const REACTION_TYPES = ["like", "love", "haha", "wow", "sad", "angry"];
const REACTION_LABELS = {
  like: "cảm xúc Thích",
  love: "cảm xúc Yêu thích",
  haha: "cảm xúc Haha",
  wow: "cảm xúc Wow",
  sad: "cảm xúc Buồn",
  angry: "cảm xúc Phẫn nộ",
};

// Kết nối MongoDB
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ Đã kết nối MongoDB thành công");
    initializeSampleData();
  })
  .catch((err) => {
    console.error("❌ Lỗi kết nối MongoDB:", err.message);
  });

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3002", "https://ssrf-client.onrender.com", CLIENT_URL],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
// Tăng giới hạn body size để xử lý payload lớn (50MB)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(passport.initialize());

// ========== AUTHENTICATION MIDDLEWARE ==========
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: "Token không tồn tại" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User không hợp lệ" });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Token không hợp lệ" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token đã hết hạn" });
    }
    return res.status(500).json({ error: "Lỗi xác thực" });
  }
};

// ========== AUTHENTICATION ENDPOINTS ==========

// Google Auth
app.get(
  "/api/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

app.get(
  "/api/auth/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login" }),
  (req, res) => {
    // Successful authentication
    const token = jwt.sign(
      { userId: req.user._id, email: req.user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Redirect to client with token
    // In production, use a more secure way to pass token (e.g. cookie or postMessage)
    // For this demo, passing via query param
    res.redirect(`${CLIENT_URL}/auth/google/callback?token=${token}`);
  }
);

// Đăng ký
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Vui lòng điền đầy đủ thông tin" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Mật khẩu phải có ít nhất 6 ký tự" });
    }

    // Kiểm tra email đã tồn tại
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: "Email đã được sử dụng" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo user mới
    const user = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "user",
    });

    await user.save();

    // Tạo JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
      },
    });
  } catch (error) {
    console.error("❌ Lỗi đăng ký:", error);

    // Xử lý lỗi MongoDB duplicate key
    if (error.code === 11000) {
      return res.status(400).json({ error: "Email đã được sử dụng" });
    }

    res.status(500).json({ error: "Lỗi khi đăng ký. Vui lòng thử lại." });
  }
});

// Đăng nhập
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Vui lòng nhập email và mật khẩu" });
    }

    // Tìm user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Email hoặc mật khẩu không đúng" });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: "Tài khoản đã bị khóa" });
    }

    // Kiểm tra password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Email hoặc mật khẩu không đúng" });
    }

    // Check 2FA
    if (user.twoFactor && user.twoFactor.enabled) {
      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      user.twoFactor.otpCode = otp;
      user.twoFactor.otpExpires = otpExpires;
      await user.save();

      // Send OTP
      await sendOTP(user.email, otp);

      // Return temp token (short lived, only for verifying OTP)
      const tempToken = jwt.sign(
        { userId: user._id, type: "2fa_pending" },
        JWT_SECRET,
        { expiresIn: "10m" }
      );

      return res.json({
        success: true,
        requireOtp: true,
        tempToken,
        message: "Vui lòng nhập mã OTP đã được gửi đến email của bạn",
      });
    }

    // Cập nhật lastLoginAt
    user.lastLoginAt = new Date();
    await user.save();

    // Tạo JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
        settings: user.settings,
      },
    });
  } catch (error) {
    console.error("❌ Lỗi đăng nhập:", error);
    res.status(500).json({ error: "Lỗi khi đăng nhập. Vui lòng thử lại." });
  }
});

// Verify OTP
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { otp, tempToken } = req.body;

    if (!otp || !tempToken) {
      return res.status(400).json({ error: "Thiếu thông tin xác thực" });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: "Token hết hạn hoặc không hợp lệ" });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: "User không tồn tại" });
    }

    if (
      !user.twoFactor.otpCode ||
      user.twoFactor.otpCode !== otp ||
      new Date() > user.twoFactor.otpExpires
    ) {
      return res.status(400).json({ error: "Mã OTP không đúng hoặc đã hết hạn" });
    }

    // Clear OTP
    user.twoFactor.otpCode = null;
    user.twoFactor.otpExpires = null;
    user.lastLoginAt = new Date();
    await user.save();

    // Generate real token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
        settings: user.settings,
      },
    });
  } catch (error) {
    console.error("❌ Lỗi verify OTP:", error);
    res.status(500).json({ error: "Lỗi xác thực OTP" });
  }
});

// ========== SETTINGS ENDPOINTS ==========

// Get settings
app.get("/api/users/settings", authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      settings: req.user.settings,
      twoFactorEnabled: req.user.twoFactor?.enabled || false,
    });
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy cài đặt" });
  }
});

// Update settings
app.put("/api/users/settings", authenticateToken, async (req, res) => {
  try {
    const { settings } = req.body;
    
    // Merge settings
    req.user.settings = { ...req.user.settings, ...settings };
    await req.user.save();

    res.json({
      success: true,
      settings: req.user.settings,
    });
  } catch (error) {
    res.status(500).json({ error: "Lỗi cập nhật cài đặt" });
  }
});

// Enable 2FA (Directly, without OTP verification as requested)
app.post("/api/auth/2fa/enable", authenticateToken, async (req, res) => {
  try {
    req.user.twoFactor = {
      ...req.user.twoFactor,
      enabled: true,
      otpCode: null,
      otpExpires: null,
    };
    await req.user.save();

    res.json({
      success: true,
      message: "Đã bật xác thực 2 lớp thành công",
    });
  } catch (error) {
    res.status(500).json({ error: "Lỗi bật 2FA" });
  }
});

// Confirm Enable 2FA - Deprecated/Unused but kept for reference or if we revert
app.post("/api/auth/2fa/confirm", authenticateToken, async (req, res) => {
  res.json({ success: true, message: "Endpoint deprecated" });
});

// Disable 2FA
app.post("/api/auth/2fa/disable", authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    console.log("Disable 2FA Request:", { userId: req.user._id, hasPassword: !!password });

    // Fetch user with password explicitly since req.user has it excluded
    const user = await User.findById(req.user._id);
    
    if (!user) {
      console.log("User not found for ID:", req.user._id);
      return res.status(404).json({ error: "User không tồn tại" });
    }

    // Verify password before disabling
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log("Password invalid for user:", user.email);
      return res.status(401).json({ error: "Mật khẩu không đúng" });
    }

    user.twoFactor.enabled = false;
    await user.save();

    res.json({
      success: true,
      message: "Đã tắt xác thực 2 lớp",
    });
  } catch (error) {
    res.status(500).json({ error: "Lỗi tắt 2FA" });
  }
});

// Verify token và lấy thông tin user
app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        avatar: req.user.avatar,
        bio: req.user.bio,
        settings: req.user.settings,
        twoFactor: {
          enabled: req.user.twoFactor?.enabled || false,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi lấy thông tin user" });
  }
});

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

    // Kiểm tra YouTube URL trước
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      try {
        // Fetch YouTube oEmbed API để lấy metadata chính xác
        const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
          url
        )}&format=json`;
        const oEmbedResponse = await axios.get(oEmbedUrl, {
          timeout: 5000,
        });

        const metadata = createYouTubeMetadata(videoId, url);
        if (oEmbedResponse.data) {
          metadata.title = oEmbedResponse.data.title || metadata.title;
          metadata.description =
            oEmbedResponse.data.author_name || metadata.description;
          if (oEmbedResponse.data.thumbnail_url) {
            metadata.image = oEmbedResponse.data.thumbnail_url;
          }
        }

        return res.json({
          success: true,
          metadata: metadata,
          vulnerable: true,
          warning:
            "⚠️ Endpoint này dễ bị tấn công SSRF! Có thể truy cập internal services.",
        });
      } catch (e) {
        // Nếu oEmbed fail, dùng default metadata
        const metadata = createYouTubeMetadata(videoId, url);
        return res.json({
          success: true,
          metadata: metadata,
          vulnerable: true,
          warning:
            "⚠️ Endpoint này dễ bị tấn công SSRF! Có thể truy cập internal services.",
        });
      }
    }

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

    // Kiểm tra nếu response là JSON (có thể là internal API)
    let metadata = null;
    let jsonData = null;

    const contentType = response.headers["content-type"] || "";

    // Thử parse JSON nếu content-type là json hoặc data là object/string
    if (
      contentType.includes("application/json") ||
      typeof response.data === "object" ||
      typeof response.data === "string"
    ) {
      try {
        // Parse JSON nếu là string, hoặc dùng trực tiếp nếu là object
        if (typeof response.data === "string") {
          jsonData = JSON.parse(response.data);
        } else if (typeof response.data === "object") {
          jsonData = response.data;
        }

        // Tạo metadata từ JSON response
        metadata = {
          url: url,
          title: jsonData.message || jsonData.title || "Internal API Response",
          description:
            jsonData.warning ||
            jsonData.description ||
            (jsonData.users
              ? `⚠️ Đây là internal API - không nên expose ra ngoài! Tổng số users: ${
                  jsonData.total || jsonData.users?.length || 0
                }`
              : JSON.stringify(jsonData).substring(0, 200)),
          image: null,
          siteName: new URL(url).hostname,
          type: "api",
        };
      } catch (e) {
        // Nếu không parse được JSON, dùng HTML parser
        metadata = parseMetadata(response.data, url);
      }
    } else {
      // Response là HTML - parse metadata
      metadata = parseMetadata(response.data, url);
    }

    res.json({
      success: true,
      metadata: metadata,
      vulnerable: true,
      warning:
        "⚠️ Endpoint này dễ bị tấn công SSRF! Có thể truy cập internal services.",
      rawResponse: {
        status: response.status,
        headers: Object.keys(response.headers),
        data: jsonData || response.data,
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

    // ✅ SECURE: Kiểm tra URL an toàn
    const urlCheck = isSafeURL(url);
    if (!urlCheck.safe) {
      return res.status(400).json({
        error: urlCheck.reason,
        secure: true,
      });
    }

    // ✅ SECURE: Validate DNS và IP
    const validation = await validateURL(url);
    if (!validation.valid) {
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

    // Kiểm tra YouTube URL trước
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      try {
        // Fetch YouTube oEmbed API để lấy metadata chính xác
        const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
          url
        )}&format=json`;
        const oEmbedResponse = await axios.get(oEmbedUrl, {
          timeout: 5000,
        });

        const metadata = createYouTubeMetadata(videoId, url);
        if (oEmbedResponse.data) {
          metadata.title = oEmbedResponse.data.title || metadata.title;
          metadata.description =
            oEmbedResponse.data.author_name || metadata.description;
          if (oEmbedResponse.data.thumbnail_url) {
            metadata.image = oEmbedResponse.data.thumbnail_url;
          }
        }

        return res.json({
          success: true,
          metadata: metadata,
          secure: true,
          message: "✅ Link preview đã được tạo an toàn",
          resolvedIPs: validation.addresses,
        });
      } catch (e) {
        // Nếu oEmbed fail, dùng default metadata
        const metadata = createYouTubeMetadata(videoId, url);
        return res.json({
          success: true,
          metadata: metadata,
          secure: true,
          message: "✅ Link preview đã được tạo an toàn",
          resolvedIPs: validation.addresses,
        });
      }
    }

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

// ========== INTERNAL API - Dễ bị SSRF ==========

// ⚠️ VULNERABLE: Internal API endpoint - Lấy users từ MongoDB
// Endpoint này chỉ nên truy cập từ localhost, nhưng có thể bị SSRF!
app.get("/api/internal/users", async (req, res) => {
  try {
    // Kiểm tra MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: "⚠️ Đây là internal API - không nên expose ra ngoài!",
        error: "MongoDB chưa kết nối",
        total: 0,
        users: [],
        warning:
          "MongoDB connection chưa sẵn sàng. Kiểm tra connection string và đảm bảo MongoDB đang chạy.",
      });
    }

    const users = await User.find({}).select("-password").lean();

    res.setHeader("Content-Type", "application/json");

    res.json({
      message: "⚠️ Đây là internal API - không nên expose ra ngoài!",
      total: users.length,
      users: users,
      warning:
        "Nếu attacker có thể truy cập endpoint này qua SSRF, họ đã lấy được dữ liệu nhạy cảm từ MongoDB!",
    });
  } catch (error) {
    console.error("❌ [INTERNAL API] Lỗi:", error.message);
    res.status(500).json({
      message: "⚠️ Đây là internal API - không nên expose ra ngoài!",
      error: "Lỗi khi lấy dữ liệu users",
      message_detail: error.message,
      total: 0,
      users: [],
    });
  }
});

// ⚠️ VULNERABLE: Internal API - Lấy user theo ID
app.get("/api/internal/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password").lean();

    if (!user) {
      return res.status(404).json({ error: "User không tồn tại" });
    }

    res.json({
      message: "⚠️ Internal API - User details",
      user: user,
      warning: "Dữ liệu nhạy cảm có thể bị lộ qua SSRF!",
    });
  } catch (error) {
    res.status(500).json({
      error: "Lỗi khi lấy user",
      message: error.message,
    });
  }
});

// Demo: Internal config endpoint
app.get("/api/internal/config", (req, res) => {
  res.json({
    message: "⚠️ Internal config endpoint",
    database: {
      host: "internal-db.example.com",
      port: 5432,
      name: "production_db",
    },
    secrets: {
      apiKey: "sk_live_1234567890abcdef",
      jwtSecret: "super-secret-key-123",
    },
    warning: "Trong thực tế, đây có thể là credentials thật!",
  });
});

// ========== POSTS API ==========

// Lưu post vào MongoDB (yêu cầu authentication)
app.post(
  "/api/posts",
  authenticateToken,
  upload.array("images", 10),
  async (req, res) => {
    try {
      const { content, url, linkPreview, isVulnerable } = req.body;
      const files = req.files || [];

      if (!content && !url && files.length === 0) {
        return res
          .status(400)
          .json({ error: "Nội dung, URL hoặc ảnh là bắt buộc" });
      }

      // Upload images lên Cloudinary
      const imageUrls = [];
      if (files.length > 0) {
        for (const file of files) {
          try {
            const result = await cloudinary.uploader.upload(file.path, {
              folder: "posts",
              resource_type: "image",
            });
            imageUrls.push(result.secure_url);
            // Xóa file tạm
            fs.unlinkSync(file.path);
          } catch (uploadError) {
            console.error("Lỗi khi upload ảnh:", uploadError);
            // Xóa file tạm dù upload lỗi
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          }
        }
      }

      // Parse linkPreview nếu là string
      let cleanedLinkPreview = null;
      if (linkPreview) {
        try {
          const parsed =
            typeof linkPreview === "string"
              ? JSON.parse(linkPreview)
              : linkPreview;

          cleanedLinkPreview = { ...parsed };
          // Loại bỏ rawResponse.data nếu có
          if (
            cleanedLinkPreview.rawResponse &&
            cleanedLinkPreview.rawResponse.data
          ) {
            cleanedLinkPreview.rawResponse = {
              status: cleanedLinkPreview.rawResponse.status,
              headers: cleanedLinkPreview.rawResponse.headers,
            };
          }
        } catch (e) {
          cleanedLinkPreview = linkPreview;
        }
      }

      const post = new Post({
        content: content || "",
        url: url || "",
        linkPreview: cleanedLinkPreview,
        images: imageUrls,
        isVulnerable: isVulnerable === "true" || isVulnerable === true,
        author: req.user._id,
        authorName: req.user.name,
      });

      const savedPost = await post.save();

      // Populate author để trả về thông tin đầy đủ
      await savedPost.populate("author", "name email avatar");

      res.json({
        success: true,
        post: savedPost,
      });
    } catch (error) {
      // Xóa các file tạm nếu có lỗi
      if (req.files) {
        req.files.forEach((file) => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      res.status(500).json({
        error: "Lỗi khi lưu post",
        message: error.message,
      });
    }
  }
);

// Lấy tất cả posts (yêu cầu authentication)
app.get("/api/posts", authenticateToken, async (req, res) => {
  try {
    const { isVulnerable, authorId } = req.query;
    const query = {};

    if (isVulnerable !== undefined) {
      query.isVulnerable = isVulnerable === "true";
    }

    if (authorId) {
      query.author = authorId;
    }

    const posts = await Post.find(query)
      .populate("author", "name email avatar")
      .populate("commentDetails.user", "name avatar")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      posts: posts,
      total: posts.length,
    });
  } catch (error) {
    res.status(500).json({
      error: "Lỗi khi lấy posts",
      message: error.message,
    });
  }
});

// Xóa post
app.delete("/api/posts/:postId", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ error: "Post không tồn tại" });
    }

    const authorId = post.author?.toString();
    const requesterId = req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (authorId !== requesterId && !isAdmin) {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền xóa bài viết này" });
    }

    await Post.findByIdAndDelete(postId);
    res.json({ success: true, message: "Đã xóa bài viết" });
  } catch (error) {
    console.error("❌ Lỗi khi xóa post:", error);
    res.status(500).json({
      error: "Không thể xóa bài viết",
      message: error.message,
    });
  }
});

// Update post
app.put(
  "/api/posts/:id",
  authenticateToken,
  upload.array("images", 10),
  async (req, res) => {
    try {
      const post = await Post.findById(req.params.id);
      if (!post) {
        return res.status(404).json({ error: "Bài viết không tồn tại" });
      }

      // Check ownership
      const authorId = post.author?._id || post.author;
      const requesterId = req.user?._id || req.user?.id;
      
      const authorIdString = authorId?.toString();
      const requesterIdString = requesterId?.toString();

      console.log("Debug Edit Post:", {
        postId: post._id,
        authorIdString,
        requesterIdString,
        match: authorIdString === requesterIdString
      });

      if (authorIdString !== requesterIdString) {
        return res.status(403).json({ 
          error: "Không có quyền sửa bài viết này",
          debug: {
            authorId: authorIdString,
            requesterId: requesterIdString
          }
        });
      }

      const { content, linkPreview } = req.body;
      
      // Update content
      if (content !== undefined) {
        post.content = content.trim();
      }

      // Update linkPreview if provided
      if (linkPreview) {
        try {
          const parsed =
            typeof linkPreview === "string"
              ? JSON.parse(linkPreview)
              : linkPreview;
          
          // Clean sensitive data if needed (similar to create post)
          let cleanedLinkPreview = { ...parsed };
          if (
            cleanedLinkPreview.rawResponse &&
            cleanedLinkPreview.rawResponse.data
          ) {
            cleanedLinkPreview.rawResponse = {
              status: cleanedLinkPreview.rawResponse.status,
              headers: cleanedLinkPreview.rawResponse.headers,
            };
          }
          post.linkPreview = cleanedLinkPreview;
        } catch (e) {
          console.error("Error parsing linkPreview update:", e);
        }
      } else if (content && !content.match(/(https?:\/\/[^\s]+)/g)) {
         // If content has no link and no linkPreview sent, maybe clear it?
         // But CreatePostModal sends linkPreview if it exists.
         // If user removed link, CreatePostModal sends linkPreview as null or doesn't send it?
         // CreatePostModal logic: formData.append if linkPreview exists.
         // If user removed preview, linkPreview is null, so not appended.
         // So if not in body, we might want to clear it IF the user intended to remove it.
         // But FormData doesn't send missing fields.
         // Let's assume if content changed and no link, we might want to clear.
         // For now, let's just update if sent.
      }

      // Note: We are NOT updating images for now as per plan, 
      // but we use upload.array to parse the body.
      
      await post.save();

      // Populate author info
      await post.populate("author", "name avatar");

      res.json({ success: true, post });
    } catch (error) {
      console.error("Lỗi khi sửa bài viết:", error);
      res.status(500).json({ error: "Lỗi server" });
    }
  }
);

// Chia sẻ post (tăng share count)
app.post("/api/posts/:postId/share", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const originalPost = await Post.findById(postId).populate(
      "author",
      "name email avatar"
    );

    if (!originalPost) {
      return res.status(404).json({ error: "Post không tồn tại" });
    }

    const sharedPost = new Post({
      content: originalPost.content,
      url: originalPost.url,
      linkPreview: originalPost.linkPreview,
      images: originalPost.images,
      isVulnerable: originalPost.isVulnerable,
      author: req.user._id,
      authorName: req.user.name,
      sharedFrom: originalPost._id,
      sharedFromAuthorName:
        originalPost.author?.name || originalPost.authorName || "Người dùng",
    });

    await sharedPost.save();
    await sharedPost.populate("author", "name email avatar");

    originalPost.shares = (originalPost.shares || 0) + 1;
    await originalPost.save();

    res.json({
      success: true,
      shares: originalPost.shares,
      originalPostId: originalPost._id,
      sharedPost,
      message: "Đã chia sẻ bài viết",
    });
  } catch (error) {
    console.error("❌ Lỗi khi chia sẻ post:", error);
    res.status(500).json({
      error: "Không thể chia sẻ bài viết",
      message: error.message,
    });
  }
});

// Thêm/Gỡ/Đổi reaction cho post
app.post(
  "/api/posts/:postId/reactions",
  authenticateToken,
  async (req, res) => {
    try {
      const { postId } = req.params;
      const { type } = req.body;

      if (!type || !REACTION_TYPES.includes(type)) {
        return res.status(400).json({
          error: "Loại reaction không hợp lệ",
          allowed: REACTION_TYPES,
        });
      }

      const post = await Post.findById(postId).populate(
        "author",
        "name email avatar"
      );
      if (!post) {
        return res.status(404).json({ error: "Post không tồn tại" });
      }

      const currentUserId = req.user._id.toString();
      const existingIndex = post.reactions.findIndex(
        (reaction) => reaction.user.toString() === currentUserId
      );

      const isNewReaction = existingIndex === -1;

      if (isNewReaction) {
        post.reactions.push({ user: req.user._id, type });
      } else if (post.reactions[existingIndex].type === type) {
        post.reactions.splice(existingIndex, 1);
      } else {
        post.reactions[existingIndex].type = type;
        post.reactions[existingIndex].createdAt = new Date();
      }

      await post.save();

      if (
        isNewReaction &&
        post.author &&
        post.author._id &&
        post.author._id.toString() !== currentUserId
      ) {
        const alreadyNotified = await Notification.exists({
          user: post.author._id,
          from: req.user._id,
          type: "post_reaction",
          relatedId: post._id,
        });

        if (!alreadyNotified) {
          await Notification.create({
            user: post.author._id,
            from: req.user._id,
            type: "post_reaction",
            relatedId: post._id,
            message: `${req.user.name} đã thả ${
              REACTION_LABELS[type] || "cảm xúc"
            } vào bài viết của bạn`,
          });
        }
      }

      res.json({
        success: true,
        post,
      });
    } catch (error) {
      console.error("❌ Lỗi khi cập nhật reaction:", error);
      res.status(500).json({
        error: "Không thể cập nhật reaction",
        message: error.message,
      });
    }
  }
);

// Xóa reaction của user khỏi post
app.delete(
  "/api/posts/:postId/reactions",
  authenticateToken,
  async (req, res) => {
    try {
      const { postId } = req.params;
      const post = await Post.findById(postId).populate(
        "author",
        "name email avatar"
      );

      if (!post) {
        return res.status(404).json({ error: "Post không tồn tại" });
      }

      const currentUserId = req.user._id.toString();
      const nextReactions = post.reactions.filter(
        (reaction) => reaction.user.toString() !== currentUserId
      );

      if (nextReactions.length === post.reactions.length) {
        return res.status(200).json({
          success: true,
          message: "User chưa reaction post này",
          post,
        });
      }

      post.reactions = nextReactions;
      await post.save();

      res.json({
        success: true,
        post,
      });
    } catch (error) {
      console.error("❌ Lỗi khi xóa reaction:", error);
      res.status(500).json({
        error: "Không thể xóa reaction",
        message: error.message,
      });
    }
  }
);

// Lấy danh sách comments của post
app.get("/api/posts/:postId/comments", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId)
      .populate("commentDetails.user", "name avatar")
      .lean();

    if (!post) {
      return res.status(404).json({ error: "Post không tồn tại" });
    }

    res.json({
      success: true,
      comments: post.commentDetails || [],
      total: post.commentDetails?.length || 0,
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy comments:", error);
    res.status(500).json({
      error: "Không thể lấy comments",
      message: error.message,
    });
  }
});

// Thêm comment vào post
app.post("/api/posts/:postId/comments", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Nội dung bình luận không hợp lệ" });
    }

    if (content.length > 500) {
      return res.status(400).json({ error: "Bình luận tối đa 500 ký tự" });
    }

    const post = await Post.findById(postId).populate(
      "author",
      "name email avatar"
    );
    if (!post) {
      return res.status(404).json({ error: "Post không tồn tại" });
    }

    const newComment = {
      user: req.user._id,
      content: content.trim(),
      createdAt: new Date(),
    };

    post.commentDetails.push(newComment);
    post.comments = (post.comments || 0) + 1;

    await post.save();
    await post.populate("commentDetails.user", "name avatar");

    const createdComment = post.commentDetails[post.commentDetails.length - 1];
    const formattedComment = createdComment?.toObject
      ? createdComment.toObject()
      : createdComment;

    if (
      post.author &&
      post.author._id &&
      post.author._id.toString() !== req.user._id.toString()
    ) {
      await Notification.create({
        user: post.author._id,
        from: req.user._id,
        type: "post_comment",
        relatedId: post._id,
        message: `${req.user.name} đã bình luận: "${content
          .trim()
          .slice(0, 80)}"`,
      });
    }

    res.json({
      success: true,
      comment: formattedComment,
      total: post.comments,
    });
  } catch (error) {
    console.error("❌ Lỗi khi thêm comment:", error);
    res.status(500).json({
      error: "Không thể thêm bình luận",
      message: error.message,
    });
  }
});

// ========== USERS API (Public) ==========

// Tạo user mới (demo)
app.post("/api/users", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
    }

    const user = new User({
      name,
      email,
      password, // Trong thực tế nên hash password
      role: role || "user",
    });

    const savedUser = await user.save();
    res.json({
      success: true,
      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "Email đã tồn tại" });
    }
    res.status(500).json({
      error: "Lỗi khi tạo user",
      message: error.message,
    });
  }
});

// Lấy danh sách users (public - không có password)
app.get("/api/users", async (req, res) => {
  try {
    const { search } = req.query;
    const query = {};

    if (search && search.trim()) {
      query.name = { $regex: search.trim(), $options: "i" };
    }

    const users = await User.find(query)
      .select("name email role avatar bio createdAt")
      .limit(search ? 10 : 20)
      .lean();

    res.json({
      success: true,
      users: users,
      total: users.length,
    });
  } catch (error) {
    res.status(500).json({
      error: "Lỗi khi lấy users",
      message: error.message,
    });
  }
});

// ========== FRIENDS API ==========

// Lấy danh sách users đề xuất (không phải bạn, không có request pending, không phải chính mình)
app.get("/api/users/suggestions", authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const friendIds = currentUser.friends || [];
    friendIds.push(req.user._id); // Loại bỏ chính mình

    // Lấy danh sách user đã gửi request
    const sentRequests = await FriendRequest.find({
      from: req.user._id,
      status: "pending",
    }).select("to");
    const requestedUserIds = sentRequests.map((r) => r.to);

    // Lấy danh sách user đã gửi request cho mình
    const receivedRequests = await FriendRequest.find({
      to: req.user._id,
      status: "pending",
    }).select("from");
    const receivedUserIds = receivedRequests.map((r) => r.from);

    // Loại bỏ tất cả: bạn bè, chính mình, đã gửi request, đã nhận request
    const excludeIds = [...friendIds, ...requestedUserIds, ...receivedUserIds];

    const suggestedUsers = await User.find({
      _id: { $nin: excludeIds },
      isActive: true,
    })
      .select("name email role avatar bio friends")
      .limit(20)
      .lean();

    // Tính số bạn chung cho mỗi user
    const usersWithMutualFriends = suggestedUsers.map((user) => {
      const userFriends = (user.friends || []).map((id) => id.toString());
      const currentUserFriendIds = friendIds.map((id) => id.toString());
      const mutualFriends = userFriends.filter((friendId) =>
        currentUserFriendIds.includes(friendId)
      );
      return {
        ...user,
        mutualFriendsCount: mutualFriends.length,
      };
    });

    // Sắp xếp theo số bạn chung (nhiều nhất trước)
    usersWithMutualFriends.sort(
      (a, b) => b.mutualFriendsCount - a.mutualFriendsCount
    );

    res.json({
      success: true,
      users: usersWithMutualFriends,
      total: usersWithMutualFriends.length,
    });
  } catch (error) {
    res.status(500).json({
      error: "Lỗi khi lấy đề xuất",
      message: error.message,
    });
  }
});

// Lấy danh sách bạn bè
app.get("/api/users/friends", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("friends", "name email avatar bio")
      .lean();

    res.json({
      success: true,
      friends: user.friends || [],
      total: (user.friends || []).length,
    });
  } catch (error) {
    res.status(500).json({
      error: "Lỗi khi lấy danh sách bạn bè",
      message: error.message,
    });
  }
});

// ========== FRIEND REQUESTS API ==========

// Gửi yêu cầu kết bạn
app.post("/api/users/friend-requests", authenticateToken, async (req, res) => {
  try {
    const { toUserId } = req.body;

    if (!toUserId) {
      return res.status(400).json({ error: "Thiếu toUserId" });
    }

    if (toUserId === req.user._id.toString()) {
      return res
        .status(400)
        .json({ error: "Không thể gửi yêu cầu cho chính mình" });
    }

    const toUser = await User.findById(toUserId);
    if (!toUser) {
      return res.status(404).json({ error: "User không tồn tại" });
    }

    // Kiểm tra đã là bạn chưa
    const currentUser = await User.findById(req.user._id);
    if (currentUser.friends.includes(toUserId)) {
      return res.status(400).json({ error: "Đã là bạn bè rồi" });
    }

    // Kiểm tra đã có request pending chưa
    const existingPendingRequest = await FriendRequest.findOne({
      $or: [
        { from: req.user._id, to: toUserId, status: "pending" },
        { from: toUserId, to: req.user._id, status: "pending" },
      ],
    });

    if (existingPendingRequest) {
      return res.status(400).json({ error: "Đã có yêu cầu kết bạn" });
    }

    // Nếu có request rejected, xóa nó đi để có thể gửi lại
    const existingRejectedRequest = await FriendRequest.findOne({
      $or: [
        { from: req.user._id, to: toUserId, status: "rejected" },
        { from: toUserId, to: req.user._id, status: "rejected" },
      ],
    });

    if (existingRejectedRequest) {
      await FriendRequest.deleteOne({ _id: existingRejectedRequest._id });
    }

    // Tạo friend request mới
    const friendRequest = new FriendRequest({
      from: req.user._id,
      to: toUserId,
      status: "pending",
    });
    await friendRequest.save();

    // Tạo notification cho người nhận
    const notification = new Notification({
      user: toUserId,
      type: "friend_request",
      from: req.user._id,
      relatedId: friendRequest._id,
      message: `${currentUser.name} đã gửi yêu cầu kết bạn`,
    });
    await notification.save();

    res.json({
      success: true,
      message: "Đã gửi yêu cầu kết bạn",
      request: friendRequest,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "Đã có yêu cầu kết bạn" });
    }
    res.status(500).json({
      error: "Lỗi khi gửi yêu cầu",
      message: error.message,
    });
  }
});

// Lấy danh sách yêu cầu kết bạn (đã gửi và đã nhận)
app.get("/api/users/friend-requests", authenticateToken, async (req, res) => {
  try {
    const { type } = req.query; // 'sent' or 'received'

    let requests;
    if (type === "sent") {
      requests = await FriendRequest.find({
        from: req.user._id,
        status: "pending",
      })
        .populate("to", "name email avatar bio")
        .sort({ createdAt: -1 })
        .lean();
    } else if (type === "received") {
      requests = await FriendRequest.find({
        to: req.user._id,
        status: "pending",
      })
        .populate("from", "name email avatar bio")
        .sort({ createdAt: -1 })
        .lean();
    } else {
      // Lấy cả hai
      const sent = await FriendRequest.find({
        from: req.user._id,
        status: "pending",
      })
        .populate("to", "name email avatar bio")
        .lean();
      const received = await FriendRequest.find({
        to: req.user._id,
        status: "pending",
      })
        .populate("from", "name email avatar bio")
        .lean();
      requests = { sent, received };
    }

    res.json({
      success: true,
      requests: requests,
    });
  } catch (error) {
    res.status(500).json({
      error: "Lỗi khi lấy yêu cầu kết bạn",
      message: error.message,
    });
  }
});

// Chấp nhận yêu cầu kết bạn
app.post(
  "/api/users/friend-requests/:requestId/accept",
  authenticateToken,
  async (req, res) => {
    try {
      const { requestId } = req.params;

      const friendRequest = await FriendRequest.findById(requestId);
      if (!friendRequest) {
        return res.status(404).json({ error: "Yêu cầu không tồn tại" });
      }

      if (friendRequest.to.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: "Không có quyền chấp nhận" });
      }

      if (friendRequest.status !== "pending") {
        return res.status(400).json({ error: "Yêu cầu đã được xử lý" });
      }

      // Lưu requestId trước khi xóa (để dùng cho notification)
      const savedRequestId = friendRequest._id;

      // Thêm bạn bè cho cả hai
      const fromUser = await User.findById(friendRequest.from);
      const toUser = await User.findById(friendRequest.to);

      if (!fromUser.friends.includes(friendRequest.to)) {
        fromUser.friends.push(friendRequest.to);
      }
      if (!toUser.friends.includes(friendRequest.from)) {
        toUser.friends.push(friendRequest.from);
      }

      await fromUser.save();
      await toUser.save();

      // Xóa request sau khi đã thêm bạn bè thành công
      await FriendRequest.deleteOne({ _id: friendRequest._id });

      // Tạo notification cho người gửi
      const notification = new Notification({
        user: friendRequest.from,
        type: "friend_accepted",
        from: req.user._id,
        relatedId: savedRequestId,
        message: `${toUser.name} đã chấp nhận yêu cầu kết bạn`,
      });
      await notification.save();

      // Đánh dấu notification cũ là đã đọc
      await Notification.updateMany(
        {
          user: req.user._id,
          type: "friend_request",
          relatedId: savedRequestId,
        },
        { read: true }
      );

      res.json({
        success: true,
        message: "Đã chấp nhận yêu cầu kết bạn",
      });
    } catch (error) {
      res.status(500).json({
        error: "Lỗi khi chấp nhận yêu cầu",
        message: error.message,
      });
    }
  }
);

// Từ chối/Hủy yêu cầu kết bạn
app.delete(
  "/api/users/friend-requests/:requestId",
  authenticateToken,
  async (req, res) => {
    try {
      const { requestId } = req.params;

      const friendRequest = await FriendRequest.findById(requestId);
      if (!friendRequest) {
        return res.status(404).json({ error: "Yêu cầu không tồn tại" });
      }

      // Chỉ người gửi hoặc người nhận mới có thể xóa
      const isSender =
        friendRequest.from.toString() === req.user._id.toString();
      const isReceiver =
        friendRequest.to.toString() === req.user._id.toString();

      if (!isSender && !isReceiver) {
        return res.status(403).json({ error: "Không có quyền xóa" });
      }

      // Xóa request thực sự (không chỉ set status)
      await FriendRequest.deleteOne({ _id: requestId });

      res.json({
        success: true,
        message: "Đã hủy yêu cầu kết bạn",
      });
    } catch (error) {
      res.status(500).json({
        error: "Lỗi khi hủy yêu cầu",
        message: error.message,
      });
    }
  }
);

// Xóa bạn
app.delete(
  "/api/users/friends/:friendId",
  authenticateToken,
  async (req, res) => {
    try {
      const { friendId } = req.params;

      const user = await User.findById(req.user._id);
      const friend = await User.findById(friendId);

      if (!friend) {
        return res.status(404).json({ error: "User không tồn tại" });
      }

      // Xóa bạn khỏi danh sách (cả hai phía)
      user.friends = user.friends.filter((id) => id.toString() !== friendId);
      friend.friends = friend.friends.filter(
        (id) => id.toString() !== req.user._id.toString()
      );

      await user.save();
      await friend.save();

      res.json({
        success: true,
        message: "Đã xóa bạn thành công",
      });
    } catch (error) {
      res.status(500).json({
        error: "Lỗi khi xóa bạn",
        message: error.message,
      });
    }
  }
);

// ========== MESSAGES API ==========

// Lấy danh sách contacts (bạn bè + người đã nhắn tin)
app.get("/api/contacts", authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);

    // Lấy danh sách bạn bè
    const friends = await User.find({
      _id: { $in: currentUser.friends || [] },
    }).select("name avatar email");

    // Lấy danh sách conversations để tìm người đã nhắn tin
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate("participants", "name avatar email")
      .sort({ lastMessageAt: -1 });

    // Lấy tất cả người đã nhắn tin (không phải bạn bè)
    const conversationUserIds = new Set();
    conversations.forEach((conv) => {
      conv.participants.forEach((participant) => {
        if (participant._id.toString() !== req.user._id.toString()) {
          conversationUserIds.add(participant._id.toString());
        }
      });
    });

    // Lấy danh sách người đã nhắn tin nhưng chưa là bạn bè
    const friendIds = new Set(
      (currentUser.friends || []).map((id) => id.toString())
    );
    const nonFriendIds = Array.from(conversationUserIds).filter(
      (id) => !friendIds.has(id)
    );

    const nonFriends = await User.find({
      _id: { $in: nonFriendIds },
    }).select("name avatar email");

    // Kết hợp và loại bỏ duplicate
    const allContacts = [];
    const seenIds = new Set();

    // Thêm bạn bè trước
    friends.forEach((friend) => {
      const id = friend._id.toString();
      if (!seenIds.has(id)) {
        seenIds.add(id);
        allContacts.push({
          ...friend.toObject(),
          isFriend: true,
        });
      }
    });

    // Thêm người đã nhắn tin (không phải bạn bè)
    nonFriends.forEach((user) => {
      const id = user._id.toString();
      if (!seenIds.has(id)) {
        seenIds.add(id);
        allContacts.push({
          ...user.toObject(),
          isFriend: false,
        });
      }
    });

    res.json({
      success: true,
      contacts: allContacts,
      total: allContacts.length,
    });
  } catch (error) {
    res.status(500).json({
      error: "Lỗi khi lấy danh sách contacts",
      message: error.message,
    });
  }
});

// Lấy danh sách conversations
app.get("/api/conversations", authenticateToken, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate("participants", "name avatar")
      .populate("lastMessage")
      .sort({ lastMessageAt: -1 });

    // Loại bỏ duplicate conversations (nếu có)
    // Group by participants (sau khi sort) và chỉ lấy conversation mới nhất
    const uniqueConversations = [];
    const seenParticipants = new Map();

    for (const conv of conversations) {
      // Sort participants để tạo key unique
      const sortedParticipants = conv.participants
        .map((p) => p._id.toString())
        .sort()
        .join(",");

      if (!seenParticipants.has(sortedParticipants)) {
        seenParticipants.set(sortedParticipants, conv);
        uniqueConversations.push(conv);
      } else {
        // Nếu đã có, so sánh lastMessageAt và giữ conversation mới hơn
        const existing = seenParticipants.get(sortedParticipants);
        if (
          conv.lastMessageAt &&
          (!existing.lastMessageAt ||
            conv.lastMessageAt > existing.lastMessageAt)
        ) {
          const index = uniqueConversations.indexOf(existing);
          uniqueConversations[index] = conv;
          seenParticipants.set(sortedParticipants, conv);
        }
      }
    }

    const finalConversations = uniqueConversations;

    // Tính unread count cho mỗi conversation
    const conversationsWithUnread = await Promise.all(
      finalConversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          receiver: req.user._id,
          read: false,
          deleted: false,
        });

        return {
          ...conv.toObject(),
          unreadCount,
        };
      })
    );

    res.json({
      success: true,
      conversations: conversationsWithUnread,
    });
  } catch (error) {
    res.status(500).json({
      error: "Lỗi khi lấy danh sách conversations",
      message: error.message,
    });
  }
});

// Lấy hoặc tạo conversation với một user
app.post("/api/conversations", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Thiếu userId" });
    }

    if (userId === req.user._id.toString()) {
      return res
        .status(400)
        .json({ error: "Không thể tạo conversation với chính mình" });
    }

    // Convert sang ObjectId và sắp xếp để unique index hoạt động
    const currentUserId = new mongoose.Types.ObjectId(req.user._id);
    const otherUserId = new mongoose.Types.ObjectId(userId);
    const participants = [currentUserId, otherUserId].sort((a, b) =>
      a.toString().localeCompare(b.toString())
    );

    // Tìm conversation đã có - match exact array (sau khi đã sort)
    let conversation = await Conversation.findOne({
      participants: { $eq: participants },
    })
      .populate("participants", "name avatar")
      .populate("lastMessage");

    // Nếu không tìm thấy với exact match, thử tìm với $all (có thể có duplicate cũ)
    if (!conversation) {
      const existingConvs = await Conversation.find({
        participants: { $all: participants, $size: 2 },
      })
        .populate("participants", "name avatar")
        .populate("lastMessage")
        .sort({ lastMessageAt: -1 });

      if (existingConvs.length > 0) {
        // Lấy conversation mới nhất (có lastMessageAt mới nhất)
        conversation = existingConvs[0];

        // Nếu có nhiều hơn 1, merge messages vào conversation đầu tiên và xóa các conversation còn lại
        if (existingConvs.length > 1) {
          const mainConv = existingConvs[0];
          const duplicateIds = existingConvs.slice(1).map((c) => c._id);

          // Cập nhật tất cả messages của duplicate conversations sang main conversation
          await Message.updateMany(
            { conversationId: { $in: duplicateIds } },
            { conversationId: mainConv._id }
          );

          // Xóa duplicate conversations
          await Conversation.deleteMany({ _id: { $in: duplicateIds } });

          console.log(
            `✅ Đã merge ${existingConvs.length - 1} duplicate conversations`
          );
        }
      }
    }

    // Nếu chưa có thì tạo mới
    if (!conversation) {
      conversation = new Conversation({
        participants: participants,
      });
      await conversation.save();
      await conversation.populate("participants", "name avatar");
    }

    res.json({
      success: true,
      conversation: conversation,
    });
  } catch (error) {
    res.status(500).json({
      error: "Lỗi khi tạo conversation",
      message: error.message,
    });
  }
});

// Lấy tin nhắn của một conversation
app.get(
  "/api/conversations/:conversationId/messages",
  authenticateToken,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      // Kiểm tra user có trong conversation không
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation không tồn tại" });
      }

      if (!conversation.participants.includes(req.user._id)) {
        return res.status(403).json({ error: "Không có quyền truy cập" });
      }

      // Lấy tin nhắn
      const messages = await Message.find({
        conversationId: conversationId,
        deleted: false,
        $or: [
          { deletedBy: { $ne: req.user._id } },
          { deletedBy: { $exists: false } },
        ],
      })
        .populate("sender", "name avatar")
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

      res.json({
        success: true,
        messages: messages.reverse(), // Đảo ngược để hiển thị từ cũ đến mới
      });
    } catch (error) {
      res.status(500).json({
        error: "Lỗi khi lấy tin nhắn",
        message: error.message,
      });
    }
  }
);

// Xóa tin nhắn
app.delete("/api/messages/:messageId", authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Tin nhắn không tồn tại" });
    }

    // Chỉ sender hoặc receiver mới được xóa
    if (
      message.sender.toString() !== req.user._id.toString() &&
      message.receiver.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: "Không có quyền xóa tin nhắn" });
    }

    // Nếu chưa có ai xóa, đánh dấu deleted
    if (!message.deleted) {
      message.deleted = true;
      message.deletedBy = [req.user._id];
      await message.save();
    } else {
      // Nếu đã có người xóa, thêm vào deletedBy
      if (!message.deletedBy.includes(req.user._id)) {
        message.deletedBy.push(req.user._id);
        await message.save();
      }
    }

    // Thông báo cho người kia
    const conversation = await Conversation.findById(message.conversationId);
    if (conversation) {
      const otherUserId = conversation.participants.find(
        (id) => id.toString() !== req.user._id.toString()
      );
      if (otherUserId) {
        io.to(otherUserId.toString()).emit("message_deleted", {
          messageId: messageId,
          conversationId: message.conversationId,
        });
      }
    }

    res.json({
      success: true,
      message: "Đã xóa tin nhắn",
    });
  } catch (error) {
    res.status(500).json({
      error: "Lỗi khi xóa tin nhắn",
      message: error.message,
    });
  }
});

// Upload file/ảnh cho tin nhắn
app.post(
  "/api/messages/upload",
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Không có file" });
      }

      const maxSize = 10 * 1024 * 1024; // 10MB
      if (req.file.size > maxSize) {
        return res.status(400).json({ error: "File quá lớn (tối đa 10MB)" });
      }

      // Upload lên Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "ssrf-demo/messages",
        resource_type: "auto",
      });

      // Xóa file tạm
      const fs = require("fs");
      fs.unlinkSync(req.file.path);

      // Fix encoding for filename
      const originalName = Buffer.from(req.file.originalname, "latin1").toString(
        "utf8"
      );

      res.json({
        success: true,
        fileUrl: result.secure_url,
        fileName: originalName,
        fileSize: req.file.size,
        fileType: req.file.mimetype.startsWith("image/") ? "image" : "file",
      });
    } catch (error) {
      console.error("Lỗi khi upload file:", error);
      res.status(500).json({
        error: "Lỗi khi upload file",
        message: error.message,
      });
    }
  }
);

// Đánh dấu đã đọc
app.put(
  "/api/conversations/:conversationId/read",
  authenticateToken,
  async (req, res) => {
    try {
      const { conversationId } = req.params;

      await Message.updateMany(
        {
          conversationId: conversationId,
          receiver: req.user._id,
          read: false,
        },
        { read: true }
      );

      // Thông báo cho sender
      const conversation = await Conversation.findById(conversationId);
      if (conversation) {
        const otherUserId = conversation.participants.find(
          (id) => id.toString() !== req.user._id.toString()
        );
        if (otherUserId) {
          io.to(otherUserId.toString()).emit("messages_read", {
            conversationId: conversationId,
            userId: req.user._id.toString(),
          });
        }
      }

      res.json({
        success: true,
        message: "Đã đánh dấu đã đọc",
      });
    } catch (error) {
      res.status(500).json({
        error: "Lỗi khi đánh dấu đã đọc",
        message: error.message,
      });
    }
  }
);

// ========== NOTIFICATIONS API ==========

// Lấy danh sách notifications
app.get("/api/notifications", authenticateToken, async (req, res) => {
  try {
    const { unreadOnly } = req.query;

    const query = { user: req.user._id };
    if (unreadOnly === "true") {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .populate("from", "name email avatar")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });

    res.json({
      success: true,
      notifications: notifications,
      unreadCount: unreadCount,
    });
  } catch (error) {
    res.status(500).json({
      error: "Lỗi khi lấy notifications",
      message: error.message,
    });
  }
});

// Đánh dấu notification là đã đọc
app.put("/api/notifications/:id/read", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ error: "Notification không tồn tại" });
    }

    if (notification.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Không có quyền" });
    }

    notification.read = true;
    await notification.save();

    res.json({
      success: true,
      message: "Đã đánh dấu đã đọc",
    });
  } catch (error) {
    res.status(500).json({
      error: "Lỗi khi cập nhật notification",
      message: error.message,
    });
  }
});

// Đánh dấu tất cả notifications là đã đọc
app.put("/api/notifications/read-all", authenticateToken, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { read: true }
    );

    res.json({
      success: true,
      message: "Đã đánh dấu tất cả là đã đọc",
    });
  } catch (error) {
    res.status(500).json({
      error: "Lỗi khi cập nhật notifications",
      message: error.message,
    });
  }
});

// ========== PROFILE API ==========

// Lấy thông tin profile user
app.get("/api/users/:userId", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    // Reload currentUser để đảm bảo có dữ liệu mới nhất
    const currentUser = await User.findById(req.user._id);

    const user = await User.findById(userId).select("-password").lean();

    if (!user) {
      return res.status(404).json({ error: "User không tồn tại" });
    }

    // Kiểm tra có phải bạn bè không (so sánh với dữ liệu mới nhất)
    const isFriend = currentUser.friends.some(
      (id) => id.toString() === userId.toString()
    );

    // Kiểm tra có request pending không (chỉ cần biết có hay không)
    const hasPendingRequest = await FriendRequest.exists({
      $or: [
        { from: req.user._id, to: userId, status: "pending" },
        { from: userId, to: req.user._id, status: "pending" },
      ],
    });

    // Nếu có request, lấy thông tin để xác định sent/received
    let friendRequestStatus = null;
    let friendRequestId = null;

    if (hasPendingRequest) {
      const friendRequest = await FriendRequest.findOne({
        $or: [
          { from: req.user._id, to: userId, status: "pending" },
          { from: userId, to: req.user._id, status: "pending" },
        ],
      });

      if (friendRequest) {
        friendRequestId = friendRequest._id.toString();
        // Xác định ai là người gửi
        friendRequestStatus =
          friendRequest.from.toString() === req.user._id.toString()
            ? "sent"
            : "received";
      }
    }

    // Lấy số lượng posts
    const postCount = await Post.countDocuments({ author: userId });

    res.json({
      success: true,
      user: {
        ...user,
        isFriend,
        friendRequestStatus,
        friendRequestId,
        postCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Lỗi khi lấy thông tin user",
      message: error.message,
    });
  }
});

// Cập nhật profile
app.put("/api/users/profile", authenticateToken, async (req, res) => {
  try {
    const { name, bio } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;

    await user.save();

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Lỗi khi cập nhật profile",
      message: error.message,
    });
  }
});

// Đổi mật khẩu
app.post("/api/users/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Vui lòng nhập đủ mật khẩu hiện tại và mật khẩu mới" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Mật khẩu mới phải có ít nhất 6 ký tự" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: "User không tồn tại" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Mật khẩu hiện tại không đúng" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: "Đã đổi mật khẩu thành công",
    });
  } catch (error) {
    console.error("❌ Lỗi khi đổi mật khẩu:", error);
    res.status(500).json({
      error: "Không thể đổi mật khẩu",
      message: error.message,
    });
  }
});

// Upload avatar
app.post(
  "/api/users/avatar",
  authenticateToken,
  uploadAvatar.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Không có file được upload" });
      }

      const user = await User.findById(req.user._id);
      // req.file.path từ CloudinaryStorage đã là Cloudinary URL
      user.avatar = req.file.path;
      await user.save();

      res.json({
        success: true,
        avatar: user.avatar,
        message: "Đã cập nhật avatar thành công",
      });
    } catch (error) {
      res.status(500).json({
        error: "Lỗi khi upload avatar",
        message: error.message,
      });
    }
  }
);

// Demo: Port scanning endpoint (giả lập)
app.get("/api/internal/scan/:port", (req, res) => {
  const port = parseInt(req.params.port);
  res.json({
    message: `⚠️ Port scanning demo - Port ${port}`,
    port: port,
    status:
      port === 22
        ? "SSH service detected"
        : port === 3306
        ? "MySQL detected"
        : port === 27017
        ? "MongoDB detected"
        : "Unknown",
    warning: "Attacker có thể quét port để tìm service đang chạy",
  });
});

// ========== INITIALIZE SAMPLE DATA ==========

async function initializeSampleData() {
  try {
    const userCount = await User.countDocuments();

    if (userCount === 0) {
      const sampleUsers = [
        {
          name: "Admin User",
          email: "admin@ssrf-demo.com",
          password: "admin123",
          role: "admin",
          bio: "System Administrator",
        },
        {
          name: "John Doe",
          email: "john@ssrf-demo.com",
          password: "user123",
          role: "user",
          bio: "Regular user",
        },
        {
          name: "Jane Smith",
          email: "jane@ssrf-demo.com",
          password: "user123",
          role: "moderator",
          bio: "Content Moderator",
        },
        {
          name: "Bob Johnson",
          email: "bob@ssrf-demo.com",
          password: "user123",
          role: "user",
          bio: "Developer",
        },
      ];

      await User.insertMany(sampleUsers);
      console.log("✅ Đã tạo", sampleUsers.length, "sample users");
    }
  } catch (error) {
    console.error("❌ Lỗi khi tạo sample data:", error.message);
  }
}

// Endpoint để tạo lại sample users (nếu cần)
app.post("/api/admin/create-sample-users", async (req, res) => {
  try {
    // Xóa tất cả users cũ
    await User.deleteMany({});

    const sampleUsers = [
      {
        name: "Admin User",
        email: "admin@ssrf-demo.com",
        password: "admin123",
        role: "admin",
        bio: "System Administrator",
      },
      {
        name: "John Doe",
        email: "john@ssrf-demo.com",
        password: "user123",
        role: "user",
        bio: "Regular user",
      },
      {
        name: "Jane Smith",
        email: "jane@ssrf-demo.com",
        password: "user123",
        role: "moderator",
        bio: "Content Moderator",
      },
      {
        name: "Bob Johnson",
        email: "bob@ssrf-demo.com",
        password: "user123",
        role: "user",
        bio: "Developer",
      },
    ];

    const createdUsers = await User.insertMany(sampleUsers);

    res.json({
      success: true,
      message: `Đã tạo ${createdUsers.length} sample users`,
      users: createdUsers.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
      })),
    });
  } catch (error) {
    console.error("❌ Lỗi khi tạo sample users:", error.message);
    res.status(500).json({
      error: "Lỗi khi tạo sample users",
      message: error.message,
    });
  }
});

// ========== SOCKET.IO SETUP ==========
const socketAuth = async (socket, next) => {
  try {
    // Thử lấy token từ nhiều nơi
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "") ||
      socket.handshake.query?.token;

    if (!token) {
      console.error("Socket auth: Không có token", {
        auth: socket.handshake.auth,
        headers: socket.handshake.headers,
        query: socket.handshake.query,
      });
      return next(new Error("Không có token"));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      console.error("Socket auth: User không tồn tại", decoded.userId);
      return next(new Error("User không tồn tại"));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (error) {
    console.error("Socket auth error:", error.message);
    next(new Error(`Token không hợp lệ: ${error.message}`));
  }
};

io.use(socketAuth);

io.on("connection", (socket) => {
  console.log(`✅ User ${socket.user.name} đã kết nối: ${socket.id}`);

  // Join room với userId để nhận tin nhắn
  socket.join(socket.userId);

  // Xử lý gửi tin nhắn
  socket.on("send_message", async (data) => {
    try {
      const { receiverId, content, type, fileUrl, fileName } = data;

      if (!receiverId) {
        return socket.emit("error", { message: "Thiếu receiverId" });
      }

      // Convert sang ObjectId
      const senderId = new mongoose.Types.ObjectId(socket.userId);
      const receiverObjId = new mongoose.Types.ObjectId(receiverId);

      // Tìm hoặc tạo conversation (sắp xếp participants để unique index hoạt động)
      const participants = [senderId, receiverObjId].sort((a, b) =>
        a.toString().localeCompare(b.toString())
      );

      // Tìm conversation với exact match
      let conversation = await Conversation.findOne({
        participants: { $eq: participants },
      });

      // Nếu không tìm thấy, thử tìm với $all (có thể có duplicate cũ)
      if (!conversation) {
        const existingConvs = await Conversation.find({
          participants: { $all: participants, $size: 2 },
        }).sort({ lastMessageAt: -1 });

        if (existingConvs.length > 0) {
          conversation = existingConvs[0];

          // Nếu có nhiều hơn 1, merge và xóa duplicate
          if (existingConvs.length > 1) {
            const mainConv = existingConvs[0];
            const duplicateIds = existingConvs.slice(1).map((c) => c._id);

            await Message.updateMany(
              { conversationId: { $in: duplicateIds } },
              { conversationId: mainConv._id }
            );

            await Conversation.deleteMany({ _id: { $in: duplicateIds } });
          }
        }
      }

      if (!conversation) {
        conversation = new Conversation({
          participants: participants,
        });
        await conversation.save();
      }

      // Tạo message
      const message = new Message({
        conversationId: conversation._id,
        sender: senderId,
        receiver: receiverObjId,
        content: content || "",
        type: type || "text",
        fileUrl: fileUrl || "",
        fileName: fileName || "",
        fileSize: fileSize || 0,
        read: false,
      });
      await message.save();

      // Populate sender và receiver để gửi đầy đủ thông tin
      await message.populate("sender", "name avatar");
      await message.populate("receiver", "name avatar");

      // Cập nhật conversation
      conversation.lastMessage = message._id;
      conversation.lastMessageAt = new Date();
      await conversation.save();

      // Gửi tin nhắn đến receiver
      const receiverIdStr = receiverObjId.toString();
      console.log(`📤 Gửi message đến receiver: ${receiverIdStr}`);
      console.log(`📤 Message content:`, {
        id: message._id,
        content: message.content,
        sender: senderId.toString(),
        receiver: receiverIdStr,
      });

      // Emit đến room của receiver
      io.to(receiverIdStr).emit("receive_message", {
        message: message.toObject ? message.toObject() : message,
        conversation: conversation.toObject
          ? conversation.toObject()
          : conversation,
      });

      // Log số sockets của receiver để debug
      const receiverSockets = await io.in(receiverIdStr).fetchSockets();
      console.log(`📤 Số sockets của receiver: ${receiverSockets.length}`);

      // Gửi lại cho sender để confirm
      socket.emit("message_sent", {
        message: message.toObject ? message.toObject() : message,
        conversation: conversation.toObject
          ? conversation.toObject()
          : conversation,
      });
    } catch (error) {
      console.error("Lỗi khi gửi tin nhắn:", error);
      socket.emit("error", { message: "Không thể gửi tin nhắn" });
    }
  });

  // Xử lý đánh dấu đã đọc
  socket.on("mark_read", async (data) => {
    try {
      const { conversationId } = data;
      await Message.updateMany(
        {
          conversationId: conversationId,
          receiver: socket.userId,
          read: false,
        },
        { read: true }
      );

      // Thông báo cho sender
      const conversation = await Conversation.findById(conversationId);
      if (conversation) {
        const otherUserId = conversation.participants.find(
          (id) => id.toString() !== socket.userId
        );
        if (otherUserId) {
          io.to(otherUserId.toString()).emit("messages_read", {
            conversationId: conversationId,
            userId: socket.userId,
          });
        }
      }
    } catch (error) {
      console.error("Lỗi khi đánh dấu đã đọc:", error);
    }
  });

  // Xử lý typing indicator
  socket.on("typing", (data) => {
    const { receiverId, isTyping } = data;
    socket.to(receiverId).emit("user_typing", {
      userId: socket.userId,
      userName: socket.user.name,
      isTyping: isTyping,
    });
  });

  socket.on("disconnect", () => {
    console.log(`❌ User ${socket.user.name} đã ngắt kết nối: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
