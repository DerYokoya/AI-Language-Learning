const express = require("express");
const cookieParser = require("cookie-parser");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
require("dotenv").config();

const aiRoutes = require("./src/routes/ai");
const authRoutes = require("./src/routes/auth");
const userRoutes = require("./src/routes/users");
const chatRoutes = require("./src/routes/chats");
const flashcardRoutes = require("./src/routes/flashcards");
const storageRoutes = require("./src/routes/storage");
const errorHandler = require("./src/middleware/errorHandler");
const jwt = require("./src/utils/jwt");

const app = express();

// Render (and most PaaS hosts) sit behind a reverse proxy, so requests
// arrive with X-Forwarded-For set. Trust exactly 1 hop so Express/
// express-rate-limit read the real client IP instead of rejecting it.
app.set("trust proxy", 1);

app.use(express.json());
app.use(cookieParser());

// Rate limiter for AI endpoint — guests get 10/min, logged-in users get 30/min
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => (req.cookies?.token ? 30 : 10),
  keyGenerator: (req) => {
    if (req.cookies?.token) {
      try {
        const decoded = jwt.verify(req.cookies.token);
        return `user:${decoded.id}`;
      } catch {}
    }
    return `guest:${ipKeyGenerator(req)}`;
  },
  message: { error: "Too many requests, please slow down." },
});

// Rate limiter for auth endpoints — brute-force protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: "Too many attempts, please try again later." },
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/flashcards", flashcardRoutes);
app.use("/api/ai", aiLimiter, aiRoutes);
app.use("/api/storage", storageRoutes);

app.use(express.static("public"));
app.use(errorHandler);

app.get("/index", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/index.html", (req, res) => {
  res.redirect("/index");
});

const PORT = process.env.PORT || 3000;

// Only bind a port when this file is run directly (`node server.js`).
// When it's `require`d — e.g. by integration tests via supertest — we just
// export the configured app and let the caller decide how to use it.
if (require.main === module) {
  app.listen(PORT, () => {
    if (process.env.NODE_ENV !== "production") {
      process.stdout.write(`Server running on http://localhost:${PORT}\n`);
    }
  });
}

module.exports = app;