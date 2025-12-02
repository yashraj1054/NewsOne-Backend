// backend/models/Article.js
import mongoose from "mongoose";

const CATEGORIES = [
  "latest",
  "business",
  "sports",
  "entertainment",
  "political",
  "international",
  "tech",
  "automobile",
  "law",
  "other",
];

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    summary: { type: String, trim: true },
    content: { type: String, required: true },

    categories: [
      {
        type: String,
        enum: CATEGORIES,
        lowercase: true,  // 🔥 Fix category enum mismatch
        trim: true,
      },
    ],

    imageUrl: {
      type: String,
      trim: true,
    },

    source: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["draft", "in_review", "published"],
      default: "draft",
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Editor",
      required: true,
    },

    publishedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

const Article = mongoose.model("Article", articleSchema);
export default Article;
