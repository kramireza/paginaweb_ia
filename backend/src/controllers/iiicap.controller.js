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

function getTipoArchivo(filename = "", mimetype = "") {
    const ext = path.extname(filename).replace(".", "").toLowerCase();

    if (ext) return ext;
    if (mimetype === "application/pdf") return "pdf";
    if (mimetype.includes("word")) return "docx";
    if (mimetype.includes("spreadsheet") || mimetype.includes("excel")) return "xlsx";
    if (mimetype.includes("presentation") || mimetype.includes("powerpoint")) return "pptx";
    if (mimetype === "application/zip" || mimetype === "application/x-zip-compressed") return "zip";
    if (mimetype === "image/png") return "png";
    if (mimetype === "image/jpeg") return "jpg";

    return null;
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
   INFO
========================= */

async function getPublicIiicapInfo(req, res) {
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
             FROM iiicap_info
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
        console.error("Error obteniendo info pública IIICAP:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener información del instituto"
        });
    }
}

async function getAdminIiicapInfo(req, res) {
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
             FROM iiicap_info
             WHERE centro = $1
             LIMIT 1`,
            [centro]
        );

        return res.json({
            ok: true,
            item: result.rows[0] || null
        });
    } catch (error) {
        console.error("Error obteniendo info admin IIICAP:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener información del instituto"
        });
    }
}

async function saveIiicapInfo(req, res) {
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
             FROM iiicap_info
             WHERE centro = $1
             LIMIT 1`,
            [centroNormalizado]
        );

        let result;

        if (existing.rows.length > 0) {
            result = await pool.query(
                `UPDATE iiicap_info
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
                module: "iiicap",
                action: "update",
                description: `Información general IIICAP actualizada para centro ${result.rows[0].centro}`,
                target_id: result.rows[0].id
            });

            return res.json({
                ok: true,
                item: result.rows[0]
            });
        }

        result = await pool.query(
            `INSERT INTO iiicap_info
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
            module: "iiicap",
            action: "create",
            description: `Información general IIICAP creada para centro ${result.rows[0].centro}`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error guardando info IIICAP:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al guardar información del instituto"
        });
    }
}

/* =========================
   ENCARGADOS
========================= */

async function getPublicIiicapEncargados(req, res) {
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
             FROM iiicap_encargados
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
        console.error("Error obteniendo encargados públicos IIICAP:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener encargados del instituto"
        });
    }
}

