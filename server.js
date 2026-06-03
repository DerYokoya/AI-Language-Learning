const express = require("express");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const aiRoutes = require("./src/routes/ai");
const authRoutes = require("./src/routes/auth");
const userRoutes = require("./src/routes/users");
const chatRoutes = require("./src/routes/chats");
const flashcardRoutes = require("./src/routes/flashcards");
const storageRoutes = require("./src/routes/storage");
const errorHandler = require("./src/middleware/errorHandler");
const app = express();

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/flashcards", flashcardRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/storage", storageRoutes);

app.use(express.static("public"));
app.use(errorHandler)

app.get("/index", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/index.html", (req, res) => {
  res.redirect("/index");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  if (process.env.NODE_ENV !== "production") {
    process.stdout.write(`Server running on http://localhost:${PORT}\n`);
  }
});
