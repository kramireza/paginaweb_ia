const express = require("express");
const {
    getPublicAutoridades,
    getAdminAutoridades,
    getAutoridadById,
    createAutoridad,
    updateAutoridad,
    deleteAutoridad,
    getPublicAutoridadesInfo,
    getAdminAutoridadesInfo,
    saveAutoridadesInfo
} = require("../controllers/autoridades.controller");
const {
    verifyAdminToken,
    requirePasswordAlreadyChanged
} = require("../middlewares/auth.middleware");
const { createUploader } = require("../utils/upload");

const router = express.Router();
const upload = createUploader("autoridades");

/* Públicas */
router.get("/", getPublicAutoridades);
router.get("/info", getPublicAutoridadesInfo);

/* Admin */
router.get("/admin/list", verifyAdminToken, requirePasswordAlreadyChanged, getAdminAutoridades);
router.post("/admin", verifyAdminToken, requirePasswordAlreadyChanged, upload.single("foto"), createAutoridad);
router.put("/admin/:id", verifyAdminToken, requirePasswordAlreadyChanged, upload.single("foto"), updateAutoridad);
router.delete("/admin/:id", verifyAdminToken, requirePasswordAlreadyChanged, deleteAutoridad);

router.get("/admin/info", verifyAdminToken, requirePasswordAlreadyChanged, getAdminAutoridadesInfo);
router.post("/admin/info", verifyAdminToken, requirePasswordAlreadyChanged, saveAutoridadesInfo);
router.put("/admin/info", verifyAdminToken, requirePasswordAlreadyChanged, saveAutoridadesInfo);

/* Pública por ID */
router.get("/:id", getAutoridadById);

module.exports = router;