const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");

router.post("/ask", aiController.ask);
router.post("/stream", aiController.stream);

module.exports = router;
