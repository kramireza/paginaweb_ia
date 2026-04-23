const express = require("express");
const {
    getPublicAvisos,
    getAdminAvisos,
    createAviso,
    updateAviso,
    deleteAviso,
    getPublicReglamentos,
    getAdminReglamentos,
    createReglamento,
    updateReglamento,
    deleteReglamento,
    getPublicRecursos,
    getAdminRecursos,
    createRecurso,
    updateRecurso,
    deleteRecurso,
    getPublicTutoriales,
    getAdminTutoriales,
    createTutorial,
    updateTutorial,
    deleteTutorial
} = require("../controllers/avisos.controller");
const {
    verifyAdminToken,
    requirePasswordAlreadyChanged
} = require("../middlewares/auth.middleware");
const { createUploader } = require("../utils/upload");

const router = express.Router();

const recursosUpload = createUploader("recursos", {
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

const tutorialesUpload = createUploader("tutoriales", {
    allowedMimeTypes: [
        "video/mp4",
        "video/webm",
        "video/ogg"
    ],
    maxFileSizeMB: 150
});

/* Públicas */
router.get("/", getPublicAvisos);
router.get("/reglamentos", getPublicReglamentos);
router.get("/recursos", getPublicRecursos);
router.get("/tutoriales", getPublicTutoriales);

/* Admin avisos */
router.get("/admin/list", verifyAdminToken, requirePasswordAlreadyChanged, getAdminAvisos);
router.post("/admin", verifyAdminToken, requirePasswordAlreadyChanged, createAviso);
router.put("/admin/:id", verifyAdminToken, requirePasswordAlreadyChanged, updateAviso);
router.delete("/admin/:id", verifyAdminToken, requirePasswordAlreadyChanged, deleteAviso);

/* Admin reglamentos */
router.get("/admin/reglamentos/list", verifyAdminToken, requirePasswordAlreadyChanged, getAdminReglamentos);
router.post("/admin/reglamentos", verifyAdminToken, requirePasswordAlreadyChanged, createReglamento);
router.put("/admin/reglamentos/:id", verifyAdminToken, requirePasswordAlreadyChanged, updateReglamento);
router.delete("/admin/reglamentos/:id", verifyAdminToken, requirePasswordAlreadyChanged, deleteReglamento);

/* Admin recursos */
router.get("/admin/recursos/list", verifyAdminToken, requirePasswordAlreadyChanged, getAdminRecursos);
router.post("/admin/recursos", verifyAdminToken, requirePasswordAlreadyChanged, recursosUpload.single("archivo"), createRecurso);
router.put("/admin/recursos/:id", verifyAdminToken, requirePasswordAlreadyChanged, recursosUpload.single("archivo"), updateRecurso);
router.delete("/admin/recursos/:id", verifyAdminToken, requirePasswordAlreadyChanged, deleteRecurso);

/* Admin tutoriales */
router.get("/admin/tutoriales/list", verifyAdminToken, requirePasswordAlreadyChanged, getAdminTutoriales);
router.post("/admin/tutoriales", verifyAdminToken, requirePasswordAlreadyChanged, tutorialesUpload.single("video"), createTutorial);
router.put("/admin/tutoriales/:id", verifyAdminToken, requirePasswordAlreadyChanged, tutorialesUpload.single("video"), updateTutorial);
router.delete("/admin/tutoriales/:id", verifyAdminToken, requirePasswordAlreadyChanged, deleteTutorial);

module.exports = router;