const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index để query nhanh hơn
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

// Đảm bảo chỉ có 1 conversation giữa 2 user (sử dụng compound index)
conversationSchema.index(
  { participants: 1 },
  {
    unique: true,
    partialFilterExpression: { participants: { $size: 2 } },
  }
);

module.exports = mongoose.model("Conversation", conversationSchema);
