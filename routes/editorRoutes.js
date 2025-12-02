// backend/routes/editorRoutes.js
import express from "express";
import Article from "../models/Article.js";
import Editor from "../models/Editor.js";
import { authMiddleware } from "../middleware/auth.js";
import { hashPassword, comparePassword } from "../config/auth.js";

const router = express.Router();

function normalizeCategories(input) {
  let cats = [];

  if (Array.isArray(input)) {
    cats = input;
  } else if (typeof input === "string" && input.trim()) {
    cats = input
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
  }

  // lowercase + trim
  cats = cats.map((c) => c.toLowerCase().trim());

  // remove duplicates
  cats = [...new Set(cats)];

  // fallback default if empty
  if (!cats.length) {
    cats = ["latest"];
  }

  return cats;
}

/**
 * POST /api/editor/articles
 * Create a new article for the logged-in editor
 */
router.post("/articles", authMiddleware, async (req, res) => {
  try {
    const {
      title,
      summary,
      content,
      categories,
      imageUrl,
      source,
      status,
    } = req.body;

    if (!title || !content) {
      return res
        .status(400)
        .json({ message: "Title and content are required" });
    }

    const cats = normalizeCategories(categories);

    const article = await Article.create({
      title,
      summary: summary || "",
      content,
      categories: cats,
      imageUrl: imageUrl || "",
      source: source || "",
      status: status || "draft",
      author: req.user.id,
      publishedAt: status === "published" ? new Date() : undefined,
    });

    res.status(201).json({
      message: "Article created successfully",
      article,
    });
  } catch (err) {
    console.error("Create article error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/**
 * PUT /api/editor/articles/:id
 * Update an existing article for the logged-in editor
 */
router.put("/articles/:id", authMiddleware, async (req, res) => {
  try {
    const {
      title,
      summary,
      content,
      categories,
      imageUrl,
      source,
      status,
    } = req.body;

    const article = await Article.findOne({
      _id: req.params.id,
      author: req.user.id,
    });

    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    if (title !== undefined) article.title = title;
    if (summary !== undefined) article.summary = summary;
    if (content !== undefined) article.content = content;
    if (imageUrl !== undefined) article.imageUrl = imageUrl;
    if (source !== undefined) article.source = source;

    if (categories !== undefined) {
      const cats = normalizeCategories(categories);
      article.categories = cats;
    }

    if (status !== undefined) {
      const allowed = ["draft", "in_review", "published"];
      if (!allowed.includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }
      article.status = status;
      if (status === "published" && !article.publishedAt) {
        article.publishedAt = new Date();
      }
    }

    await article.save();

    res.json({
      message: "Article updated successfully",
      article,
    });
  } catch (err) {
    console.error("Update article error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/**
 * GET /api/editor/articles
 * List articles for logged-in editor
 */
router.get("/articles", authMiddleware, async (req, res) => {
  try {
    const { status, limit } = req.query;

    const filter = { author: req.user.id };
    if (status) filter.status = status;

    const query = Article.find(filter).sort({ updatedAt: -1 });
    if (limit) query.limit(parseInt(limit, 10));

    const articles = await query.exec();
    res.json({ articles });
  } catch (err) {
    console.error("List articles error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * ✅ NEW: GET /api/editor/articles/:id
 * Get a single article for the logged-in editor
 */
router.get("/articles/:id", authMiddleware, async (req, res) => {
  try {
    const article = await Article.findOne({
      _id: req.params.id,
      author: req.user.id,
    });

    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    res.json({ article });
  } catch (err) {
    console.error("Get single article error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/editor/overview
 * Stats for dashboard
 */
router.get("/overview", authMiddleware, async (req, res) => {
  try {
    const author = req.user.id;

    const [total, drafts, published, inReview] = await Promise.all([
      Article.countDocuments({ author }),
      Article.countDocuments({ author, status: "draft" }),
      Article.countDocuments({ author, status: "published" }),
      Article.countDocuments({ author, status: "in_review" }),
    ]);

    res.json({
      totalArticles: total,
      drafts,
      published,
      inReview,
    });
  } catch (err) {
    console.error("Overview error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/editor/me
 * Current editor profile
 */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const editor = await Editor.findById(req.user.id).select(
      "name email role createdAt"
    );
    if (!editor) {
      return res.status(404).json({ message: "Editor not found" });
    }
    res.json({ editor });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUT /api/editor/me
 * Update name / email for current editor
 */
router.put("/me", authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;
    const editor = await Editor.findById(req.user.id);
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
          .json({ message: "Email is already in use by another user" });
      }
      editor.email = email;
    }

    if (name) editor.name = name;

    await editor.save();

    res.json({
      message: "Profile updated successfully",
      editor: {
        id: editor._id,
        name: editor.name,
        email: editor.email,
        role: editor.role,
      },
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUT /api/editor/change-password
 * Change password for current editor
 */
router.put("/change-password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current and new password are required" });
    }

    const editor = await Editor.findById(req.user.id);
    if (!editor) {
      return res.status(404).json({ message: "Editor not found" });
    }

    const matches = await comparePassword(currentPassword, editor.password);
    if (!matches) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    editor.password = await hashPassword(newPassword);
    await editor.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
