const pool = require("../config/db");
const {
    ensureCenterAccess,
    filterAllowedExclusiveCenters
} = require("../middlewares/auth.middleware");
const { writeAuditLog } = require("../utils/audit");

const CENTROS_VALIDOS = ["vs", "cu", "danli"];

function normalizeCentro(value) {
    const centro = String(value || "vs").trim().toLowerCase();
    return CENTROS_VALIDOS.includes(centro) ? centro : null;
}

function normalizeNullableText(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text : null;
}

function buildInClause(startIndex, values) {
    const placeholders = values.map((_, index) => `$${startIndex + index}`).join(", ");
    return `(${placeholders})`;
}

async function getPublicComites(req, res) {
    try {
        const centro = normalizeCentro(req.query.centro);

        if (!centro) {
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const result = await pool.query(
            `SELECT id, centro, nombre, descripcion, encargados, activo, orden_visual, created_at, updated_at
             FROM comites_grupos
             WHERE activo = TRUE
               AND centro = $1
             ORDER BY orden_visual ASC, id ASC`,
            [centro]
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo comités públicos:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener comités"
        });
    }
}

async function getAdminComites(req, res) {
    try {
        const access = filterAllowedExclusiveCenters(req.admin, req.query.centro || null);

        if (!access.ok) {
            return res.status(403).json({
                ok: false,
                message: access.message
            });
        }

        const centers = access.centers;
        const placeholders = buildInClause(1, centers);

        const result = await pool.query(
            `SELECT id, centro, nombre, descripcion, encargados, activo, orden_visual, created_at, updated_at
             FROM comites_grupos
             WHERE centro IN ${placeholders}
             ORDER BY centro ASC, orden_visual ASC, id ASC`,
            centers
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo comités admin:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener comités"
        });
    }
}

async function createComite(req, res) {
    try {
        const {
            centro,
            nombre,
            descripcion,
            encargados,
            activo,
            orden_visual
        } = req.body;

        const centroNormalizado = normalizeCentro(centro || "vs");

        if (!centroNormalizado) {
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const permission = ensureCenterAccess(req.admin, centroNormalizado);
        if (!permission.allowed) {
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({
                ok: false,
                message: "El nombre del comité es obligatorio"
            });
        }

        if (!descripcion || !descripcion.trim()) {
            return res.status(400).json({
                ok: false,
                message: "La descripción es obligatoria"
            });
        }

        const result = await pool.query(
            `INSERT INTO comites_grupos
             (centro, nombre, descripcion, encargados, activo, orden_visual)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, centro, nombre, descripcion, encargados, activo, orden_visual, created_at, updated_at`,
            [
                centroNormalizado,
                nombre.trim(),
                descripcion.trim(),
                normalizeNullableText(encargados),
                activo === undefined ? true : (activo === true || activo === "true"),
                Number(orden_visual || 0)
            ]
        );

        await writeAuditLog(req, {
            module: "comites",
            action: "create",
            description: `Comité creado: ${result.rows[0].nombre || "sin nombre"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error creando comité:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al crear comité"
        });
    }
}

async function updateComite(req, res) {
    try {
        const id = Number(req.params.id);
        const {
            centro,
            nombre,
            descripcion,
            encargados,
            activo,
            orden_visual
        } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                ok: false,
                message: "ID inválido"
            });
        }

        const existing = await pool.query(
            `SELECT id, centro, nombre
             FROM comites_grupos
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Comité no encontrado"
            });
        }

        const oldCenter = existing.rows[0].centro;
        const newCenter = normalizeCentro(centro || oldCenter);

        if (!newCenter) {
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const oldPermission = ensureCenterAccess(req.admin, oldCenter);
        const newPermission = ensureCenterAccess(req.admin, newCenter);

        if (!oldPermission.allowed || !newPermission.allowed) {
            return res.status(403).json({
                ok: false,
                message: "No tienes permisos para editar este comité"
            });
        }

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({
                ok: false,
                message: "El nombre del comité es obligatorio"
            });
        }

        if (!descripcion || !descripcion.trim()) {
            return res.status(400).json({
                ok: false,
                message: "La descripción es obligatoria"
            });
        }

        const result = await pool.query(
            `UPDATE comites_grupos
             SET centro = $1,
                 nombre = $2,
                 descripcion = $3,
                 encargados = $4,
                 activo = $5,
                 orden_visual = $6,
                 updated_at = NOW()
             WHERE id = $7
             RETURNING id, centro, nombre, descripcion, encargados, activo, orden_visual, created_at, updated_at`,
            [
                newCenter,
                nombre.trim(),
                descripcion.trim(),
                normalizeNullableText(encargados),
                activo === true || activo === "true",
                Number(orden_visual || 0),
                id
            ]
        );

        await writeAuditLog(req, {
            module: "comites",
            action: "update",
            description: `Comité actualizado: ${result.rows[0].nombre || existing.rows[0].nombre || "sin nombre"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error actualizando comité:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al actualizar comité"
        });
    }
}

async function deleteComite(req, res) {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                ok: false,
                message: "ID inválido"
            });
        }

        const existing = await pool.query(
            `SELECT id, centro, nombre
             FROM comites_grupos
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Comité no encontrado"
            });
        }

        const permission = ensureCenterAccess(req.admin, existing.rows[0].centro);

        if (!permission.allowed) {
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        await pool.query(
            `DELETE FROM comites_grupos
             WHERE id = $1`,
            [id]
        );

        await writeAuditLog(req, {
            module: "comites",
            action: "delete",
            description: `Comité eliminado: ${existing.rows[0].nombre || "sin nombre"} (${existing.rows[0].centro})`,
            target_id: existing.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Comité eliminado correctamente"
        });
    } catch (error) {
        console.error("Error eliminando comité:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al eliminar comité"
        });
    }
}

module.exports = {
    getPublicComites,
    getAdminComites,
    createComite,
    updateComite,
    deleteComite
};