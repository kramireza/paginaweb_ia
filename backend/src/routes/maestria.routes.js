const express = require("express");
const {
    getPublicMaestriaInfo,
    getAdminMaestriaInfo,
    saveMaestriaInfo,

    getPublicMaestriaAvisos,
    getAdminMaestriaAvisos,
    createMaestriaAviso,
    updateMaestriaAviso,
    deleteMaestriaAviso,

    getPublicMaestriaReglamentos,
    getAdminMaestriaReglamentos,
    createMaestriaReglamento,
    updateMaestriaReglamento,
    deleteMaestriaReglamento,

    getPublicMaestriaFechas,
    getAdminMaestriaFechas,
    createMaestriaFecha,
    updateMaestriaFecha,
    deleteMaestriaFecha,

    getPublicMaestriaEncargados,
    getAdminMaestriaEncargados,
    createMaestriaEncargado,
    updateMaestriaEncargado,
    deleteMaestriaEncargado,

    getPublicMaestriaRecursos,
    getAdminMaestriaRecursos,
    createMaestriaRecurso,
    updateMaestriaRecurso,
    deleteMaestriaRecurso,

    getPublicMaestriaTutoriales,
    getAdminMaestriaTutoriales,
    createMaestriaTutorial,
    updateMaestriaTutorial,
    deleteMaestriaTutorial
} = require("../controllers/maestria.controller");
const {
    verifyAdminToken,
    requirePasswordAlreadyChanged
} = require("../middlewares/auth.middleware");
const { createUploader } = require("../utils/upload");

const router = express.Router();

const encargadosUpload = createUploader("maestria-encargados");

const recursosUpload = createUploader("maestria-recursos", {
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

const tutorialesUpload = createUploader("maestria-tutoriales", {
    allowedMimeTypes: [
        "video/mp4",
        "video/webm",
        "video/ogg"
    ],
    maxFileSizeMB: 150
});

/* Públicas info */
router.get("/info", getPublicMaestriaInfo);

/* Públicas avisos */
router.get("/avisos", getPublicMaestriaAvisos);

/* Públicas reglamentos */
router.get("/reglamentos", getPublicMaestriaReglamentos);

/* Públicas fechas */
router.get("/fechas", getPublicMaestriaFechas);

/* Públicas encargados */
router.get("/encargados", getPublicMaestriaEncargados);

/* Públicas recursos */
router.get("/recursos", getPublicMaestriaRecursos);

/* Públicas tutoriales */
router.get("/tutoriales", getPublicMaestriaTutoriales);

/* Admin info */
router.get("/admin/info", verifyAdminToken, requirePasswordAlreadyChanged, getAdminMaestriaInfo);
router.post("/admin/info", verifyAdminToken, requirePasswordAlreadyChanged, saveMaestriaInfo);
router.put("/admin/info", verifyAdminToken, requirePasswordAlreadyChanged, saveMaestriaInfo);

/* Admin avisos */
router.get("/admin/avisos/list", verifyAdminToken, requirePasswordAlreadyChanged, getAdminMaestriaAvisos);
router.post("/admin/avisos", verifyAdminToken, requirePasswordAlreadyChanged, createMaestriaAviso);
router.put("/admin/avisos/:id", verifyAdminToken, requirePasswordAlreadyChanged, updateMaestriaAviso);
router.delete("/admin/avisos/:id", verifyAdminToken, requirePasswordAlreadyChanged, deleteMaestriaAviso);

/* Admin reglamentos */
router.get("/admin/reglamentos/list", verifyAdminToken, requirePasswordAlreadyChanged, getAdminMaestriaReglamentos);
router.post("/admin/reglamentos", verifyAdminToken, requirePasswordAlreadyChanged, createMaestriaReglamento);
router.put("/admin/reglamentos/:id", verifyAdminToken, requirePasswordAlreadyChanged, updateMaestriaReglamento);
router.delete("/admin/reglamentos/:id", verifyAdminToken, requirePasswordAlreadyChanged, deleteMaestriaReglamento);

/* Admin fechas */
router.get("/admin/fechas/list", verifyAdminToken, requirePasswordAlreadyChanged, getAdminMaestriaFechas);
router.post("/admin/fechas", verifyAdminToken, requirePasswordAlreadyChanged, createMaestriaFecha);
router.put("/admin/fechas/:id", verifyAdminToken, requirePasswordAlreadyChanged, updateMaestriaFecha);
router.delete("/admin/fechas/:id", verifyAdminToken, requirePasswordAlreadyChanged, deleteMaestriaFecha);

/* Admin encargados */
router.get("/admin/encargados/list", verifyAdminToken, requirePasswordAlreadyChanged, getAdminMaestriaEncargados);
router.post("/admin/encargados", verifyAdminToken, requirePasswordAlreadyChanged, encargadosUpload.single("foto"), createMaestriaEncargado);
router.put("/admin/encargados/:id", verifyAdminToken, requirePasswordAlreadyChanged, encargadosUpload.single("foto"), updateMaestriaEncargado);
router.delete("/admin/encargados/:id", verifyAdminToken, requirePasswordAlreadyChanged, deleteMaestriaEncargado);

/* Admin recursos */
router.get("/admin/recursos/list", verifyAdminToken, requirePasswordAlreadyChanged, getAdminMaestriaRecursos);
router.post("/admin/recursos", verifyAdminToken, requirePasswordAlreadyChanged, recursosUpload.single("archivo"), createMaestriaRecurso);
router.put("/admin/recursos/:id", verifyAdminToken, requirePasswordAlreadyChanged, recursosUpload.single("archivo"), updateMaestriaRecurso);
router.delete("/admin/recursos/:id", verifyAdminToken, requirePasswordAlreadyChanged, deleteMaestriaRecurso);

/* Admin tutoriales */
router.get("/admin/tutoriales/list", verifyAdminToken, requirePasswordAlreadyChanged, getAdminMaestriaTutoriales);
router.post("/admin/tutoriales", verifyAdminToken, requirePasswordAlreadyChanged, tutorialesUpload.single("video"), createMaestriaTutorial);
router.put("/admin/tutoriales/:id", verifyAdminToken, requirePasswordAlreadyChanged, tutorialesUpload.single("video"), updateMaestriaTutorial);
router.delete("/admin/tutoriales/:id", verifyAdminToken, requirePasswordAlreadyChanged, deleteMaestriaTutorial);

module.exports = router;