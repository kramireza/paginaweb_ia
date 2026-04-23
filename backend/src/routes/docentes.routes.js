const express = require("express");
const {
    getPublicDocentes,
    getAdminDocentes,
    getDocenteById,
    createDocente,
    updateDocente,
    deleteDocente
} = require("../controllers/docentes.controller");
const {
    verifyAdminToken,
    requirePasswordAlreadyChanged
} = require("../middlewares/auth.middleware");
const { createUploader } = require("../utils/upload");

const router = express.Router();
const upload = createUploader("docentes");

/* Públicas */
router.get("/", getPublicDocentes);

/* Admin */
router.get("/admin/list", verifyAdminToken, requirePasswordAlreadyChanged, getAdminDocentes);
router.post("/admin", verifyAdminToken, requirePasswordAlreadyChanged, upload.single("foto"), createDocente);
router.put("/admin/:id", verifyAdminToken, requirePasswordAlreadyChanged, upload.single("foto"), updateDocente);
router.delete("/admin/:id", verifyAdminToken, requirePasswordAlreadyChanged, deleteDocente);

/* Pública por ID */
router.get("/:id", getDocenteById);

module.exports = router;