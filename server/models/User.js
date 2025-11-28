const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "user", "moderator"],
      default: "user",
    },
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: "",
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    lastLoginAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    settings: {
      language: { type: String, default: "vi", enum: ["vi", "en"] },
      theme: {
        type: String,
        default: "light",
        enum: ["light", "dark", "system"],
      },
      privacy: {
        type: String,
        default: "public",
        enum: ["public", "friends", "only_me"],
      },
      notifications: {
        push: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
      },
    },
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String }, // For TOTP if needed later, or just placeholder
      otpCode: { type: String },
      otpExpires: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
