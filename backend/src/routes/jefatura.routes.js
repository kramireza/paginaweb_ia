const express = require("express");
const {
    getPublicJefatura,
    getAdminJefatura,
    getJefaturaById,
    createJefatura,
    updateJefatura,
    deleteJefatura,
    getPublicUbicacionDepartamento,
    getAdminUbicacionDepartamento,
    saveUbicacionDepartamento
} = require("../controllers/jefatura.controller");
const {
    verifyAdminToken,
    requirePasswordAlreadyChanged
} = require("../middlewares/auth.middleware");
const { createUploader } = require("../utils/upload");

const router = express.Router();
const upload = createUploader("jefatura");
const uploadUbicacion = createUploader("jefatura-ubicacion");

/* Públicas */
router.get("/", getPublicJefatura);
router.get("/ubicacion", getPublicUbicacionDepartamento);

/* Admin */
router.get("/admin/list", verifyAdminToken, requirePasswordAlreadyChanged, getAdminJefatura);
router.post("/admin", verifyAdminToken, requirePasswordAlreadyChanged, upload.single("foto"), createJefatura);
router.put("/admin/:id", verifyAdminToken, requirePasswordAlreadyChanged, upload.single("foto"), updateJefatura);
router.delete("/admin/:id", verifyAdminToken, requirePasswordAlreadyChanged, deleteJefatura);

router.get("/admin/ubicacion", verifyAdminToken, requirePasswordAlreadyChanged, getAdminUbicacionDepartamento);
router.post("/admin/ubicacion", verifyAdminToken, requirePasswordAlreadyChanged, uploadUbicacion.single("imagen"), saveUbicacionDepartamento);
router.put("/admin/ubicacion", verifyAdminToken, requirePasswordAlreadyChanged, uploadUbicacion.single("imagen"), saveUbicacionDepartamento);

/* Pública por ID */
router.get("/:id", getJefaturaById);

module.exports = router;