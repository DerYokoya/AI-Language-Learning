const express      = require("express");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const aiRoutes      = require("./src/routes/ai");
const authRoutes    = require("./src/routes/auth");
const userRoutes    = require("./src/routes/users");
const chatRoutes    = require("./src/routes/chats");
const flashcardRoutes = require("./src/routes/flashcards");
const storageRoutes = require("./src/routes/storage");

const app = express();
app.use(express.json());
app.use(cookieParser());

// API routes
app.use("/api/auth",       authRoutes);
app.use("/api/users",      userRoutes);
app.use("/api/chats",      chatRoutes);
app.use("/api/flashcards", flashcardRoutes);
app.use("/api/ai",         aiRoutes);
app.use("/api/storage",    storageRoutes);

// Static frontend
app.use(express.static("public"));

app.get("/index", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/index.html", (req, res) => {
  res.redirect("/index");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));