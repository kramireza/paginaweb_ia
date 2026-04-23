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

/* =========================
   JEFATURA / COORDINACIÓN
========================= */

async function getPublicJefatura(req, res) {
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
             FROM jefatura_coordinacion
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
        console.error("Error obteniendo jefatura pública:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener jefatura y coordinación"
        });
    }
}

async function getAdminJefatura(req, res) {
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
             FROM jefatura_coordinacion
             WHERE centro IN ${placeholders}
             ORDER BY centro ASC, orden_visual ASC, id ASC`,
            centers
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo jefatura admin:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener jefatura y coordinación"
        });
    }
}

async function getJefaturaById(req, res) {
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
             FROM jefatura_coordinacion
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Registro no encontrado"
            });
        }

        return res.json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error obteniendo jefatura por ID:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener registro"
        });
    }
}

async function createJefatura(req, res) {
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
            if (req.file) deleteUploadedFileIfExists(`/uploads/jefatura/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const permission = ensureCenterAccess(req.admin, centroNormalizado);

        if (!permission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/jefatura/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        if (!nombre || !nombre.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/jefatura/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "El nombre es obligatorio"
            });
        }

        if (!cargo || !cargo.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/jefatura/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "El cargo es obligatorio"
            });
        }

        const fotoUrl = req.file ? `/uploads/jefatura/${req.file.filename}` : null;

        const result = await pool.query(
            `INSERT INTO jefatura_coordinacion
             (centro, nombre, cargo, correo, telefono, descripcion, foto_url, activo, orden_visual)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING id, centro, nombre, cargo, correo, telefono, descripcion, foto_url, activo, orden_visual, created_at, updated_at`,
            [
                centroNormalizado,
                nombre.trim(),
                cargo.trim(),
                normalizeNullableText(correo),
                normalizeNullableText(telefono),
                normalizeNullableText(descripcion),
                fotoUrl,
                activo === undefined ? true : (activo === true || activo === "true"),
                Number(orden_visual || 0)
            ]
        );

        await writeAuditLog(req, {
            module: "jefatura",
            action: "create",
            description: `Registro de jefatura creado: ${result.rows[0].nombre || "sin nombre"} - ${result.rows[0].cargo || "sin cargo"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error creando jefatura:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/jefatura/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al crear registro de jefatura"
        });
    }
}

async function updateJefatura(req, res) {
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
            if (req.file) deleteUploadedFileIfExists(`/uploads/jefatura/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "ID inválido"
            });
        }

        const existingResult = await pool.query(
            `SELECT id, centro, foto_url, nombre, cargo
             FROM jefatura_coordinacion
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (existingResult.rows.length === 0) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/jefatura/${req.file.filename}`);
            return res.status(404).json({
                ok: false,
                message: "Registro no encontrado"
            });
        }

        const existing = existingResult.rows[0];
        const oldCenter = existing.centro;
        const newCenter = normalizeCentro(centro || oldCenter);

        if (!newCenter) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/jefatura/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const oldPermission = ensureCenterAccess(req.admin, oldCenter);
        const newPermission = ensureCenterAccess(req.admin, newCenter);

        if (!oldPermission.allowed || !newPermission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/jefatura/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: "No tienes permisos para editar este registro"
            });
        }

        if (!nombre || !nombre.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/jefatura/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "El nombre es obligatorio"
            });
        }

        if (!cargo || !cargo.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/jefatura/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "El cargo es obligatorio"
            });
        }

        let fotoUrl = existing.foto_url;

        if (req.file) {
            fotoUrl = `/uploads/jefatura/${req.file.filename}`;
        }

        const result = await pool.query(
            `UPDATE jefatura_coordinacion
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
                cargo.trim(),
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
            module: "jefatura",
            action: "update",
            description: `Registro de jefatura actualizado: ${result.rows[0].nombre || existing.nombre || "sin nombre"} - ${result.rows[0].cargo || existing.cargo || "sin cargo"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error actualizando jefatura:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/jefatura/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al actualizar registro de jefatura"
        });
    }
}

