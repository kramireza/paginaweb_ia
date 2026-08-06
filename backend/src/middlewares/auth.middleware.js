const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const VALID_CENTERS = ["vs", "cu", "danli", "global"];
const EXCLUSIVE_CENTERS = ["vs", "cu", "danli"];

function normalizeCenter(value) {
    const center = String(value || "").trim().toLowerCase();
    return VALID_CENTERS.includes(center) ? center : null;
}

function getTokenFromRequest(req) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        return authHeader.split(" ")[1];
    }

    if (req.cookies?.token) {
        return req.cookies.token;
    }

    if (req.cookies?.adminToken) {
        return req.cookies.adminToken;
    }

    return null;
}

async function verifyAdminToken(req, res, next) {
    const token = getTokenFromRequest(req);

    if (!token) {
        return res.status(401).json({
            ok: false,
            message: "Token requerido"
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const result = await pool.query(
            `SELECT
                id,
                username,
                full_name,
                role,
                cargo,
                assigned_center,
                must_change_password,
                is_active
             FROM admins
             WHERE id = $1
             LIMIT 1`,
            [decoded.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                ok: false,
                message: "La sesión ya no es válida"
            });
        }

        const admin = result.rows[0];

        if (!admin.is_active) {
            return res.status(403).json({
                ok: false,
                message: "Usuario inactivo"
            });
        }

        req.admin = {
            id: admin.id,
            username: admin.username,
            fullName: admin.full_name,
            role: admin.role,
            cargo: admin.cargo,
            assignedCenter: admin.assigned_center,
            mustChangePassword: admin.must_change_password
        };

        next();

    } catch (error) {
        return res.status(401).json({
            ok: false,
            message: "Token inválido o expirado"
        });
    }
}

function requireSuperadmin(req, res, next) {
    if (!req.admin) {
        return res.status(401).json({
            ok: false,
            message: "No autenticado"
        });
    }

    if (req.admin.role !== "superadmin") {
        return res.status(403).json({
            ok: false,
            message: "Acceso permitido solo para superadmin"
        });
    }

    next();
}

function requirePasswordAlreadyChanged(req, res, next) {
    if (!req.admin) {
        return res.status(401).json({
            ok: false,
            message: "No autenticado"
        });
    }

    if (req.admin.mustChangePassword === true) {
        return res.status(403).json({
            ok: false,
            code: "PASSWORD_CHANGE_REQUIRED",
            message: "Debes cambiar tu contraseña antes de continuar"
        });
    }

    next();
}

function getAllowedCentersForAdmin(admin) {
    if (!admin) return [];

    if (admin.role === "superadmin") {
        return ["global", "vs", "cu", "danli"];
    }

    const assigned = normalizeCenter(admin.assignedCenter);

    if (!assigned) return [];

    if (assigned === "global") {
        return ["global", "vs", "cu", "danli"];
    }

    return ["global", assigned];
}

function canAccessCenter(admin, requestedCenter) {
    const normalizedRequested = normalizeCenter(requestedCenter);

    if (!normalizedRequested) {
        return false;
    }

    const allowedCenters = getAllowedCentersForAdmin(admin);
    return allowedCenters.includes(normalizedRequested);
}

function ensureCenterAccess(admin, requestedCenter) {
    const normalizedRequested = normalizeCenter(requestedCenter);

    if (!normalizedRequested) {
        return {
            allowed: false,
            message: "Centro inválido"
        };
    }

    if (!canAccessCenter(admin, normalizedRequested)) {
        return {
            allowed: false,
            message: "No tienes permisos para operar sobre este centro"
        };
    }

    return {
        allowed: true,
        center: normalizedRequested
    };
}

function filterAllowedExclusiveCenters(admin, requestedCenter = null) {
    const allowedCenters = getAllowedCentersForAdmin(admin).filter(center =>
        EXCLUSIVE_CENTERS.includes(center)
    );

    if (!requestedCenter) {
        return {
            ok: true,
            centers: allowedCenters
        };
    }

    const normalizedRequested = normalizeCenter(requestedCenter);

    if (!normalizedRequested || !EXCLUSIVE_CENTERS.includes(normalizedRequested)) {
        return {
            ok: false,
            message: "Centro inválido. Valores permitidos: vs, cu, danli"
        };
    }

    if (!allowedCenters.includes(normalizedRequested)) {
        return {
            ok: false,
            message: "No tienes permisos para consultar ese centro"
        };
    }

    return {
        ok: true,
        centers: [normalizedRequested]
    };
}

function filterAllowedSharedCenters(admin, requestedCenter = null) {
    const allowedCenters = getAllowedCentersForAdmin(admin);

    if (!requestedCenter) {
        return {
            ok: true,
            centers: allowedCenters
        };
    }

    const normalizedRequested = normalizeCenter(requestedCenter);

    if (!normalizedRequested) {
        return {
            ok: false,
            message: "Centro inválido. Valores permitidos: global, vs, cu, danli"
        };
    }

    if (!allowedCenters.includes(normalizedRequested)) {
        return {
            ok: false,
            message: "No tienes permisos para consultar ese centro"
        };
    }

    return {
        ok: true,
        centers: [normalizedRequested]
    };
}

module.exports = {
    verifyAdminToken,
    requireSuperadmin,
    requirePasswordAlreadyChanged,
    normalizeCenter,
    getAllowedCentersForAdmin,
    canAccessCenter,
    ensureCenterAccess,
    filterAllowedExclusiveCenters,
    filterAllowedSharedCenters
};