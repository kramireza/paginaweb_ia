const express = require("express");
const {
    getPublicIiicapInfo,
    getAdminIiicapInfo,
    saveIiicapInfo,
    getPublicIiicapEncargados,
    getAdminIiicapEncargados,
    createIiicapEncargado,
    updateIiicapEncargado,
    deleteIiicapEncargado,
    getPublicIiicapInvestigaciones,
    getAdminIiicapInvestigaciones,
    createIiicapInvestigacion,
    updateIiicapInvestigacion,
    deleteIiicapInvestigacion
} = require("../controllers/iiicap.controller");
const {
    verifyAdminToken,
    requirePasswordAlreadyChanged
} = require("../middlewares/auth.middleware");
const { createUploader } = require("../utils/upload");

const router = express.Router();

const uploadEncargados = createUploader("iiicap-encargados");

const uploadInvestigaciones = createUploader("iiicap-investigaciones", {
    allowedMimeTypes: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/zip",
        "application/x-zip-compressed",
        "image/png",
        "image/jpeg"
    ],
    maxFileSizeMB: 20
});

/* Públicas */
router.get("/info", getPublicIiicapInfo);
router.get("/encargados", getPublicIiicapEncargados);
router.get("/investigaciones", getPublicIiicapInvestigaciones);

/* Admin info */
router.get("/admin/info", verifyAdminToken, requirePasswordAlreadyChanged, getAdminIiicapInfo);
router.post("/admin/info", verifyAdminToken, requirePasswordAlreadyChanged, saveIiicapInfo);
router.put("/admin/info", verifyAdminToken, requirePasswordAlreadyChanged, saveIiicapInfo);

/* Admin encargados */
router.get("/admin/encargados/list", verifyAdminToken, requirePasswordAlreadyChanged, getAdminIiicapEncargados);
router.post("/admin/encargados", verifyAdminToken, requirePasswordAlreadyChanged, uploadEncargados.single("foto"), createIiicapEncargado);
router.put("/admin/encargados/:id", verifyAdminToken, requirePasswordAlreadyChanged, uploadEncargados.single("foto"), updateIiicapEncargado);
router.delete("/admin/encargados/:id", verifyAdminToken, requirePasswordAlreadyChanged, deleteIiicapEncargado);

/* Admin investigaciones */
router.get("/admin/investigaciones/list", verifyAdminToken, requirePasswordAlreadyChanged, getAdminIiicapInvestigaciones);
router.post("/admin/investigaciones", verifyAdminToken, requirePasswordAlreadyChanged, uploadInvestigaciones.single("archivo"), createIiicapInvestigacion);
router.put("/admin/investigaciones/:id", verifyAdminToken, requirePasswordAlreadyChanged, uploadInvestigaciones.single("archivo"), updateIiicapInvestigacion);
router.delete("/admin/investigaciones/:id", verifyAdminToken, requirePasswordAlreadyChanged, deleteIiicapInvestigacion);

module.exports = router;