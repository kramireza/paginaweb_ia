const express = require("express");
const {
    listAdminContactos,
    getAdminContactoById,
    updateAdminContactoEstado
} = require("../controllers/contacto.admin.controller");
const {
    verifyAdminToken,
    requirePasswordAlreadyChanged
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", verifyAdminToken, requirePasswordAlreadyChanged, listAdminContactos);
router.get("/:id", verifyAdminToken, requirePasswordAlreadyChanged, getAdminContactoById);
router.put("/:id/estado", verifyAdminToken, requirePasswordAlreadyChanged, updateAdminContactoEstado);

module.exports = router;