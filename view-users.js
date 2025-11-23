// Script để xem tất cả users từ MongoDB
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./server/models/User");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/ssrf-demo";

async function viewUsers() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Đã kết nối MongoDB thành công\n");

    const users = await User.find({}).select("-password").lean();

    console.log(`📊 Tổng số users: ${users.length}\n`);
    console.log("=".repeat(80));

    if (users.length === 0) {
      console.log("⚠️  Chưa có user nào trong database");
    } else {
      users.forEach((user, index) => {
        console.log(`\n👤 User #${index + 1}:`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Tên: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role || "user"}`);
        console.log(`   Bio: ${user.bio || "(chưa có)"}`);
        console.log(`   Avatar: ${user.avatar || "(chưa có)"}`);
        console.log(
          `   Tạo lúc: ${new Date(user.createdAt).toLocaleString("vi-VN")}`
        );
        console.log(
          `   Đăng nhập lần cuối: ${
            user.lastLoginAt
              ? new Date(user.lastLoginAt).toLocaleString("vi-VN")
              : "Chưa đăng nhập"
          }`
        );
        console.log(
          `   Trạng thái: ${user.isActive ? "✅ Hoạt động" : "❌ Đã khóa"}`
        );
        console.log("-".repeat(80));
      });
    }

    console.log("\n✅ Hoàn thành!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi:", error.message);
    process.exit(1);
  }
}

viewUsers();
