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

function buildInClause(startIndex, values) {
    const placeholders = values.map((_, index) => `$${startIndex + index}`).join(", ");
    return `(${placeholders})`;
}

async function getPublicFechas(req, res) {
    try {
        const centro = normalizeCentro(req.query.centro);

        if (!centro) {
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const result = await pool.query(
            `SELECT id, centro, titulo, descripcion, fecha, activo, orden_visual, created_at, updated_at
             FROM fechas_importantes
             WHERE activo = TRUE
               AND centro = $1
             ORDER BY fecha ASC, orden_visual ASC, id ASC`,
            [centro]
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo fechas públicas:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener fechas importantes"
        });
    }
}

async function getAdminFechas(req, res) {
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
            `SELECT id, centro, titulo, descripcion, fecha, activo, orden_visual, created_at, updated_at
             FROM fechas_importantes
             WHERE centro IN ${placeholders}
             ORDER BY fecha ASC, orden_visual ASC, id ASC`,
            centers
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo fechas admin:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener fechas importantes"
        });
    }
}

async function getFechaById(req, res) {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                ok: false,
                message: "ID inválido"
            });
        }

        const result = await pool.query(
            `SELECT id, centro, titulo, descripcion, fecha, activo, orden_visual, created_at, updated_at
             FROM fechas_importantes
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Fecha no encontrada"
            });
        }

        return res.json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error obteniendo fecha por ID:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener fecha"
        });
    }
}

async function createFecha(req, res) {
    try {
        const {
            centro,
            titulo,
            descripcion,
            fecha,
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

        if (!titulo || !titulo.trim()) {
            return res.status(400).json({
                ok: false,
                message: "El título es obligatorio"
            });
        }

        if (!descripcion || !descripcion.trim()) {
            return res.status(400).json({
                ok: false,
                message: "La descripción es obligatoria"
            });
        }

        if (!fecha) {
            return res.status(400).json({
                ok: false,
                message: "La fecha es obligatoria"
            });
        }

        const result = await pool.query(
            `INSERT INTO fechas_importantes
             (centro, titulo, descripcion, fecha, activo, orden_visual)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, centro, titulo, descripcion, fecha, activo, orden_visual, created_at, updated_at`,
            [
                centroNormalizado,
                titulo.trim(),
                descripcion.trim(),
                fecha,
                activo === undefined ? true : (activo === true || activo === "true"),
                Number(orden_visual || 0)
            ]
        );

        await writeAuditLog(req, {
            module: "fechas",
            action: "create",
            description: `Fecha creada: ${result.rows[0].titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error creando fecha:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al crear fecha importante"
        });
    }
}

async function updateFecha(req, res) {
    try {
        const id = Number(req.params.id);
        const {
            centro,
            titulo,
            descripcion,
            fecha,
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
            `SELECT id, centro, titulo
             FROM fechas_importantes
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Fecha no encontrada"
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
                message: "No tienes permisos para editar esta fecha"
            });
        }

        if (!titulo || !titulo.trim()) {
            return res.status(400).json({
                ok: false,
                message: "El título es obligatorio"
            });
        }

        if (!descripcion || !descripcion.trim()) {
            return res.status(400).json({
                ok: false,
                message: "La descripción es obligatoria"
            });
        }

        if (!fecha) {
            return res.status(400).json({
                ok: false,
                message: "La fecha es obligatoria"
            });
        }

        const result = await pool.query(
            `UPDATE fechas_importantes
             SET centro = $1,
                 titulo = $2,
                 descripcion = $3,
                 fecha = $4,
                 activo = $5,
                 orden_visual = $6,
                 updated_at = NOW()
             WHERE id = $7
             RETURNING id, centro, titulo, descripcion, fecha, activo, orden_visual, created_at, updated_at`,
            [
                newCenter,
                titulo.trim(),
                descripcion.trim(),
                fecha,
                activo === true || activo === "true",
                Number(orden_visual || 0),
                id
            ]
        );

        await writeAuditLog(req, {
            module: "fechas",
            action: "update",
            description: `Fecha actualizada: ${result.rows[0].titulo || existing.rows[0].titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error actualizando fecha:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al actualizar fecha importante"
        });
    }
}

async function deleteFecha(req, res) {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                ok: false,
                message: "ID inválido"
            });
        }

        const existing = await pool.query(
            `SELECT id, centro, titulo
             FROM fechas_importantes
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Fecha no encontrada"
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
            `DELETE FROM fechas_importantes
             WHERE id = $1`,
            [id]
        );

        await writeAuditLog(req, {
            module: "fechas",
            action: "delete",
            description: `Fecha eliminada: ${existing.rows[0].titulo || "sin título"} (${existing.rows[0].centro})`,
            target_id: existing.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Fecha eliminada correctamente"
        });
    } catch (error) {
        console.error("Error eliminando fecha:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al eliminar fecha importante"
        });
    }
}

module.exports = {
    getPublicFechas,
    getAdminFechas,
    getFechaById,
    createFecha,
    updateFecha,
    deleteFecha
};