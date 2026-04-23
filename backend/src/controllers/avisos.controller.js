const fs = require("fs");
const path = require("path");
const pool = require("../config/db");
const {
    ensureCenterAccess,
    filterAllowedExclusiveCenters,
    filterAllowedSharedCenters
} = require("../middlewares/auth.middleware");
const { writeAuditLog } = require("../utils/audit");

const CENTROS_VALIDOS = ["vs", "cu", "danli"];
const CENTROS_COMPARTIDOS_VALIDOS = ["global", "vs", "cu", "danli"];

function normalizeCentro(value) {
    const centro = String(value || "vs").trim().toLowerCase();
    return CENTROS_VALIDOS.includes(centro) ? centro : null;
}

function normalizeCentroCompartido(value) {
    const centro = String(value || "global").trim().toLowerCase();
    return CENTROS_COMPARTIDOS_VALIDOS.includes(centro) ? centro : null;
}

function normalizeNullableText(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text : null;
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

function getTipoVideo(filename = "", mimetype = "") {
    const ext = path.extname(filename).replace(".", "").toLowerCase();

    if (ext) return ext;
    if (mimetype === "video/mp4") return "mp4";
    if (mimetype === "video/webm") return "webm";
    if (mimetype === "video/ogg") return "ogg";

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

function buildInClause(startIndex, values) {
    const placeholders = values.map((_, index) => `$${startIndex + index}`).join(", ");
    return `(${placeholders})`;
}

/* =========================
   AVISOS
========================= */

async function getPublicAvisos(req, res) {
    try {
        const centro = normalizeCentro(req.query.centro);

        if (!centro) {
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const result = await pool.query(
            `SELECT id, centro, titulo, resumen, contenido, categoria, enlace, destacado, activo,
                    fecha_publicacion, orden_visual
             FROM avisos
             WHERE activo = TRUE
               AND centro = $1
             ORDER BY destacado DESC, orden_visual ASC, fecha_publicacion DESC NULLS LAST, id DESC`,
            [centro]
        );

        res.json({ ok: true, items: result.rows });
    } catch (error) {
        console.error("Error obteniendo avisos públicos:", error);
        res.status(500).json({ ok: false, message: "Error al obtener avisos" });
    }
}

async function getAdminAvisos(req, res) {
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
            `SELECT *
             FROM avisos
             WHERE centro IN ${placeholders}
             ORDER BY destacado DESC, orden_visual ASC, fecha_publicacion DESC NULLS LAST, id DESC`,
            centers
        );

        res.json({ ok: true, items: result.rows });
    } catch (error) {
        console.error("Error obteniendo avisos admin:", error);
        res.status(500).json({ ok: false, message: "Error al obtener avisos" });
    }
}

async function createAviso(req, res) {
    try {
        const {
            centro,
            titulo,
            resumen,
            contenido,
            categoria,
            enlace,
            destacado,
            activo,
            fecha_publicacion,
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

        const result = await pool.query(
            `INSERT INTO avisos
             (centro, titulo, resumen, contenido, categoria, enlace, destacado, activo, fecha_publicacion, orden_visual)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING *`,
            [
                centroNormalizado,
                titulo,
                resumen,
                contenido || null,
                categoria || "General",
                enlace || null,
                destacado === true || destacado === "true",
                activo === undefined ? true : (activo === true || activo === "true"),
                fecha_publicacion || null,
                Number(orden_visual || 0)
            ]
        );

        await writeAuditLog(req, {
            module: "avisos",
            action: "create",
            description: `Aviso creado: ${result.rows[0].titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        res.status(201).json({ ok: true, item: result.rows[0] });
    } catch (error) {
        console.error("Error creando aviso:", error);
        res.status(500).json({ ok: false, message: "Error al crear aviso" });
    }
}

async function updateAviso(req, res) {
    try {
        const { id } = req.params;
        const {
            centro,
            titulo,
            resumen,
            contenido,
            categoria,
            enlace,
            destacado,
            activo,
            fecha_publicacion,
            orden_visual
        } = req.body;

        const existing = await pool.query(
            `SELECT id, centro, titulo
             FROM avisos
             WHERE id = $1
             LIMIT 1`,
            [Number(id)]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ ok: false, message: "Aviso no encontrado" });
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
                message: "No tienes permisos para editar este aviso"
            });
        }

        const result = await pool.query(
            `UPDATE avisos
             SET centro = $1,
                 titulo = $2,
                 resumen = $3,
                 contenido = $4,
                 categoria = $5,
                 enlace = $6,
                 destacado = $7,
                 activo = $8,
                 fecha_publicacion = $9,
                 orden_visual = $10,
                 updated_at = NOW()
             WHERE id = $11
             RETURNING *`,
            [
                newCenter,
                titulo,
                resumen,
                contenido || null,
                categoria || "General",
                enlace || null,
                destacado === true || destacado === "true",
                activo === true || activo === "true",
                fecha_publicacion || null,
                Number(orden_visual || 0),
                Number(id)
            ]
        );

        await writeAuditLog(req, {
            module: "avisos",
            action: "update",
            description: `Aviso actualizado: ${result.rows[0].titulo || existing.rows[0].titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        res.json({ ok: true, item: result.rows[0] });
    } catch (error) {
        console.error("Error actualizando aviso:", error);
        res.status(500).json({ ok: false, message: "Error al actualizar aviso" });
    }
}

async function deleteAviso(req, res) {
    try {
        const { id } = req.params;

        const existing = await pool.query(
            `SELECT id, centro, titulo
             FROM avisos
             WHERE id = $1
             LIMIT 1`,
            [Number(id)]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ ok: false, message: "Aviso no encontrado" });
        }

        const permission = ensureCenterAccess(req.admin, existing.rows[0].centro);

        if (!permission.allowed) {
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        await pool.query(
            `DELETE FROM avisos
             WHERE id = $1`,
            [Number(id)]
        );

        await writeAuditLog(req, {
            module: "avisos",
            action: "delete",
            description: `Aviso eliminado: ${existing.rows[0].titulo || "sin título"} (${existing.rows[0].centro})`,
            target_id: existing.rows[0].id
        });

        res.json({ ok: true, message: "Aviso eliminado" });
    } catch (error) {
        console.error("Error eliminando aviso:", error);
        res.status(500).json({ ok: false, message: "Error al eliminar aviso" });
    }
}

/* =========================
   REGLAMENTOS
========================= */

async function getPublicReglamentos(req, res) {
    try {
        const centro = normalizeCentro(req.query.centro);

        if (!centro) {
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const result = await pool.query(
            `SELECT id, centro, titulo, fragmento, enlace, activo, orden_visual, created_at, updated_at
             FROM reglamentos_fragmentos
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
        console.error("Error obteniendo reglamentos públicos:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener fragmentos de reglamentos"
        });
    }
}

async function getAdminReglamentos(req, res) {
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
            `SELECT id, centro, titulo, fragmento, enlace, activo, orden_visual, created_at, updated_at
             FROM reglamentos_fragmentos
             WHERE centro IN ${placeholders}
             ORDER BY orden_visual ASC, id ASC`,
            centers
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo reglamentos admin:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener fragmentos de reglamentos"
        });
    }
}

async function createReglamento(req, res) {
    try {
        const {
            centro,
            titulo,
            fragmento,
            enlace,
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

        if (!fragmento || !fragmento.trim()) {
            return res.status(400).json({
                ok: false,
                message: "El fragmento es obligatorio"
            });
        }

        const result = await pool.query(
            `INSERT INTO reglamentos_fragmentos
             (centro, titulo, fragmento, enlace, activo, orden_visual)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, centro, titulo, fragmento, enlace, activo, orden_visual, created_at, updated_at`,
            [
                centroNormalizado,
                titulo.trim(),
                fragmento.trim(),
                enlace ? enlace.trim() : null,
                activo === undefined ? true : (activo === true || activo === "true"),
                Number(orden_visual || 0)
            ]
        );

        await writeAuditLog(req, {
            module: "avisos",
            action: "create",
            description: `Reglamento creado: ${result.rows[0].titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            message: "Fragmento de reglamento creado correctamente",
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error creando reglamento:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al crear fragmento de reglamento"
        });
    }
}

async function updateReglamento(req, res) {
    try {
        const { id } = req.params;
        const {
            centro,
            titulo,
            fragmento,
            enlace,
            activo,
            orden_visual
        } = req.body;

        const existing = await pool.query(
            `SELECT id, centro, titulo
             FROM reglamentos_fragmentos
             WHERE id = $1
             LIMIT 1`,
            [Number(id)]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Fragmento de reglamento no encontrado"
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
                message: "No tienes permisos para editar este reglamento"
            });
        }

        if (!titulo || !titulo.trim()) {
            return res.status(400).json({
                ok: false,
                message: "El título es obligatorio"
            });
        }

        if (!fragmento || !fragmento.trim()) {
            return res.status(400).json({
                ok: false,
                message: "El fragmento es obligatorio"
            });
        }

        const result = await pool.query(
            `UPDATE reglamentos_fragmentos
             SET centro = $1,
                 titulo = $2,
                 fragmento = $3,
                 enlace = $4,
                 activo = $5,
                 orden_visual = $6,
                 updated_at = NOW()
             WHERE id = $7
             RETURNING id, centro, titulo, fragmento, enlace, activo, orden_visual, created_at, updated_at`,
            [
                newCenter,
                titulo.trim(),
                fragmento.trim(),
                enlace ? enlace.trim() : null,
                activo === true || activo === "true",
                Number(orden_visual || 0),
                Number(id)
            ]
        );

        await writeAuditLog(req, {
            module: "avisos",
            action: "update",
            description: `Reglamento actualizado: ${result.rows[0].titulo || existing.rows[0].titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Fragmento de reglamento actualizado correctamente",
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error actualizando reglamento:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al actualizar fragmento de reglamento"
        });
    }
}

async function deleteReglamento(req, res) {
    try {
        const { id } = req.params;

        const existing = await pool.query(
            `SELECT id, centro, titulo
             FROM reglamentos_fragmentos
             WHERE id = $1
             LIMIT 1`,
            [Number(id)]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Fragmento de reglamento no encontrado"
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
            `DELETE FROM reglamentos_fragmentos
             WHERE id = $1`,
            [Number(id)]
        );

        await writeAuditLog(req, {
            module: "avisos",
            action: "delete",
            description: `Reglamento eliminado: ${existing.rows[0].titulo || "sin título"} (${existing.rows[0].centro})`,
            target_id: existing.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Fragmento de reglamento eliminado correctamente"
        });
    } catch (error) {
        console.error("Error eliminando reglamento:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al eliminar fragmento de reglamento"
        });
    }
}

/* =========================
   RECURSOS DESCARGABLES
========================= */

async function getPublicRecursos(req, res) {
    try {
        const centro = normalizeCentro(req.query.centro);

        if (!centro) {
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const result = await pool.query(
            `SELECT id, centro, titulo, descripcion, archivo_url, archivo_nombre_original,
                    tipo_archivo, enlace_externo, activo, orden_visual, created_at, updated_at
             FROM recursos_descargables
             WHERE activo = TRUE
               AND centro IN ('global', $1)
             ORDER BY
                CASE WHEN centro = 'global' THEN 0 ELSE 1 END,
                orden_visual ASC,
                id ASC`,
            [centro]
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo recursos públicos:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener recursos descargables"
        });
    }
}

async function getAdminRecursos(req, res) {
    try {
        const access = filterAllowedSharedCenters(req.admin, req.query.centro || null);

        if (!access.ok) {
            return res.status(403).json({
                ok: false,
                message: access.message
            });
        }

        const centers = access.centers;
        const placeholders = buildInClause(1, centers);

        const result = await pool.query(
            `SELECT id, centro, titulo, descripcion, archivo_url, archivo_nombre_original,
                    tipo_archivo, enlace_externo, activo, orden_visual, created_at, updated_at
             FROM recursos_descargables
             WHERE centro IN ${placeholders}
             ORDER BY
                CASE WHEN centro = 'global' THEN 0 ELSE 1 END,
                centro ASC,
                orden_visual ASC,
                id ASC`,
            centers
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo recursos admin:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener recursos descargables"
        });
    }
}

async function createRecurso(req, res) {
    try {
        const {
            centro,
            titulo,
            descripcion,
            enlace_externo,
            activo,
            orden_visual
        } = req.body;

        const centroNormalizado = normalizeCentroCompartido(centro || "global");

        if (!centroNormalizado) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/recursos/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: global, vs, cu, danli"
            });
        }

        const permission = ensureCenterAccess(req.admin, centroNormalizado);
        if (!permission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/recursos/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        if (!titulo || !titulo.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/recursos/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "El título es obligatorio"
            });
        }

        const enlaceExternoNormalizado = normalizeNullableText(enlace_externo);
        const archivoUrl = req.file ? `/uploads/recursos/${req.file.filename}` : null;
        const archivoNombreOriginal = req.file ? req.file.originalname : null;
        const tipoArchivo = req.file ? getTipoArchivo(req.file.originalname, req.file.mimetype) : null;

        if (!archivoUrl && !enlaceExternoNormalizado) {
            if (req.file) deleteUploadedFileIfExists(archivoUrl);

            return res.status(400).json({
                ok: false,
                message: "Debes subir un archivo o proporcionar un enlace externo"
            });
        }

        const result = await pool.query(
            `INSERT INTO recursos_descargables
             (centro, titulo, descripcion, archivo_url, archivo_nombre_original, tipo_archivo, enlace_externo, activo, orden_visual)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, centro, titulo, descripcion, archivo_url, archivo_nombre_original,
                       tipo_archivo, enlace_externo, activo, orden_visual, created_at, updated_at`,
            [
                centroNormalizado,
                titulo.trim(),
                normalizeNullableText(descripcion),
                archivoUrl,
                archivoNombreOriginal,
                tipoArchivo,
                enlaceExternoNormalizado,
                activo === undefined ? true : (activo === true || activo === "true"),
                Number(orden_visual || 0)
            ]
        );

        await writeAuditLog(req, {
            module: "avisos",
            action: "create",
            description: `Recurso creado: ${result.rows[0].titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            message: "Recurso creado correctamente",
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error creando recurso:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/recursos/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al crear recurso"
        });
    }
}

async function updateRecurso(req, res) {
    try {
        const { id } = req.params;
        const {
            centro,
            titulo,
            descripcion,
            enlace_externo,
            activo,
            orden_visual
        } = req.body;

        const existingResult = await pool.query(
            `SELECT id, centro, archivo_url, archivo_nombre_original, tipo_archivo, enlace_externo, titulo
             FROM recursos_descargables
             WHERE id = $1`,
            [Number(id)]
        );

        if (existingResult.rows.length === 0) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/recursos/${req.file.filename}`);

            return res.status(404).json({
                ok: false,
                message: "Recurso no encontrado"
            });
        }

        const existing = existingResult.rows[0];
        const newCenter = normalizeCentroCompartido(centro || existing.centro);

        if (!newCenter) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/recursos/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: global, vs, cu, danli"
            });
        }

        const oldPermission = ensureCenterAccess(req.admin, existing.centro);
        const newPermission = ensureCenterAccess(req.admin, newCenter);

        if (!oldPermission.allowed || !newPermission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/recursos/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: "No tienes permisos para editar este recurso"
            });
        }

        if (!titulo || !titulo.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/recursos/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "El título es obligatorio"
            });
        }

        const enlaceExternoNormalizado = normalizeNullableText(enlace_externo);

        let archivoUrl = existing.archivo_url;
        let archivoNombreOriginal = existing.archivo_nombre_original;
        let tipoArchivo = existing.tipo_archivo;

        if (req.file) {
            archivoUrl = `/uploads/recursos/${req.file.filename}`;
            archivoNombreOriginal = req.file.originalname;
            tipoArchivo = getTipoArchivo(req.file.originalname, req.file.mimetype);
        }

        if (!archivoUrl && !enlaceExternoNormalizado) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/recursos/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "El recurso debe conservar un archivo o un enlace externo"
            });
        }

        const result = await pool.query(
            `UPDATE recursos_descargables
             SET centro = $1,
                 titulo = $2,
                 descripcion = $3,
                 archivo_url = $4,
                 archivo_nombre_original = $5,
                 tipo_archivo = $6,
                 enlace_externo = $7,
                 activo = $8,
                 orden_visual = $9,
                 updated_at = NOW()
             WHERE id = $10
             RETURNING id, centro, titulo, descripcion, archivo_url, archivo_nombre_original,
                       tipo_archivo, enlace_externo, activo, orden_visual, created_at, updated_at`,
            [
                newCenter,
                titulo.trim(),
                normalizeNullableText(descripcion),
                archivoUrl,
                archivoNombreOriginal,
                tipoArchivo,
                enlaceExternoNormalizado,
                activo === true || activo === "true",
                Number(orden_visual || 0),
                Number(id)
            ]
        );

        if (req.file && existing.archivo_url && existing.archivo_url !== archivoUrl) {
            deleteUploadedFileIfExists(existing.archivo_url);
        }

        await writeAuditLog(req, {
            module: "avisos",
            action: "update",
            description: `Recurso actualizado: ${result.rows[0].titulo || existing.titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Recurso actualizado correctamente",
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error actualizando recurso:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/recursos/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al actualizar recurso"
        });
    }
}

async function deleteRecurso(req, res) {
    try {
        const { id } = req.params;

        const existing = await pool.query(
            `SELECT id, centro, archivo_url, titulo
             FROM recursos_descargables
             WHERE id = $1`,
            [Number(id)]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Recurso no encontrado"
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
            `DELETE FROM recursos_descargables
             WHERE id = $1`,
            [Number(id)]
        );

        if (existing.rows[0].archivo_url) {
            deleteUploadedFileIfExists(existing.rows[0].archivo_url);
        }

        await writeAuditLog(req, {
            module: "avisos",
            action: "delete",
            description: `Recurso eliminado: ${existing.rows[0].titulo || "sin título"} (${existing.rows[0].centro})`,
            target_id: existing.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Recurso eliminado correctamente"
        });
    } catch (error) {
        console.error("Error eliminando recurso:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al eliminar recurso"
        });
    }
}

/* =========================
   TUTORIALES
========================= */

async function getPublicTutoriales(req, res) {
    try {
        const centro = normalizeCentro(req.query.centro);

        if (!centro) {
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const result = await pool.query(
            `SELECT id, centro, titulo, descripcion, video_url, video_nombre_original,
                    tipo_video, enlace_video, activo, orden_visual, created_at, updated_at
             FROM tutoriales
             WHERE activo = TRUE
               AND centro IN ('global', $1)
             ORDER BY
                CASE WHEN centro = 'global' THEN 0 ELSE 1 END,
                orden_visual ASC,
                id ASC`,
            [centro]
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo tutoriales públicos:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener tutoriales"
        });
    }
}

async function getAdminTutoriales(req, res) {
    try {
        const access = filterAllowedSharedCenters(req.admin, req.query.centro || null);

        if (!access.ok) {
            return res.status(403).json({
                ok: false,
                message: access.message
            });
        }

        const centers = access.centers;
        const placeholders = buildInClause(1, centers);

        const result = await pool.query(
            `SELECT id, centro, titulo, descripcion, video_url, video_nombre_original,
                    tipo_video, enlace_video, activo, orden_visual, created_at, updated_at
             FROM tutoriales
             WHERE centro IN ${placeholders}
             ORDER BY
                CASE WHEN centro = 'global' THEN 0 ELSE 1 END,
                centro ASC,
                orden_visual ASC,
                id ASC`,
            centers
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo tutoriales admin:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener tutoriales"
        });
    }
}

async function createTutorial(req, res) {
    try {
        const {
            centro,
            titulo,
            descripcion,
            enlace_video,
            activo,
            orden_visual
        } = req.body;

        const centroNormalizado = normalizeCentroCompartido(centro || "global");

        if (!centroNormalizado) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/tutoriales/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: global, vs, cu, danli"
            });
        }

        const permission = ensureCenterAccess(req.admin, centroNormalizado);
        if (!permission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/tutoriales/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        if (!titulo || !titulo.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/tutoriales/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "El título es obligatorio"
            });
        }

        const enlaceVideoNormalizado = normalizeNullableText(enlace_video);
        const videoUrl = req.file ? `/uploads/tutoriales/${req.file.filename}` : null;
        const videoNombreOriginal = req.file ? req.file.originalname : null;
        const tipoVideo = req.file ? getTipoVideo(req.file.originalname, req.file.mimetype) : null;

        if (!videoUrl && !enlaceVideoNormalizado) {
            if (req.file) deleteUploadedFileIfExists(videoUrl);

            return res.status(400).json({
                ok: false,
                message: "Debes subir un video o proporcionar un enlace embebido"
            });
        }

        const result = await pool.query(
            `INSERT INTO tutoriales
             (centro, titulo, descripcion, video_url, video_nombre_original, tipo_video, enlace_video, activo, orden_visual)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, centro, titulo, descripcion, video_url, video_nombre_original,
                       tipo_video, enlace_video, activo, orden_visual, created_at, updated_at`,
            [
                centroNormalizado,
                titulo.trim(),
                normalizeNullableText(descripcion),
                videoUrl,
                videoNombreOriginal,
                tipoVideo,
                enlaceVideoNormalizado,
                activo === undefined ? true : (activo === true || activo === "true"),
                Number(orden_visual || 0)
            ]
        );

        await writeAuditLog(req, {
            module: "avisos",
            action: "create",
            description: `Tutorial creado: ${result.rows[0].titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            message: "Tutorial creado correctamente",
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error creando tutorial:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/tutoriales/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al crear tutorial"
        });
    }
}

async function updateTutorial(req, res) {
    try {
        const { id } = req.params;
        const {
            centro,
            titulo,
            descripcion,
            enlace_video,
            activo,
            orden_visual
        } = req.body;

        const existingResult = await pool.query(
            `SELECT id, centro, video_url, video_nombre_original, tipo_video, enlace_video, titulo
             FROM tutoriales
             WHERE id = $1`,
            [Number(id)]
        );

        if (existingResult.rows.length === 0) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/tutoriales/${req.file.filename}`);

            return res.status(404).json({
                ok: false,
                message: "Tutorial no encontrado"
            });
        }

        const existing = existingResult.rows[0];
        const newCenter = normalizeCentroCompartido(centro || existing.centro);

        if (!newCenter) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/tutoriales/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: global, vs, cu, danli"
            });
        }

        const oldPermission = ensureCenterAccess(req.admin, existing.centro);
        const newPermission = ensureCenterAccess(req.admin, newCenter);

        if (!oldPermission.allowed || !newPermission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/tutoriales/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: "No tienes permisos para editar este tutorial"
            });
        }

        if (!titulo || !titulo.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/tutoriales/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "El título es obligatorio"
            });
        }

        const enlaceVideoNormalizado = normalizeNullableText(enlace_video);

        let videoUrl = existing.video_url;
        let videoNombreOriginal = existing.video_nombre_original;
        let tipoVideo = existing.tipo_video;

        if (req.file) {
            videoUrl = `/uploads/tutoriales/${req.file.filename}`;
            videoNombreOriginal = req.file.originalname;
            tipoVideo = getTipoVideo(req.file.originalname, req.file.mimetype);
        }

        if (!videoUrl && !enlaceVideoNormalizado) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/tutoriales/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "El tutorial debe conservar un video o un enlace embebido"
            });
        }

        const result = await pool.query(
            `UPDATE tutoriales
             SET centro = $1,
                 titulo = $2,
                 descripcion = $3,
                 video_url = $4,
                 video_nombre_original = $5,
                 tipo_video = $6,
                 enlace_video = $7,
                 activo = $8,
                 orden_visual = $9,
                 updated_at = NOW()
             WHERE id = $10
             RETURNING id, centro, titulo, descripcion, video_url, video_nombre_original,
                       tipo_video, enlace_video, activo, orden_visual, created_at, updated_at`,
            [
                newCenter,
                titulo.trim(),
                normalizeNullableText(descripcion),
                videoUrl,
                videoNombreOriginal,
                tipoVideo,
                enlaceVideoNormalizado,
                activo === true || activo === "true",
                Number(orden_visual || 0),
                Number(id)
            ]
        );

        if (req.file && existing.video_url && existing.video_url !== videoUrl) {
            deleteUploadedFileIfExists(existing.video_url);
        }

        await writeAuditLog(req, {
            module: "avisos",
            action: "update",
            description: `Tutorial actualizado: ${result.rows[0].titulo || existing.titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Tutorial actualizado correctamente",
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error actualizando tutorial:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/tutoriales/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al actualizar tutorial"
        });
    }
}

async function deleteTutorial(req, res) {
    try {
        const { id } = req.params;

        const existing = await pool.query(
            `SELECT id, centro, video_url, titulo
             FROM tutoriales
             WHERE id = $1`,
            [Number(id)]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Tutorial no encontrado"
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
            `DELETE FROM tutoriales
             WHERE id = $1`,
            [Number(id)]
        );

        if (existing.rows[0].video_url) {
            deleteUploadedFileIfExists(existing.rows[0].video_url);
        }

        await writeAuditLog(req, {
            module: "avisos",
            action: "delete",
            description: `Tutorial eliminado: ${existing.rows[0].titulo || "sin título"} (${existing.rows[0].centro})`,
            target_id: existing.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Tutorial eliminado correctamente"
        });
    } catch (error) {
        console.error("Error eliminando tutorial:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al eliminar tutorial"
        });
    }
}

module.exports = {
    getPublicAvisos,
    getAdminAvisos,
    createAviso,
    updateAviso,
    deleteAviso,
    getPublicReglamentos,
    getAdminReglamentos,
    createReglamento,
    updateReglamento,
    deleteReglamento,
    getPublicRecursos,
    getAdminRecursos,
    createRecurso,
    updateRecurso,
    deleteRecurso,
    getPublicTutoriales,
    getAdminTutoriales,
    createTutorial,
    updateTutorial,
    deleteTutorial
};