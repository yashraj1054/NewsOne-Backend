// backend/index.js
import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config();

// ESM imports for models + utils + routes
import Editor from "./models/Editor.js";
import { hashPassword } from "./config/auth.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import editorRoutes from "./routes/editorRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";


const app = express();

//cors-
app.use(cors()); 

// You can keep bodyParser or use express.json()
app.use(bodyParser.json());
// or simply: app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGODB_URL = process.env.MONGODB_URL;

mongoose.set("strictQuery", true);

// mongoose
//   .connect(MONGODB_URL)
//   .then(() => {
//     console.log("DB Connected Successfully! 🚀");
//     createInitialAdmin();
//     app.listen(PORT, () => {
//       console.log(`Server is running on http://localhost:${PORT}`);
//     });
//   })
//   .catch((error) => console.log("MongoDB error ➜", error));


let isConnected = false;

async function connectToMongoDB() {
  try {
    await mongoose.connect(MONGODB_URL).then(() => {
    console.log("DB Connected Successfully! 🚀");
    createInitialAdmin();
  })
  } catch (error) {
    console.error("MongoDB error :", error);
  }
  
}


app.use((req,res,next)=>{
  if(!isConnected){
    connectToMongoDB();
  }
  next();
})




// Create exactly ONE admin if not exists
async function createInitialAdmin() {
  try {
    const existingAdmin = await Editor.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("✔ Admin already exists:", existingAdmin.email);
      return;
    }

    const password = "Admin@123";
    const hashed = await hashPassword(password);

    const admin = await Editor.create({
      name: "Super Admin",
      email: "admin@newsone.live",
      password: hashed,
      role: "admin",
    });

    console.log("🔥 Admin created:");
    console.log("Email:", admin.email);
    console.log("Password:", password, " (please change)");
  } catch (err) {
    console.error("❌ Admin creation failed:", err.message);
  }
}

// Routes
app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/editor", editorRoutes); 
app.use("/api/public", publicRoutes);


module.exports = app