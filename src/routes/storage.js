const express           = require("express");
const router            = express.Router();
const requireAuth       = require("../middleware/authMiddleware");
const storageController = require("../controllers/storageController");

router.get("/bulk",    requireAuth, storageController.bulkGet); // POST for body
router.post("/bulk",   requireAuth, storageController.bulkGet);
router.get("/:key",    requireAuth, storageController.get);
router.put("/:key",    requireAuth, storageController.set);
router.delete("/:key", requireAuth, storageController.del);

module.exports = router;