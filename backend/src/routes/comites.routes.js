const express = require("express");
const {
    getPublicComites,
    getAdminComites,
    createComite,
    updateComite,
    deleteComite
} = require("../controllers/comites.controller");
const {
    verifyAdminToken,
    requirePasswordAlreadyChanged
} = require("../middlewares/auth.middleware");

const router = express.Router();

/* Públicas */
router.get("/", getPublicComites);

/* Admin */
router.get("/admin/list", verifyAdminToken, requirePasswordAlreadyChanged, getAdminComites);
router.post("/admin", verifyAdminToken, requirePasswordAlreadyChanged, createComite);
router.put("/admin/:id", verifyAdminToken, requirePasswordAlreadyChanged, updateComite);
router.delete("/admin/:id", verifyAdminToken, requirePasswordAlreadyChanged, deleteComite);

module.exports = router;