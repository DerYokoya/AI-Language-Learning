const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/authMiddleware");
const userController = require("../controllers/userController");

router.get("/me", requireAuth, userController.getMe);
router.put("/settings", requireAuth, userController.updateSettings);

module.exports = router;
