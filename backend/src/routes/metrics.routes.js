const express = require("express");
const {
    registerPageVisit,
    getMetricsSummary,
    getVisitsByCenter,
    getTopPages,
    getLatestVisits
} = require("../controllers/metrics.controller");
const {
    verifyAdminToken,
    requireSuperadmin,
    requirePasswordAlreadyChanged
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/visit", registerPageVisit);

router.get(
    "/summary",
    verifyAdminToken,
    requirePasswordAlreadyChanged,
    requireSuperadmin,
    getMetricsSummary
);

router.get(
    "/by-center",
    verifyAdminToken,
    requirePasswordAlreadyChanged,
    requireSuperadmin,
    getVisitsByCenter
);

router.get(
    "/top-pages",
    verifyAdminToken,
    requirePasswordAlreadyChanged,
    requireSuperadmin,
    getTopPages
);

router.get(
    "/latest",
    verifyAdminToken,
    requirePasswordAlreadyChanged,
    requireSuperadmin,
    getLatestVisits
);

module.exports = router;