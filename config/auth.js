import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const JWT_EXPIRES_IN = "7d";

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}

export async function comparePassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

export function generateToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}
