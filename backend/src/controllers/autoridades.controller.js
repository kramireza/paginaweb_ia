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

async function getPublicAutoridades(req, res) {
    try {
        const centro = normalizeCentro(req.query.centro);

        if (!centro) {
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const result = await pool.query(
            `SELECT id, centro, nombre, cargo, periodo, correo, telefono, descripcion, foto_url, activo, orden_visual, created_at, updated_at
             FROM autoridades_estudiantiles
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
        console.error("Error obteniendo autoridades públicas:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener autoridades estudiantiles"
        });
    }
}

async function getAdminAutoridades(req, res) {
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
            `SELECT id, centro, nombre, cargo, periodo, correo, telefono, descripcion, foto_url, activo, orden_visual, created_at, updated_at
             FROM autoridades_estudiantiles
             WHERE centro IN ${placeholders}
             ORDER BY centro ASC, orden_visual ASC, id ASC`,
            centers
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo autoridades admin:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener autoridades estudiantiles"
        });
    }
}

async function getAutoridadById(req, res) {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                ok: false,
                message: "ID inválido"
            });
        }

        const result = await pool.query(
            `SELECT id, centro, nombre, cargo, periodo, correo, telefono, descripcion, foto_url, activo, orden_visual, created_at, updated_at
             FROM autoridades_estudiantiles
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Autoridad no encontrada"
            });
        }

        return res.json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error obteniendo autoridad por ID:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener autoridad"
        });
    }
}

async function createAutoridad(req, res) {
    try {
        const {
            centro,
            nombre,
            cargo,
            periodo,
            correo,
            telefono,
            descripcion,
            activo,
            orden_visual
        } = req.body;

        const centroNormalizado = normalizeCentro(centro || "vs");

        if (!centroNormalizado) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/autoridades/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const permission = ensureCenterAccess(req.admin, centroNormalizado);
        if (!permission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/autoridades/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        if (!nombre || !nombre.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/autoridades/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "El nombre es obligatorio"
            });
        }

        if (!cargo || !cargo.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/autoridades/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "El cargo es obligatorio"
            });
        }

        const fotoUrl = req.file ? `/uploads/autoridades/${req.file.filename}` : null;

        const result = await pool.query(
            `INSERT INTO autoridades_estudiantiles
             (centro, nombre, cargo, periodo, correo, telefono, descripcion, foto_url, activo, orden_visual)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING id, centro, nombre, cargo, periodo, correo, telefono, descripcion, foto_url, activo, orden_visual, created_at, updated_at`,
            [
                centroNormalizado,
                nombre.trim(),
                cargo.trim(),
                normalizeNullableText(periodo),
                normalizeNullableText(correo),
                normalizeNullableText(telefono),
                normalizeNullableText(descripcion),
                fotoUrl,
                activo === undefined ? true : (activo === true || activo === "true"),
                Number(orden_visual || 0)
            ]
        );

        await writeAuditLog(req, {
            module: "autoridades",
            action: "create",
            description: `Autoridad creada: ${result.rows[0].nombre || "sin nombre"} - ${result.rows[0].cargo || "sin cargo"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error creando autoridad:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/autoridades/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al crear autoridad"
        });
    }
}

async function updateAutoridad(req, res) {
    try {
        const id = Number(req.params.id);
        const {
            centro,
            nombre,
            cargo,
            periodo,
            correo,
            telefono,
            descripcion,
            activo,
            orden_visual
        } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/autoridades/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "ID inválido"
            });
        }

        const existingResult = await pool.query(
            `SELECT id, centro, foto_url, nombre, cargo
             FROM autoridades_estudiantiles
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (existingResult.rows.length === 0) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/autoridades/${req.file.filename}`);
            return res.status(404).json({
                ok: false,
                message: "Autoridad no encontrada"
            });
        }

        const existing = existingResult.rows[0];
        const oldCenter = existing.centro;
        const newCenter = normalizeCentro(centro || oldCenter);

        if (!newCenter) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/autoridades/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const oldPermission = ensureCenterAccess(req.admin, oldCenter);
        const newPermission = ensureCenterAccess(req.admin, newCenter);

        if (!oldPermission.allowed || !newPermission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/autoridades/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: "No tienes permisos para editar esta autoridad"
            });
        }

        if (!nombre || !nombre.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/autoridades/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "El nombre es obligatorio"
            });
        }

        if (!cargo || !cargo.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/autoridades/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "El cargo es obligatorio"
            });
        }

        let fotoUrl = existing.foto_url;

        if (req.file) {
            fotoUrl = `/uploads/autoridades/${req.file.filename}`;
        }

        const result = await pool.query(
            `UPDATE autoridades_estudiantiles
             SET centro = $1,
                 nombre = $2,
                 cargo = $3,
                 periodo = $4,
                 correo = $5,
                 telefono = $6,
                 descripcion = $7,
                 foto_url = $8,
                 activo = $9,
                 orden_visual = $10,
                 updated_at = NOW()
             WHERE id = $11
             RETURNING id, centro, nombre, cargo, periodo, correo, telefono, descripcion, foto_url, activo, orden_visual, created_at, updated_at`,
            [
                newCenter,
                nombre.trim(),
                cargo.trim(),
                normalizeNullableText(periodo),
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
            module: "autoridades",
            action: "update",
            description: `Autoridad actualizada: ${result.rows[0].nombre || existing.nombre || "sin nombre"} - ${result.rows[0].cargo || existing.cargo || "sin cargo"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error actualizando autoridad:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/autoridades/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al actualizar autoridad"
        });
    }
}