async function getAdminIiicapEncargados(req, res) {
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
             FROM iiicap_encargados
             WHERE centro IN ${placeholders}
             ORDER BY centro ASC, orden_visual ASC, id ASC`,
            centers
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo encargados admin IIICAP:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener encargados del instituto"
        });
    }
}

async function createIiicapEncargado(req, res) {
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
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-encargados/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const permission = ensureCenterAccess(req.admin, centroNormalizado);
        if (!permission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-encargados/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        if (!nombre || !nombre.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-encargados/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "El nombre es obligatorio"
            });
        }

        const fotoUrl = req.file ? `/uploads/iiicap-encargados/${req.file.filename}` : null;

        const result = await pool.query(
            `INSERT INTO iiicap_encargados
             (centro, nombre, cargo, correo, telefono, descripcion, foto_url, activo, orden_visual)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
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
            module: "iiicap",
            action: "create",
            description: `Encargado IIICAP creado: ${result.rows[0].nombre || "sin nombre"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error creando encargado IIICAP:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/iiicap-encargados/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al crear encargado del instituto"
        });
    }
}

async function updateIiicapEncargado(req, res) {
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
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-encargados/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "ID inválido"
            });
        }

        const existingResult = await pool.query(
            `SELECT id, centro, foto_url, nombre
             FROM iiicap_encargados
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (existingResult.rows.length === 0) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-encargados/${req.file.filename}`);
            return res.status(404).json({
                ok: false,
                message: "Encargado no encontrado"
            });
        }

        const existing = existingResult.rows[0];
        const oldCenter = existing.centro;
        const newCenter = normalizeCentro(centro || oldCenter);

        if (!newCenter) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-encargados/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const oldPermission = ensureCenterAccess(req.admin, oldCenter);
        const newPermission = ensureCenterAccess(req.admin, newCenter);

        if (!oldPermission.allowed || !newPermission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-encargados/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: "No tienes permisos para editar este encargado"
            });
        }

        if (!nombre || !nombre.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-encargados/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "El nombre es obligatorio"
            });
        }

        let fotoUrl = existing.foto_url;

        if (req.file) {
            fotoUrl = `/uploads/iiicap-encargados/${req.file.filename}`;
        }

        const result = await pool.query(
            `UPDATE iiicap_encargados
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
            module: "iiicap",
            action: "update",
            description: `Encargado IIICAP actualizado: ${result.rows[0].nombre || existing.nombre || "sin nombre"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error actualizando encargado IIICAP:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/iiicap-encargados/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al actualizar encargado del instituto"
        });
    }
}

async function deleteIiicapEncargado(req, res) {
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
             FROM iiicap_encargados
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Encargado no encontrado"
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
            `DELETE FROM iiicap_encargados
             WHERE id = $1`,
            [id]
        );

        if (existing.rows[0].foto_url) {
            deleteUploadedFileIfExists(existing.rows[0].foto_url);
        }

        await writeAuditLog(req, {
            module: "iiicap",
            action: "delete",
            description: `Encargado IIICAP eliminado: ${existing.rows[0].nombre || "sin nombre"} (${existing.rows[0].centro})`,
            target_id: existing.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Encargado eliminado correctamente"
        });
    } catch (error) {
        console.error("Error eliminando encargado IIICAP:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al eliminar encargado del instituto"
        });
    }
}

/* =========================
   INVESTIGACIONES
========================= */

async function getPublicIiicapInvestigaciones(req, res) {
    try {
        const centro = normalizeCentro(req.query.centro);

        if (!centro) {
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const result = await pool.query(
            `SELECT id, centro, titulo, descripcion, fecha, archivo_url, archivo_nombre_original, tipo_archivo, enlace_externo, activo, orden_visual, created_at, updated_at
             FROM iiicap_investigaciones
             WHERE activo = TRUE
               AND centro = $1
             ORDER BY fecha DESC, orden_visual ASC, id DESC`,
            [centro]
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo investigaciones públicas IIICAP:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener investigaciones del instituto"
        });
    }
}

async function getAdminIiicapInvestigaciones(req, res) {
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
            `SELECT id, centro, titulo, descripcion, fecha, archivo_url, archivo_nombre_original, tipo_archivo, enlace_externo, activo, orden_visual, created_at, updated_at
             FROM iiicap_investigaciones
             WHERE centro IN ${placeholders}
             ORDER BY centro ASC, fecha DESC, orden_visual ASC, id DESC`,
            centers
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo investigaciones admin IIICAP:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener investigaciones del instituto"
        });
    }
}

async function createIiicapInvestigacion(req, res) {
    try {
        const {
            centro,
            titulo,
            descripcion,
            fecha,
            enlace_externo,
            activo,
            orden_visual
        } = req.body;

        const centroNormalizado = normalizeCentro(centro || "vs");

        if (!centroNormalizado) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-investigaciones/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const permission = ensureCenterAccess(req.admin, centroNormalizado);
        if (!permission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-investigaciones/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        if (!titulo || !titulo.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-investigaciones/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "El título es obligatorio"
            });
        }

        if (!descripcion || !descripcion.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-investigaciones/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "La descripción es obligatoria"
            });
        }

        if (!fecha) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-investigaciones/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "La fecha es obligatoria"
            });
        }

        const archivoUrl = req.file ? `/uploads/iiicap-investigaciones/${req.file.filename}` : null;
        const archivoNombreOriginal = req.file ? req.file.originalname : null;
        const tipoArchivo = req.file ? getTipoArchivo(req.file.originalname, req.file.mimetype) : null;
        const enlaceExterno = normalizeNullableText(enlace_externo);

        if (!archivoUrl && !enlaceExterno) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-investigaciones/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "Debes subir un archivo o proporcionar un enlace externo"
            });
        }

        const result = await pool.query(
            `INSERT INTO iiicap_investigaciones
             (centro, titulo, descripcion, fecha, archivo_url, archivo_nombre_original, tipo_archivo, enlace_externo, activo, orden_visual)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING id, centro, titulo, descripcion, fecha, archivo_url, archivo_nombre_original, tipo_archivo, enlace_externo, activo, orden_visual, created_at, updated_at`,
            [
                centroNormalizado,
                titulo.trim(),
                descripcion.trim(),
                fecha,
                archivoUrl,
                archivoNombreOriginal,
                tipoArchivo,
                enlaceExterno,
                activo === undefined ? true : (activo === true || activo === "true"),
                Number(orden_visual || 0)
            ]
        );

        await writeAuditLog(req, {
            module: "iiicap",
            action: "create",
            description: `Investigación IIICAP creada: ${result.rows[0].titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error creando investigación IIICAP:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/iiicap-investigaciones/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al crear investigación del instituto"
        });
    }
}

