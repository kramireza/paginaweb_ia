const fs = require("fs");
const path = require("path");
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

function deleteUploadedFileIfExists(fileUrl) {
    try {
        if (!fileUrl) return;

        const normalized = String(fileUrl).replace(/^\/+/, "");
        const absolutePath = path.join(__dirname, "..", "..", normalized);

        if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
        }
    } catch (error) {
        console.error("No se pudo eliminar archivo físico:", error);
    }
}

async function getPublicDocentes(req, res) {
    try {
        const centro = normalizeCentro(req.query.centro);

        if (!centro) {
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const result = await pool.query(
            `SELECT id, centro, nombre, cargo, correo, telefono, descripcion, foto_url, activo, orden_visual, created_at, updated_at
             FROM docentes
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
        console.error("Error obteniendo docentes públicos:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener docentes"
        });
    }
}

async function getAdminDocentes(req, res) {
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
            `SELECT id, centro, nombre, cargo, correo, telefono, descripcion, foto_url, activo, orden_visual, created_at, updated_at
             FROM docentes
             WHERE centro IN ${placeholders}
             ORDER BY centro ASC, orden_visual ASC, id ASC`,
            centers
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo docentes admin:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener docentes"
        });
    }
}

async function getDocenteById(req, res) {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                ok: false,
                message: "ID inválido"
            });
        }

        const result = await pool.query(
            `SELECT id, centro, nombre, cargo, correo, telefono, descripcion, foto_url, activo, orden_visual, created_at, updated_at
             FROM docentes
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Docente no encontrado"
            });
        }

        return res.json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error obteniendo docente por ID:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener docente"
        });
    }
}

async function createDocente(req, res) {
    try {
        const {
            centro,
            nombre,
            cargo,
            correo,
            telefono,
            descripcion,
            activo,
            orden_visual
        } = req.body;

        const centroNormalizado = normalizeCentro(centro || "vs");

        if (!centroNormalizado) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/docentes/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const permission = ensureCenterAccess(req.admin, centroNormalizado);

        if (!permission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/docentes/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        if (!nombre || !nombre.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/docentes/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "El nombre es obligatorio"
            });
        }

        const fotoUrl = req.file ? `/uploads/docentes/${req.file.filename}` : null;

        const result = await pool.query(
            `INSERT INTO docentes
             (centro, nombre, cargo, correo, telefono, descripcion, foto_url, activo, orden_visual)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, centro, nombre, cargo, correo, telefono, descripcion, foto_url, activo, orden_visual, created_at, updated_at`,
            [
                centroNormalizado,
                nombre.trim(),
                normalizeNullableText(cargo),
                normalizeNullableText(correo),
                normalizeNullableText(telefono),
                normalizeNullableText(descripcion),
                fotoUrl,
                activo === undefined ? true : (activo === true || activo === "true"),
                Number(orden_visual || 0)
            ]
        );

        await writeAuditLog(req, {
            module: "docentes",
            action: "create",
            description: `Docente creado: ${result.rows[0].nombre || "sin nombre"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error creando docente:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/docentes/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al crear docente"
        });
    }
}

async function updateDocente(req, res) {
    try {
        const id = Number(req.params.id);
        const {
            centro,
            nombre,
            cargo,
            correo,
            telefono,
            descripcion,
            activo,
            orden_visual
        } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/docentes/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "ID inválido"
            });
        }

        const existingResult = await pool.query(
            `SELECT id, centro, foto_url, nombre
             FROM docentes
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (existingResult.rows.length === 0) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/docentes/${req.file.filename}`);
            return res.status(404).json({
                ok: false,
                message: "Docente no encontrado"
            });
        }

        const existing = existingResult.rows[0];
        const oldCenter = existing.centro;
        const newCenter = normalizeCentro(centro || oldCenter);

        if (!newCenter) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/docentes/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const oldPermission = ensureCenterAccess(req.admin, oldCenter);
        const newPermission = ensureCenterAccess(req.admin, newCenter);

        if (!oldPermission.allowed || !newPermission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/docentes/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: "No tienes permisos para editar este docente"
            });
        }

        if (!nombre || !nombre.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/docentes/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "El nombre es obligatorio"
            });
        }

        let fotoUrl = existing.foto_url;

        if (req.file) {
            fotoUrl = `/uploads/docentes/${req.file.filename}`;
        }

        const result = await pool.query(
            `UPDATE docentes
             SET centro = $1,
                 nombre = $2,
                 cargo = $3,
                 correo = $4,
                 telefono = $5,
                 descripcion = $6,
                 foto_url = $7,
                 activo = $8,
                 orden_visual = $9,
                 updated_at = NOW()
             WHERE id = $10
             RETURNING id, centro, nombre, cargo, correo, telefono, descripcion, foto_url, activo, orden_visual, created_at, updated_at`,
            [
                newCenter,
                nombre.trim(),
                normalizeNullableText(cargo),
                normalizeNullableText(correo),
                normalizeNullableText(telefono),
                normalizeNullableText(descripcion),
                fotoUrl,
                activo === true || activo === "true",
                Number(orden_visual || 0),
                id
            ]
        );

        if (req.file && existing.foto_url && existing.foto_url !== fotoUrl) {
            deleteUploadedFileIfExists(existing.foto_url);
        }

        await writeAuditLog(req, {
            module: "docentes",
            action: "update",
            description: `Docente actualizado: ${result.rows[0].nombre || existing.nombre || "sin nombre"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error actualizando docente:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/docentes/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al actualizar docente"
        });
    }
}

async function deleteDocente(req, res) {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                ok: false,
                message: "ID inválido"
            });
        }

        const existing = await pool.query(
            `SELECT id, centro, foto_url, nombre
             FROM docentes
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Docente no encontrado"
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
            `DELETE FROM docentes
             WHERE id = $1`,
            [id]
        );

        if (existing.rows[0].foto_url) {
            deleteUploadedFileIfExists(existing.rows[0].foto_url);
        }

        await writeAuditLog(req, {
            module: "docentes",
            action: "delete",
            description: `Docente eliminado: ${existing.rows[0].nombre || "sin nombre"} (${existing.rows[0].centro})`,
            target_id: existing.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Docente eliminado correctamente"
        });
    } catch (error) {
        console.error("Error eliminando docente:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al eliminar docente"
        });
    }
}

module.exports = {
    getPublicDocentes,
    getAdminDocentes,
    getDocenteById,
    createDocente,
    updateDocente,
    deleteDocente
};