async function deleteAutoridad(req, res) {
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
             FROM autoridades_estudiantiles
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Autoridad no encontrada"
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
            `DELETE FROM autoridades_estudiantiles
             WHERE id = $1`,
            [id]
        );

        if (existing.rows[0].foto_url) {
            deleteUploadedFileIfExists(existing.rows[0].foto_url);
        }

        await writeAuditLog(req, {
            module: "autoridades",
            action: "delete",
            description: `Autoridad eliminada: ${existing.rows[0].nombre || "sin nombre"} - ${existing.rows[0].cargo || "sin cargo"} (${existing.rows[0].centro})`,
            target_id: existing.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Autoridad eliminada correctamente"
        });
    } catch (error) {
        console.error("Error eliminando autoridad:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al eliminar autoridad"
        });
    }
}

async function getPublicAutoridadesInfo(req, res) {
    try {
        const centro = normalizeCentro(req.query.centro);

        if (!centro) {
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const result = await pool.query(
            `SELECT id, centro, titulo, descripcion, activo, created_at, updated_at
             FROM autoridades_info
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
        console.error("Error obteniendo info pública de autoridades:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener información general de autoridades"
        });
    }
}

async function getAdminAutoridadesInfo(req, res) {
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
            `SELECT id, centro, titulo, descripcion, activo, created_at, updated_at
             FROM autoridades_info
             WHERE centro = $1
             LIMIT 1`,
            [centro]
        );

        return res.json({
            ok: true,
            item: result.rows[0] || null
        });
    } catch (error) {
        console.error("Error obteniendo info admin de autoridades:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener información general de autoridades"
        });
    }
}

async function saveAutoridadesInfo(req, res) {
    try {
        const {
            centro,
            titulo,
            descripcion,
            activo
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

        const existing = await pool.query(
            `SELECT id
             FROM autoridades_info
             WHERE centro = $1
             LIMIT 1`,
            [centroNormalizado]
        );

        let result;

        if (existing.rows.length > 0) {
            result = await pool.query(
                `UPDATE autoridades_info
                 SET titulo = $1,
                     descripcion = $2,
                     activo = $3,
                     updated_at = NOW()
                 WHERE centro = $4
                 RETURNING id, centro, titulo, descripcion, activo, created_at, updated_at`,
                [
                    titulo.trim(),
                    descripcion.trim(),
                    activo === undefined ? true : (activo === true || activo === "true"),
                    centroNormalizado
                ]
            );

            await writeAuditLog(req, {
                module: "autoridades",
                action: "update",
                description: `Información general de autoridades actualizada para centro ${result.rows[0].centro}`,
                target_id: result.rows[0].id
            });

            return res.json({
                ok: true,
                item: result.rows[0]
            });
        }

        result = await pool.query(
            `INSERT INTO autoridades_info
             (centro, titulo, descripcion, activo)
             VALUES ($1, $2, $3, $4)
             RETURNING id, centro, titulo, descripcion, activo, created_at, updated_at`,
            [
                centroNormalizado,
                titulo.trim(),
                descripcion.trim(),
                activo === undefined ? true : (activo === true || activo === "true")
            ]
        );

        await writeAuditLog(req, {
            module: "autoridades",
            action: "create",
            description: `Información general de autoridades creada para centro ${result.rows[0].centro}`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error guardando info de autoridades:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al guardar información general de autoridades"
        });
    }
}

module.exports = {
    getPublicAutoridades,
    getAdminAutoridades,
    getAutoridadById,
    createAutoridad,
    updateAutoridad,
    deleteAutoridad,
    getPublicAutoridadesInfo,
    getAdminAutoridadesInfo,
    saveAutoridadesInfo
};