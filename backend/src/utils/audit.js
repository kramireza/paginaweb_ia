const pool = require("../config/db");

function getIpAddress(req) {
    const forwardedFor = req.headers["x-forwarded-for"];

    if (forwardedFor) {
        return String(forwardedFor).split(",")[0].trim();
    }

    return (
        req.ip ||
        req.socket?.remoteAddress ||
        req.connection?.remoteAddress ||
        null
    );
}

function getUserAgent(req) {
    return req.headers["user-agent"] || null;
}

async function writeAuditLog(req, data = {}) {
    try {
        const admin = req.admin || {};

        await pool.query(
            `INSERT INTO audit_logs
            (
                admin_id,
                username,
                role,
                module,
                action,
                description,
                target_id,
                ip_address,
                user_agent
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
                admin.id || data.admin_id || null,
                admin.username || data.username || null,
                admin.role || data.role || null,
                data.module || "general",
                data.action || "unknown",
                data.description || null,
                data.target_id || null,
                getIpAddress(req),
                getUserAgent(req)
            ]
        );
    } catch (error) {
        console.error("Error guardando audit log:", error);
    }
}

module.exports = {
    writeAuditLog
};