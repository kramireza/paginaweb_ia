const express = require("express");
const {
    login,
    logout,
    changeOwnPassword,
    me
} = require("../controllers/auth.controller");
const {
    verifyAdminToken
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/login", login);
router.post("/logout", verifyAdminToken, logout);
router.get("/me", verifyAdminToken, me);
router.post("/change-password", verifyAdminToken, changeOwnPassword);

module.exports = router;