async function deleteJefatura(req, res) {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                ok: false,
                message: "ID inválido"
            });
        }

        const existing = await pool.query(
            `SELECT id, centro, foto_url, nombre, cargo
             FROM jefatura_coordinacion
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Registro no encontrado"
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
            `DELETE FROM jefatura_coordinacion
             WHERE id = $1`,
            [id]
        );

        if (existing.rows[0].foto_url) {
            deleteUploadedFileIfExists(existing.rows[0].foto_url);
        }

        await writeAuditLog(req, {
            module: "jefatura",
            action: "delete",
            description: `Registro de jefatura eliminado: ${existing.rows[0].nombre || "sin nombre"} - ${existing.rows[0].cargo || "sin cargo"} (${existing.rows[0].centro})`,
            target_id: existing.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Registro eliminado correctamente"
        });
    } catch (error) {
        console.error("Error eliminando jefatura:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al eliminar registro"
        });
    }
}

/* =========================
   UBICACIÓN DEL DEPARTAMENTO
========================= */

async function getPublicUbicacionDepartamento(req, res) {
    try {
        const centro = normalizeCentro(req.query.centro);

        if (!centro) {
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const result = await pool.query(
            `SELECT id, centro, titulo, descripcion, imagen_url, activo, created_at, updated_at
             FROM jefatura_ubicacion
             WHERE centro = $1
               AND activo = TRUE
             LIMIT 1`,
            [centro]
        );

        return res.json({
            ok: true,
            item: result.rows[0] || null
        });
    } catch (error) {
        console.error("Error obteniendo ubicación pública del departamento:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener ubicación del departamento"
        });
    }
}

async function getAdminUbicacionDepartamento(req, res) {
    try {
        const centro = normalizeCentro(req.query.centro);

        if (!centro) {
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const permission = ensureCenterAccess(req.admin, centro);

        if (!permission.allowed) {
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        const result = await pool.query(
            `SELECT id, centro, titulo, descripcion, imagen_url, activo, created_at, updated_at
             FROM jefatura_ubicacion
             WHERE centro = $1
             LIMIT 1`,
            [centro]
        );

        return res.json({
            ok: true,
            item: result.rows[0] || null
        });
    } catch (error) {
        console.error("Error obteniendo ubicación admin del departamento:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener ubicación del departamento"
        });
    }
}

async function saveUbicacionDepartamento(req, res) {
    try {
        const {
            centro,
            titulo,
            descripcion,
            activo
        } = req.body;

        const centroNormalizado = normalizeCentro(centro || "vs");

        if (!centroNormalizado) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/jefatura-ubicacion/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const permission = ensureCenterAccess(req.admin, centroNormalizado);

        if (!permission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/jefatura-ubicacion/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        const existingResult = await pool.query(
            `SELECT id, imagen_url
             FROM jefatura_ubicacion
             WHERE centro = $1
             LIMIT 1`,
            [centroNormalizado]
        );

        const imagenUrlNueva = req.file ? `/uploads/jefatura-ubicacion/${req.file.filename}` : null;

        let result;

        if (existingResult.rows.length > 0) {
            const existing = existingResult.rows[0];
            let finalImageUrl = existing.imagen_url;

            if (req.file) {
                finalImageUrl = imagenUrlNueva;
            }

            result = await pool.query(
                `UPDATE jefatura_ubicacion
                 SET titulo = $1,
                     descripcion = $2,
                     imagen_url = $3,
                     activo = $4,
                     updated_at = NOW()
                 WHERE centro = $5
                 RETURNING id, centro, titulo, descripcion, imagen_url, activo, created_at, updated_at`,
                [
                    titulo && titulo.trim() ? titulo.trim() : "Ubicación del departamento",
                    normalizeNullableText(descripcion),
                    finalImageUrl,
                    activo === undefined ? true : (activo === true || activo === "true"),
                    centroNormalizado
                ]
            );

            if (req.file && existing.imagen_url && existing.imagen_url !== finalImageUrl) {
                deleteUploadedFileIfExists(existing.imagen_url);
            }

            await writeAuditLog(req, {
                module: "jefatura",
                action: "update",
                description: `Ubicación del departamento actualizada para centro ${result.rows[0].centro}`,
                target_id: result.rows[0].id
            });

            return res.json({
                ok: true,
                item: result.rows[0]
            });
        }

        result = await pool.query(
            `INSERT INTO jefatura_ubicacion
             (centro, titulo, descripcion, imagen_url, activo)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, centro, titulo, descripcion, imagen_url, activo, created_at, updated_at`,
            [
                centroNormalizado,
                titulo && titulo.trim() ? titulo.trim() : "Ubicación del departamento",
                normalizeNullableText(descripcion),
                imagenUrlNueva,
                activo === undefined ? true : (activo === true || activo === "true")
            ]
        );

        await writeAuditLog(req, {
            module: "jefatura",
            action: "create",
            description: `Ubicación del departamento creada para centro ${result.rows[0].centro}`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error guardando ubicación del departamento:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/jefatura-ubicacion/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al guardar ubicación del departamento"
        });
    }
}

module.exports = {
    getPublicJefatura,
    getAdminJefatura,
    getJefaturaById,
    createJefatura,
    updateJefatura,
    deleteJefatura,
    getPublicUbicacionDepartamento,
    getAdminUbicacionDepartamento,
    saveUbicacionDepartamento
};