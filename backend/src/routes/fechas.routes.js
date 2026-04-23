const express = require("express");
const {
    getPublicFechas,
    getAdminFechas,
    getFechaById,
    createFecha,
    updateFecha,
    deleteFecha
} = require("../controllers/fechas.controller");
const {
    verifyAdminToken,
    requirePasswordAlreadyChanged
} = require("../middlewares/auth.middleware");

const router = express.Router();

/* Públicas */
router.get("/", getPublicFechas);

/* Admin */
router.get("/admin/list", verifyAdminToken, requirePasswordAlreadyChanged, getAdminFechas);
router.post("/admin", verifyAdminToken, requirePasswordAlreadyChanged, createFecha);
router.put("/admin/:id", verifyAdminToken, requirePasswordAlreadyChanged, updateFecha);
router.delete("/admin/:id", verifyAdminToken, requirePasswordAlreadyChanged, deleteFecha);

/* Pública por ID */
router.get("/:id", getFechaById);

module.exports = router;