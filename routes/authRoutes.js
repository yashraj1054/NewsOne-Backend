// backend/routes/authRoutes.js
import express from "express";
import Editor from "../models/Editor.js";
import { comparePassword, generateToken } from "../config/auth.js";

const router = express.Router();

// ❌ no authMiddleware, no adminOnly here
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await Editor.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await comparePassword(password, user.password);
    if (!match)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
