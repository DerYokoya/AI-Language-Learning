const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");

router.post("/ask", aiController.ask);

module.exports = router;
