// backend/routes/adminRoutes.js
import mongoose from "mongoose";
import express from "express";
import Editor from "../models/Editor.js";
import Article from "../models/Article.js";
import { authMiddleware } from "../middleware/auth.js";
import { hashPassword } from "../config/auth.js";

const router = express.Router();

/** Small guard to ensure the logged-in user is admin */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
}

/** Utility: simple random password generator */
function generateRandomPassword(length = 10) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let pwd = "";
  for (let i = 0; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

/* ------------------------------------------------------------------ */
/*  EDITOR MANAGEMENT                                                  */
/* ------------------------------------------------------------------ */

/**
 * POST /api/admin/editors
 * Create a new editor account
 */
router.post("/editors", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }

    const existing = await Editor.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const hashed = await hashPassword(password);

    const editor = await Editor.create({
      name,
      email,
      password: hashed,
      role: "user", // editors are "user" role in our setup
    });

    res.status(201).json({
      message: "Editor created successfully",
      editor: {
        id: editor._id,
        name: editor.name,
        email: editor.email,
        role: editor.role,
        createdAt: editor.createdAt,
      },
    });
  } catch (err) {
    console.error("Create editor error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/admin/editors
 * List editors (all or limited)
 */
router.get("/editors", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { limit } = req.query;
    let query = Editor.find().sort({ createdAt: -1 });
    if (limit) query = query.limit(parseInt(limit, 10));

    const editors = await query.select("name email role createdAt updatedAt");
    res.json({ editors });
  } catch (err) {
    console.error("List editors error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUT /api/admin/editors/:id
 * Update editor basic info (name/email/role)
 */
router.put("/editors/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { name, email, role } = req.body;
    const editor = await Editor.findById(req.params.id);

    if (!editor) {
      return res.status(404).json({ message: "Editor not found" });
    }

    if (email && email !== editor.email) {
      const existing = await Editor.findOne({
        email,
        _id: { $ne: editor._id },
      });
      if (existing) {
        return res
          .status(400)
          .json({ message: "Email is already used by another user" });
      }
      editor.email = email;
    }

    if (name) editor.name = name;
    if (role) editor.role = role;

    await editor.save();

    res.json({
      message: "Editor updated successfully",
      editor: {
        id: editor._id,
        name: editor.name,
        email: editor.email,
        role: editor.role,
      },
    });
  } catch (err) {
    console.error("Update editor error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUT /api/admin/editors/:id/reset-password
 * Reset an editor password to a new random one (returned to admin)
 */
router.put(
  "/editors/:id/reset-password",
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    try {
      const editor = await Editor.findById(req.params.id);
      if (!editor) {
        return res.status(404).json({ message: "Editor not found" });
      }

      const newPassword = generateRandomPassword();
      editor.password = await hashPassword(newPassword);
      await editor.save();

      res.json({
        message: "Password reset successfully",
        email: editor.email,
        newPassword, // admin can copy this & send to editor
      });
    } catch (err) {
      console.error("Reset password error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * DELETE /api/admin/editors/:id
 * Delete an editor (not the current admin)
 */
router.delete(
  "/editors/:id",
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    try {
      const editorId = req.params.id;

      // Optional safety: prevent admin from deleting themselves
      if (req.user && String(req.user._id) === String(editorId)) {
        return res
          .status(400)
          .json({ message: "You cannot delete your own admin account" });
      }

      const editor = await Editor.findByIdAndDelete(editorId);
      if (!editor) {
        return res.status(404).json({ message: "Editor not found" });
      }

      res.json({ message: "Editor deleted successfully" });
    } catch (err) {
      console.error("Delete editor error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/* ------------------------------------------------------------------ */
/*  DASHBOARD OVERVIEW                                                 */
/* ------------------------------------------------------------------ */

/**
 * GET /api/admin/overview
 * Overall stats for dashboard
 */
router.get("/overview", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const [
      totalEditors,
      totalArticles,
      publishedArticles,
      draftArticles,
      pendingReviews,
    ] = await Promise.all([
      // all non-admin accounts
      Editor.countDocuments({ role: { $ne: "admin" } }),
      // all articles
      Article.countDocuments(),
      // published
      Article.countDocuments({ status: "published" }),
      // drafts
      Article.countDocuments({ status: "draft" }),
      // pending review
      Article.countDocuments({ status: "in_review" }),
    ]);

    res.json({
      totalEditors,
      totalArticles,
      publishedArticles,
      draftArticles,
      pendingReviews,
    });
  } catch (err) {
    console.error("Admin overview error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  ARTICLES (ADMIN VIEW + STATUS CONTROL)                            */
/* ------------------------------------------------------------------ */

/**
 * GET /api/admin/articles
 * List articles across all editors (supports filters for dashboard & listing)
 * Query:
 *   status? = draft | in_review | published
 *   page?   = 1..N
 *   limit?  = default 20
 */
router.get("/articles", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const {
      status,           // optional
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [articles, total] = await Promise.all([
      Article.find(query)
        .sort({ updatedAt: -1 })
        // NOTE: using "author" because your schema uses that, not "editor"
        .skip(skip)
        .limit(Number(limit))
        .populate("author", "name email"),
      Article.countDocuments(query),
    ]);

    res.json({
      articles,
      total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    console.error("Admin list articles error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/admin/articles/:id
 * Single article detail (for popup)
 */
router.get("/articles/:id", authMiddleware, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Validate ObjectId to avoid CastError
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "Article not found" });
    }

    // IMPORTANT: populate "author" (your schema), not "editor"
    const article = await Article.findById(id).populate(
      "author",
      "name email"
    );

    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    return res.json({ article });
  } catch (err) {
    console.error("Admin get article detail error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUT /api/admin/articles/:id/status
 * Change status of an article: draft | in_review | published
 */
router.put(
  "/articles/:id/status",
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    try {
      const { status } = req.body;

      const allowed = ["draft", "in_review", "published"];
      if (!allowed.includes(status)) {
        return res
          .status(400)
          .json({ message: "Invalid status value supplied" });
      }

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(404).json({ message: "Article not found" });
      }

      const article = await Article.findById(req.params.id);
      if (!article) {
        return res.status(404).json({ message: "Article not found" });
      }

      article.status = status;
      if (status === "published") {
        article.publishedAt = new Date();
      }
      await article.save();

      res.json({
        message: "Article status updated",
        article,
      });
    } catch (err) {
      console.error("Admin update article status error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

export default router;