async function updateIiicapInvestigacion(req, res) {
    try {
        const id = Number(req.params.id);
        const {
            centro,
            titulo,
            descripcion,
            fecha,
            enlace_externo,
            activo,
            orden_visual
        } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-investigaciones/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "ID inválido"
            });
        }

        const existingResult = await pool.query(
            `SELECT id, centro, archivo_url, archivo_nombre_original, tipo_archivo, titulo
             FROM iiicap_investigaciones
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (existingResult.rows.length === 0) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-investigaciones/${req.file.filename}`);
            return res.status(404).json({
                ok: false,
                message: "Investigación no encontrada"
            });
        }

        const existing = existingResult.rows[0];
        const oldCenter = existing.centro;
        const newCenter = normalizeCentro(centro || oldCenter);

        if (!newCenter) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-investigaciones/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const oldPermission = ensureCenterAccess(req.admin, oldCenter);
        const newPermission = ensureCenterAccess(req.admin, newCenter);

        if (!oldPermission.allowed || !newPermission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-investigaciones/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: "No tienes permisos para editar esta investigación"
            });
        }

        if (!titulo || !titulo.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-investigaciones/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "El título es obligatorio"
            });
        }

        if (!descripcion || !descripcion.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-investigaciones/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "La descripción es obligatoria"
            });
        }

        if (!fecha) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-investigaciones/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "La fecha es obligatoria"
            });
        }

        let archivoUrl = existing.archivo_url;
        let archivoNombreOriginal = existing.archivo_nombre_original;
        let tipoArchivo = existing.tipo_archivo;

        if (req.file) {
            archivoUrl = `/uploads/iiicap-investigaciones/${req.file.filename}`;
            archivoNombreOriginal = req.file.originalname;
            tipoArchivo = getTipoArchivo(req.file.originalname, req.file.mimetype);
        }

        const enlaceExterno = normalizeNullableText(enlace_externo);

        if (!archivoUrl && !enlaceExterno) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/iiicap-investigaciones/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "La investigación debe conservar un archivo o un enlace externo"
            });
        }

        const result = await pool.query(
            `UPDATE iiicap_investigaciones
             SET centro = $1,
                 titulo = $2,
                 descripcion = $3,
                 fecha = $4,
                 archivo_url = $5,
                 archivo_nombre_original = $6,
                 tipo_archivo = $7,
                 enlace_externo = $8,
                 activo = $9,
                 orden_visual = $10,
                 updated_at = NOW()
             WHERE id = $11
             RETURNING id, centro, titulo, descripcion, fecha, archivo_url, archivo_nombre_original, tipo_archivo, enlace_externo, activo, orden_visual, created_at, updated_at`,
            [
                newCenter,
                titulo.trim(),
                descripcion.trim(),
                fecha,
                archivoUrl,
                archivoNombreOriginal,
                tipoArchivo,
                enlaceExterno,
                activo === true || activo === "true",
                Number(orden_visual || 0),
                id
            ]
        );

        if (req.file && existing.archivo_url && existing.archivo_url !== archivoUrl) {
            deleteUploadedFileIfExists(existing.archivo_url);
        }

        await writeAuditLog(req, {
            module: "iiicap",
            action: "update",
            description: `Investigación IIICAP actualizada: ${result.rows[0].titulo || existing.titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error actualizando investigación IIICAP:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/iiicap-investigaciones/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al actualizar investigación del instituto"
        });
    }
}

async function deleteIiicapInvestigacion(req, res) {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                ok: false,
                message: "ID inválido"
            });
        }

        const existing = await pool.query(
            `SELECT id, centro, archivo_url, titulo
             FROM iiicap_investigaciones
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Investigación no encontrada"
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
            `DELETE FROM iiicap_investigaciones
             WHERE id = $1`,
            [id]
        );

        if (existing.rows[0].archivo_url) {
            deleteUploadedFileIfExists(existing.rows[0].archivo_url);
        }

        await writeAuditLog(req, {
            module: "iiicap",
            action: "delete",
            description: `Investigación IIICAP eliminada: ${existing.rows[0].titulo || "sin título"} (${existing.rows[0].centro})`,
            target_id: existing.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Investigación eliminada correctamente"
        });
    } catch (error) {
        console.error("Error eliminando investigación IIICAP:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al eliminar investigación del instituto"
        });
    }
}

module.exports = {
    getPublicIiicapInfo,
    getAdminIiicapInfo,
    saveIiicapInfo,

    getPublicIiicapEncargados,
    getAdminIiicapEncargados,
    createIiicapEncargado,
    updateIiicapEncargado,
    deleteIiicapEncargado,

    getPublicIiicapInvestigaciones,
    getAdminIiicapInvestigaciones,
    createIiicapInvestigacion,
    updateIiicapInvestigacion,
    deleteIiicapInvestigacion
};