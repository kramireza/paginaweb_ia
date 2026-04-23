const express = require("express");
const {
    listLogs,
    exportLogsExcel,
    exportLogsPdf
} = require("../controllers/logs.controller");
const {
    verifyAdminToken,
    requireSuperadmin,
    requirePasswordAlreadyChanged
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(verifyAdminToken);
router.use(requirePasswordAlreadyChanged);
router.use(requireSuperadmin);

router.get("/", listLogs);
router.get("/export/excel", exportLogsExcel);
router.get("/export/pdf", exportLogsPdf);

module.exports = router;