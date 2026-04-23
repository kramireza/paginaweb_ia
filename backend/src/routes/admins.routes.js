const express = require("express");
const {
    listAdmins,
    createAdmin,
    resetAdminPassword,
    deleteAdmin,
    listAuditLogs,
    exportAuditLogsExcel,
    exportAuditLogsPdf
} = require("../controllers/admins.controller");
const {
    verifyAdminToken,
    requireSuperadmin,
    requirePasswordAlreadyChanged
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(verifyAdminToken);
router.use(requirePasswordAlreadyChanged);
router.use(requireSuperadmin);

router.get("/", listAdmins);
router.get("/logs", listAuditLogs);
router.get("/logs/export/excel", exportAuditLogsExcel);
router.get("/logs/export/pdf", exportAuditLogsPdf);

router.post("/", createAdmin);
router.put("/:id/reset-password", resetAdminPassword);
router.delete("/:id", deleteAdmin);

module.exports = router;