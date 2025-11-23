const { exec } = require("child_process");
const path = require("path");
require("dotenv").config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/ssrf-demo";
const EXPORT_DIR = path.join(__dirname, "export");

console.log("📦 Đang xuất dữ liệu MongoDB...");
console.log(
  "📍 Database:",
  MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")
);

const command = `mongodump --uri="${MONGODB_URI}" --out="${EXPORT_DIR}"`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error("❌ Lỗi khi export:", error.message);
    console.log("\n💡 Đảm bảo:");
    console.log("   1. Đã cài mongodump (MongoDB Database Tools)");
    console.log("   2. MongoDB đang chạy hoặc Atlas connection string đúng");
    console.log("   3. Có quyền truy cập database");
    return;
  }

  if (stderr) {
    console.warn("⚠️ Warning:", stderr);
  }

  console.log("✅ Export thành công!");
  console.log("📁 Thư mục export:", EXPORT_DIR);
  console.log("\n📦 Để nộp:");
  console.log("   - Nén thư mục 'export' thành file ZIP");
  console.log("   - Hoặc nộp trực tiếp thư mục 'export'");
});

