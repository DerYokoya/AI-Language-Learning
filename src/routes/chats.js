const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/authMiddleware");
const chatController = require("../controllers/chatController");

router.get("/", requireAuth, chatController.listChats);
router.get("/:id", requireAuth, chatController.getChat);
router.post("/", requireAuth, chatController.createChat);
router.put("/:id", requireAuth, chatController.updateChat);
router.delete("/:id", requireAuth, chatController.deleteChat);
router.post("/:id/messages", requireAuth, chatController.addMessage);

module.exports = router;
