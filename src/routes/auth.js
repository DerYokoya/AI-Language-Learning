const express        = require("express");
const router         = express.Router();
const authController = require("../controllers/authController");

router.post("/signup",  authController.signup);
router.post("/login",   authController.login);
router.post("/logout",  authController.logout);
router.post("/refresh", authController.refresh);
router.get("/me",       authController.me);

module.exports = router;