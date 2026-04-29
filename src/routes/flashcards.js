const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/authMiddleware");
const flashcardController = require("../controllers/flashcardController");

router.get("/", requireAuth, flashcardController.list);
router.post("/bulk", requireAuth, flashcardController.bulkAdd);
router.patch("/:id", requireAuth, flashcardController.update);
router.delete("/", requireAuth, flashcardController.clear);

module.exports = router;
