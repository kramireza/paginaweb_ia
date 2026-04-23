const pool = require("../config/db");
const {
    ensureCenterAccess,
    filterAllowedExclusiveCenters
} = require("../middlewares/auth.middleware");
const { writeAuditLog } = require("../utils/audit");

const ESTADOS_VALIDOS = ["pendiente", "leido", "respondido"];

function normalizeEstado(value) {
    const estado = String(value || "").trim().toLowerCase();
    return ESTADOS_VALIDOS.includes(estado) ? estado : null;
}

function buildInClause(startIndex, values) {
    const placeholders = values.map((_, index) => `$${startIndex + index}`).join(", ");
    return `(${placeholders})`;
}

async function listAdminContactos(req, res) {
    try {
        const { centro, destinatario, estado } = req.query;

        const access = filterAllowedExclusiveCenters(req.admin, centro || null);

        if (!access.ok) {
            return res.status(403).json({
                ok: false,
                message: access.message
            });
        }

        const centers = access.centers;
        const values = [...centers];
        const conditions = [`centro IN ${buildInClause(1, centers)}`];
        let paramIndex = values.length + 1;

        if (destinatario) {
            conditions.push(`destinatario = $${paramIndex}`);
            values.push(String(destinatario).trim().toLowerCase());
            paramIndex++;
        }

        if (estado) {
            const estadoNormalizado = normalizeEstado(estado);

            if (!estadoNormalizado) {
                return res.status(400).json({
                    ok: false,
                    message: "Estado inválido. Valores permitidos: pendiente, leido, respondido"
                });
            }

            conditions.push(`estado = $${paramIndex}`);
            values.push(estadoNormalizado);
            paramIndex++;
        }

        const result = await pool.query(
            `SELECT
                id,
                centro,
                nombre,
                correo,
                telefono,
                destinatario,
                asunto,
                mensaje,
                estado,
                created_at,
                updated_at
             FROM contactos
             WHERE ${conditions.join(" AND ")}
             ORDER BY created_at DESC, id DESC`,
            values
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo contactos admin:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener contactos"
        });
    }
}

async function getAdminContactoById(req, res) {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                ok: false,
                message: "ID inválido"
            });
        }

        const result = await pool.query(
            `SELECT
                id,
                centro,
                nombre,
                correo,
                telefono,
                destinatario,
                asunto,
                mensaje,
                estado,
                created_at,
                updated_at
             FROM contactos
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Contacto no encontrado"
            });
        }

        const item = result.rows[0];
        const permission = ensureCenterAccess(req.admin, item.centro);

        if (!permission.allowed) {
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        return res.json({
            ok: true,
            item
        });
    } catch (error) {
        console.error("Error obteniendo contacto por ID:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener contacto"
        });
    }
}

async function updateAdminContactoEstado(req, res) {
    try {
        const id = Number(req.params.id);
        const estadoNormalizado = normalizeEstado(req.body.estado);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                ok: false,
                message: "ID inválido"
            });
        }

        if (!estadoNormalizado) {
            return res.status(400).json({
                ok: false,
                message: "Estado inválido. Valores permitidos: pendiente, leido, respondido"
            });
        }

        const existing = await pool.query(
            `SELECT id, centro, estado, asunto, nombre
             FROM contactos
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Contacto no encontrado"
            });
        }

        const permission = ensureCenterAccess(req.admin, existing.rows[0].centro);

        if (!permission.allowed) {
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        const result = await pool.query(
            `UPDATE contactos
             SET estado = $1,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING
                id,
                centro,
                nombre,
                correo,
                telefono,
                destinatario,
                asunto,
                mensaje,
                estado,
                created_at,
                updated_at`,
            [estadoNormalizado, id]
        );

        await writeAuditLog(req, {
            module: "contactos",
            action: "update",
            description: `Estado de contacto actualizado: ${existing.rows[0].estado} -> ${estadoNormalizado} | ${existing.rows[0].asunto || "sin asunto"} | ${existing.rows[0].nombre || "sin nombre"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error actualizando estado del contacto:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al actualizar estado del contacto"
        });
    }
}

module.exports = {
    listAdminContactos,
    getAdminContactoById,
    updateAdminContactoEstado
};