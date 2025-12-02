// backend/routes/publicRoutes.js
import express from "express";
import Article from "../models/Article.js";

const router = express.Router();

/**
 * GET /api/public/articles
 * Public list of published articles with optional category + search
 */
router.get("/articles", async (req, res) => {
  try {
    const { category, search } = req.query;

    const filter = {
      status: "published",
    };

    // ✅ Case-insensitive match on categories array
    if (category) {
      const catRegex = new RegExp(`^${category}$`, "i");
      filter.categories = { $elemMatch: { $regex: catRegex } };
      // Equivalent: filter.categories = { $in: [catRegex] };
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.title = { $regex: searchRegex };
      // you can also add summary/content if you want:
      // filter.$or = [
      //   { title: { $regex: searchRegex } },
      //   { summary: { $regex: searchRegex } },
      // ];
    }

    const articles = await Article.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .select("title summary content imageUrl categories source publishedAt createdAt author")
      .populate("author", "name");

    res.json({ articles });
  } catch (err) {
    console.error("Public list articles error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/public/articles/:id
 * Single article for public view
 */
router.get("/articles/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const article = await Article.findOne({
      _id: id,
      status: "published", // only published visible publicly
    })
      .populate("author", "name")
      .exec();

    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    res.json({ article });
  } catch (err) {
    console.error("Public get article error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
