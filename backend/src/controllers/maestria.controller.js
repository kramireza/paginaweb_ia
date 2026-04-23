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
   INFO GENERAL
========================= */

async function getPublicMaestriaInfo(req, res) {
    try {
        const centro = normalizeCentro(req.query.centro);

        if (!centro) {
            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const result = await pool.query(
            `SELECT
                id,
                centro,
                titulo,
                descripcion,
                mensaje_final_titulo,
                mensaje_final_descripcion,
                activo,
                created_at,
                updated_at
             FROM maestria_info
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
        console.error("Error obteniendo información pública de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener información de maestría"
        });
    }
}

async function getAdminMaestriaInfo(req, res) {
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
            `SELECT
                id,
                centro,
                titulo,
                descripcion,
                mensaje_final_titulo,
                mensaje_final_descripcion,
                activo,
                created_at,
                updated_at
             FROM maestria_info
             WHERE centro = $1
             LIMIT 1`,
            [centro]
        );

        return res.json({
            ok: true,
            item: result.rows[0] || null
        });
    } catch (error) {
        console.error("Error obteniendo información admin de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener información de maestría"
        });
    }
}

async function saveMaestriaInfo(req, res) {
    try {
        const {
            centro,
            titulo,
            descripcion,
            mensaje_final_titulo,
            mensaje_final_descripcion,
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
                message: "La descripción principal es obligatoria"
            });
        }

        const existing = await pool.query(
            `SELECT id
             FROM maestria_info
             WHERE centro = $1
             LIMIT 1`,
            [centroNormalizado]
        );

        let result;

        if (existing.rows.length > 0) {
            result = await pool.query(
                `UPDATE maestria_info
                 SET titulo = $1,
                     descripcion = $2,
                     mensaje_final_titulo = $3,
                     mensaje_final_descripcion = $4,
                     activo = $5,
                     updated_at = NOW()
                 WHERE centro = $6
                 RETURNING
                    id,
                    centro,
                    titulo,
                    descripcion,
                    mensaje_final_titulo,
                    mensaje_final_descripcion,
                    activo,
                    created_at,
                    updated_at`,
                [
                    titulo.trim(),
                    descripcion.trim(),
                    normalizeNullableText(mensaje_final_titulo),
                    normalizeNullableText(mensaje_final_descripcion),
                    activo === undefined ? true : (activo === true || activo === "true"),
                    centroNormalizado
                ]
            );

            await writeAuditLog(req, {
                module: "maestria",
                action: "update",
                description: `Información general de maestría actualizada para centro ${result.rows[0].centro}`,
                target_id: result.rows[0].id
            });

            return res.json({
                ok: true,
                message: "Información general de maestría actualizada correctamente",
                item: result.rows[0]
            });
        }

        result = await pool.query(
            `INSERT INTO maestria_info
             (centro, titulo, descripcion, mensaje_final_titulo, mensaje_final_descripcion, activo)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING
                id,
                centro,
                titulo,
                descripcion,
                mensaje_final_titulo,
                mensaje_final_descripcion,
                activo,
                created_at,
                updated_at`,
            [
                centroNormalizado,
                titulo.trim(),
                descripcion.trim(),
                normalizeNullableText(mensaje_final_titulo),
                normalizeNullableText(mensaje_final_descripcion),
                activo === undefined ? true : (activo === true || activo === "true")
            ]
        );

        await writeAuditLog(req, {
            module: "maestria",
            action: "create",
            description: `Información general de maestría creada para centro ${result.rows[0].centro}`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            message: "Información general de maestría creada correctamente",
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error guardando información de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al guardar la información de maestría"
        });
    }
}

/* =========================
   AVISOS
========================= */

async function getPublicMaestriaAvisos(req, res) {
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
             FROM maestria_avisos
             WHERE activo = TRUE
               AND centro = $1
             ORDER BY destacado DESC, orden_visual ASC, fecha_publicacion DESC NULLS LAST, id DESC`,
            [centro]
        );

        return res.json({ ok: true, items: result.rows });
    } catch (error) {
        console.error("Error obteniendo avisos públicos de maestría:", error);
        return res.status(500).json({ ok: false, message: "Error al obtener avisos de maestría" });
    }
}

async function getAdminMaestriaAvisos(req, res) {
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
             FROM maestria_avisos
             WHERE centro IN ${placeholders}
             ORDER BY destacado DESC, orden_visual ASC, fecha_publicacion DESC NULLS LAST, id DESC`,
            centers
        );

        return res.json({ ok: true, items: result.rows });
    } catch (error) {
        console.error("Error obteniendo avisos admin de maestría:", error);
        return res.status(500).json({ ok: false, message: "Error al obtener avisos de maestría" });
    }
}

async function createMaestriaAviso(req, res) {
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
            `INSERT INTO maestria_avisos
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
            module: "maestria",
            action: "create",
            description: `Aviso de maestría creado: ${result.rows[0].titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({ ok: true, item: result.rows[0] });
    } catch (error) {
        console.error("Error creando aviso de maestría:", error);
        return res.status(500).json({ ok: false, message: "Error al crear aviso de maestría" });
    }
}

async function updateMaestriaAviso(req, res) {
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
             FROM maestria_avisos
             WHERE id = $1
             LIMIT 1`,
            [Number(id)]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ ok: false, message: "Aviso de maestría no encontrado" });
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
                message: "No tienes permisos para editar este aviso de maestría"
            });
        }

        const result = await pool.query(
            `UPDATE maestria_avisos
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
            module: "maestria",
            action: "update",
            description: `Aviso de maestría actualizado: ${result.rows[0].titulo || existing.rows[0].titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({ ok: true, item: result.rows[0] });
    } catch (error) {
        console.error("Error actualizando aviso de maestría:", error);
        return res.status(500).json({ ok: false, message: "Error al actualizar aviso de maestría" });
    }
}

async function deleteMaestriaAviso(req, res) {
    try {
        const { id } = req.params;

        const existing = await pool.query(
            `SELECT id, centro, titulo
             FROM maestria_avisos
             WHERE id = $1
             LIMIT 1`,
            [Number(id)]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ ok: false, message: "Aviso de maestría no encontrado" });
        }

        const permission = ensureCenterAccess(req.admin, existing.rows[0].centro);
        if (!permission.allowed) {
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        await pool.query(
            `DELETE FROM maestria_avisos
             WHERE id = $1`,
            [Number(id)]
        );

        await writeAuditLog(req, {
            module: "maestria",
            action: "delete",
            description: `Aviso de maestría eliminado: ${existing.rows[0].titulo || "sin título"} (${existing.rows[0].centro})`,
            target_id: existing.rows[0].id
        });

        return res.json({ ok: true, message: "Aviso de maestría eliminado" });
    } catch (error) {
        console.error("Error eliminando aviso de maestría:", error);
        return res.status(500).json({ ok: false, message: "Error al eliminar aviso de maestría" });
    }
}

/* =========================
   REGLAMENTOS
========================= */

async function getPublicMaestriaReglamentos(req, res) {
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
             FROM maestria_reglamentos
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
        console.error("Error obteniendo reglamentos públicos de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener reglamentos de maestría"
        });
    }
}

async function getAdminMaestriaReglamentos(req, res) {
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
             FROM maestria_reglamentos
             WHERE centro IN ${placeholders}
             ORDER BY orden_visual ASC, id ASC`,
            centers
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo reglamentos admin de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener reglamentos de maestría"
        });
    }
}

async function createMaestriaReglamento(req, res) {
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
            `INSERT INTO maestria_reglamentos
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
            module: "maestria",
            action: "create",
            description: `Reglamento de maestría creado: ${result.rows[0].titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error creando reglamento de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al crear reglamento de maestría"
        });
    }
}

async function updateMaestriaReglamento(req, res) {
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
             FROM maestria_reglamentos
             WHERE id = $1
             LIMIT 1`,
            [Number(id)]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Reglamento de maestría no encontrado"
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
                message: "No tienes permisos para editar este reglamento de maestría"
            });
        }

        const result = await pool.query(
            `UPDATE maestria_reglamentos
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
            module: "maestria",
            action: "update",
            description: `Reglamento de maestría actualizado: ${result.rows[0].titulo || existing.rows[0].titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error actualizando reglamento de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al actualizar reglamento de maestría"
        });
    }
}

async function deleteMaestriaReglamento(req, res) {
    try {
        const { id } = req.params;

        const existing = await pool.query(
            `SELECT id, centro, titulo
             FROM maestria_reglamentos
             WHERE id = $1
             LIMIT 1`,
            [Number(id)]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Reglamento de maestría no encontrado"
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
            `DELETE FROM maestria_reglamentos
             WHERE id = $1`,
            [Number(id)]
        );

        await writeAuditLog(req, {
            module: "maestria",
            action: "delete",
            description: `Reglamento de maestría eliminado: ${existing.rows[0].titulo || "sin título"} (${existing.rows[0].centro})`,
            target_id: existing.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Reglamento de maestría eliminado correctamente"
        });
    } catch (error) {
        console.error("Error eliminando reglamento de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al eliminar reglamento de maestría"
        });
    }
}

/* =========================
   FECHAS
========================= */

async function getPublicMaestriaFechas(req, res) {
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
             FROM maestria_fechas
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
        console.error("Error obteniendo fechas públicas de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener fechas de maestría"
        });
    }
}

async function getAdminMaestriaFechas(req, res) {
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
             FROM maestria_fechas
             WHERE centro IN ${placeholders}
             ORDER BY fecha ASC, orden_visual ASC, id ASC`,
            centers
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo fechas admin de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener fechas de maestría"
        });
    }
}

async function createMaestriaFecha(req, res) {
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

        const result = await pool.query(
            `INSERT INTO maestria_fechas
             (centro, titulo, descripcion, fecha, activo, orden_visual)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, centro, titulo, descripcion, fecha, activo, orden_visual, created_at, updated_at`,
            [
                centroNormalizado,
                titulo,
                descripcion,
                fecha,
                activo === undefined ? true : (activo === true || activo === "true"),
                Number(orden_visual || 0)
            ]
        );

        await writeAuditLog(req, {
            module: "maestria",
            action: "create",
            description: `Fecha de maestría creada: ${result.rows[0].titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error creando fecha de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al crear fecha de maestría"
        });
    }
}

async function updateMaestriaFecha(req, res) {
    try {
        const { id } = req.params;
        const {
            centro,
            titulo,
            descripcion,
            fecha,
            activo,
            orden_visual
        } = req.body;

        const existing = await pool.query(
            `SELECT id, centro, titulo
             FROM maestria_fechas
             WHERE id = $1
             LIMIT 1`,
            [Number(id)]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Fecha de maestría no encontrada"
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
                message: "No tienes permisos para editar esta fecha de maestría"
            });
        }

        const result = await pool.query(
            `UPDATE maestria_fechas
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
                titulo,
                descripcion,
                fecha,
                activo === true || activo === "true",
                Number(orden_visual || 0),
                Number(id)
            ]
        );

        await writeAuditLog(req, {
            module: "maestria",
            action: "update",
            description: `Fecha de maestría actualizada: ${result.rows[0].titulo || existing.rows[0].titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error actualizando fecha de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al actualizar fecha de maestría"
        });
    }
}

async function deleteMaestriaFecha(req, res) {
    try {
        const { id } = req.params;

        const existing = await pool.query(
            `SELECT id, centro, titulo
             FROM maestria_fechas
             WHERE id = $1
             LIMIT 1`,
            [Number(id)]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Fecha de maestría no encontrada"
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
            `DELETE FROM maestria_fechas
             WHERE id = $1`,
            [Number(id)]
        );

        await writeAuditLog(req, {
            module: "maestria",
            action: "delete",
            description: `Fecha de maestría eliminada: ${existing.rows[0].titulo || "sin título"} (${existing.rows[0].centro})`,
            target_id: existing.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Fecha de maestría eliminada correctamente"
        });
    } catch (error) {
        console.error("Error eliminando fecha de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al eliminar fecha de maestría"
        });
    }
}

/* =========================
   ENCARGADOS
========================= */

async function getPublicMaestriaEncargados(req, res) {
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
             FROM maestria_encargados
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
        console.error("Error obteniendo encargados públicos de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener encargados de maestría"
        });
    }
}

async function getAdminMaestriaEncargados(req, res) {
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
             FROM maestria_encargados
             WHERE centro IN ${placeholders}
             ORDER BY orden_visual ASC, id ASC`,
            centers
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo encargados admin de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener encargados de maestría"
        });
    }
}

async function createMaestriaEncargado(req, res) {
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
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-encargados/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const permission = ensureCenterAccess(req.admin, centroNormalizado);
        if (!permission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-encargados/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        const fotoUrl = req.file ? `/uploads/maestria-encargados/${req.file.filename}` : null;

        const result = await pool.query(
            `INSERT INTO maestria_encargados
             (centro, nombre, cargo, correo, telefono, descripcion, foto_url, activo, orden_visual)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING id, centro, nombre, cargo, correo, telefono, descripcion, foto_url, activo, orden_visual, created_at, updated_at`,
            [
                centroNormalizado,
                nombre,
                cargo || null,
                correo || null,
                telefono || null,
                descripcion || null,
                fotoUrl,
                activo === undefined ? true : (activo === true || activo === "true"),
                Number(orden_visual || 0)
            ]
        );

        await writeAuditLog(req, {
            module: "maestria",
            action: "create",
            description: `Encargado de maestría creado: ${result.rows[0].nombre || "sin nombre"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error creando encargado de maestría:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/maestria-encargados/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al crear encargado de maestría"
        });
    }
}

async function updateMaestriaEncargado(req, res) {
    try {
        const { id } = req.params;
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

        const existingResult = await pool.query(
            `SELECT id, centro, foto_url, nombre
             FROM maestria_encargados
             WHERE id = $1`,
            [Number(id)]
        );

        if (existingResult.rows.length === 0) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-encargados/${req.file.filename}`);

            return res.status(404).json({
                ok: false,
                message: "Encargado de maestría no encontrado"
            });
        }

        const existing = existingResult.rows[0];
        const newCenter = normalizeCentro(centro || existing.centro);

        if (!newCenter) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-encargados/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const oldPermission = ensureCenterAccess(req.admin, existing.centro);
        const newPermission = ensureCenterAccess(req.admin, newCenter);

        if (!oldPermission.allowed || !newPermission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-encargados/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: "No tienes permisos para editar este encargado de maestría"
            });
        }

        let fotoUrl = existing.foto_url;

        if (req.file) {
            fotoUrl = `/uploads/maestria-encargados/${req.file.filename}`;
        }

        const result = await pool.query(
            `UPDATE maestria_encargados
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
                nombre,
                cargo || null,
                correo || null,
                telefono || null,
                descripcion || null,
                fotoUrl,
                activo === true || activo === "true",
                Number(orden_visual || 0),
                Number(id)
            ]
        );

        if (req.file && existing.foto_url && existing.foto_url !== fotoUrl) {
            deleteUploadedFileIfExists(existing.foto_url);
        }

        await writeAuditLog(req, {
            module: "maestria",
            action: "update",
            description: `Encargado de maestría actualizado: ${result.rows[0].nombre || existing.nombre || "sin nombre"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error actualizando encargado de maestría:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/maestria-encargados/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al actualizar encargado de maestría"
        });
    }
}

async function deleteMaestriaEncargado(req, res) {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT id, centro, foto_url, nombre
             FROM maestria_encargados
             WHERE id = $1`,
            [Number(id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Encargado de maestría no encontrado"
            });
        }

        const permission = ensureCenterAccess(req.admin, result.rows[0].centro);
        if (!permission.allowed) {
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        await pool.query(
            `DELETE FROM maestria_encargados
             WHERE id = $1`,
            [Number(id)]
        );

        if (result.rows[0].foto_url) {
            deleteUploadedFileIfExists(result.rows[0].foto_url);
        }

        await writeAuditLog(req, {
            module: "maestria",
            action: "delete",
            description: `Encargado de maestría eliminado: ${result.rows[0].nombre || "sin nombre"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Encargado de maestría eliminado correctamente"
        });
    } catch (error) {
        console.error("Error eliminando encargado de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al eliminar encargado de maestría"
        });
    }
}

/* =========================
   RECURSOS
========================= */

async function getPublicMaestriaRecursos(req, res) {
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
             FROM maestria_recursos
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
        console.error("Error obteniendo recursos públicos de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener recursos de maestría"
        });
    }
}

async function getAdminMaestriaRecursos(req, res) {
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
            `SELECT id, centro, titulo, descripcion, archivo_url, archivo_nombre_original,
                    tipo_archivo, enlace_externo, activo, orden_visual, created_at, updated_at
             FROM maestria_recursos
             WHERE centro IN ${placeholders}
             ORDER BY centro ASC, orden_visual ASC, id ASC`,
            centers
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo recursos admin de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener recursos de maestría"
        });
    }
}

async function createMaestriaRecurso(req, res) {
    try {
        const {
            centro,
            titulo,
            descripcion,
            enlace_externo,
            activo,
            orden_visual
        } = req.body;

        const centroNormalizado = normalizeCentro(centro || "vs");

        if (!centroNormalizado) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-recursos/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const permission = ensureCenterAccess(req.admin, centroNormalizado);
        if (!permission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-recursos/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        if (!titulo || !titulo.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-recursos/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "El título es obligatorio"
            });
        }

        const enlaceExternoNormalizado = normalizeNullableText(enlace_externo);
        const archivoUrl = req.file ? `/uploads/maestria-recursos/${req.file.filename}` : null;
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
            `INSERT INTO maestria_recursos
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
            module: "maestria",
            action: "create",
            description: `Recurso de maestría creado: ${result.rows[0].titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error creando recurso de maestría:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/maestria-recursos/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al crear recurso de maestría"
        });
    }
}

async function updateMaestriaRecurso(req, res) {
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
             FROM maestria_recursos
             WHERE id = $1`,
            [Number(id)]
        );

        if (existingResult.rows.length === 0) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-recursos/${req.file.filename}`);

            return res.status(404).json({
                ok: false,
                message: "Recurso de maestría no encontrado"
            });
        }

        const existing = existingResult.rows[0];
        const newCenter = normalizeCentro(centro || existing.centro);

        if (!newCenter) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-recursos/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const oldPermission = ensureCenterAccess(req.admin, existing.centro);
        const newPermission = ensureCenterAccess(req.admin, newCenter);

        if (!oldPermission.allowed || !newPermission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-recursos/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: "No tienes permisos para editar este recurso de maestría"
            });
        }

        if (!titulo || !titulo.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-recursos/${req.file.filename}`);

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
            archivoUrl = `/uploads/maestria-recursos/${req.file.filename}`;
            archivoNombreOriginal = req.file.originalname;
            tipoArchivo = getTipoArchivo(req.file.originalname, req.file.mimetype);
        }

        if (!archivoUrl && !enlaceExternoNormalizado) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-recursos/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "El recurso debe conservar un archivo o un enlace externo"
            });
        }

        const result = await pool.query(
            `UPDATE maestria_recursos
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
            module: "maestria",
            action: "update",
            description: `Recurso de maestría actualizado: ${result.rows[0].titulo || existing.titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error actualizando recurso de maestría:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/maestria-recursos/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al actualizar recurso de maestría"
        });
    }
}

async function deleteMaestriaRecurso(req, res) {
    try {
        const { id } = req.params;

        const existing = await pool.query(
            `SELECT id, centro, archivo_url, titulo
             FROM maestria_recursos
             WHERE id = $1`,
            [Number(id)]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Recurso de maestría no encontrado"
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
            `DELETE FROM maestria_recursos
             WHERE id = $1`,
            [Number(id)]
        );

        if (existing.rows[0].archivo_url) {
            deleteUploadedFileIfExists(existing.rows[0].archivo_url);
        }

        await writeAuditLog(req, {
            module: "maestria",
            action: "delete",
            description: `Recurso de maestría eliminado: ${existing.rows[0].titulo || "sin título"} (${existing.rows[0].centro})`,
            target_id: existing.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Recurso de maestría eliminado correctamente"
        });
    } catch (error) {
        console.error("Error eliminando recurso de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al eliminar recurso de maestría"
        });
    }
}

/* =========================
   TUTORIALES
========================= */

async function getPublicMaestriaTutoriales(req, res) {
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
             FROM maestria_tutoriales
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
        console.error("Error obteniendo tutoriales públicos de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener tutoriales de maestría"
        });
    }
}

async function getAdminMaestriaTutoriales(req, res) {
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
            `SELECT id, centro, titulo, descripcion, video_url, video_nombre_original,
                    tipo_video, enlace_video, activo, orden_visual, created_at, updated_at
             FROM maestria_tutoriales
             WHERE centro IN ${placeholders}
             ORDER BY centro ASC, orden_visual ASC, id ASC`,
            centers
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo tutoriales admin de maestría:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener tutoriales de maestría"
        });
    }
}

async function createMaestriaTutorial(req, res) {
    try {
        const {
            centro,
            titulo,
            descripcion,
            enlace_video,
            activo,
            orden_visual
        } = req.body;

        const centroNormalizado = normalizeCentro(centro || "vs");

        if (!centroNormalizado) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-tutoriales/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const permission = ensureCenterAccess(req.admin, centroNormalizado);
        if (!permission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-tutoriales/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        if (!titulo || !titulo.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-tutoriales/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "El título es obligatorio"
            });
        }

        const enlaceVideoNormalizado = normalizeNullableText(enlace_video);
        const videoUrl = req.file ? `/uploads/maestria-tutoriales/${req.file.filename}` : null;
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
            `INSERT INTO maestria_tutoriales
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
            module: "maestria",
            action: "create",
            description: `Tutorial de maestría creado: ${result.rows[0].titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error creando tutorial de maestría:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/maestria-tutoriales/${req.file.filename}`);
        }

        return res.status(500).json({
            ok: false,
            message: "Error al crear tutorial de maestría"
        });
    }
}

async function updateMaestriaTutorial(req, res) {
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
             FROM maestria_tutoriales
             WHERE id = $1`,
            [Number(id)]
        );

        if (existingResult.rows.length === 0) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-tutoriales/${req.file.filename}`);

            return res.status(404).json({
                ok: false,
                message: "Tutorial de maestría no encontrado"
            });
        }

        const existing = existingResult.rows[0];
        const newCenter = normalizeCentro(centro || existing.centro);

        if (!newCenter) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-tutoriales/${req.file.filename}`);

            return res.status(400).json({
                ok: false,
                message: "Centro inválido. Valores permitidos: vs, cu, danli"
            });
        }

        const oldPermission = ensureCenterAccess(req.admin, existing.centro);
        const newPermission = ensureCenterAccess(req.admin, newCenter);

        if (!oldPermission.allowed || !newPermission.allowed) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-tutoriales/${req.file.filename}`);
            return res.status(403).json({
                ok: false,
                message: "No tienes permisos para editar este tutorial de maestría"
            });
        }

        if (!titulo || !titulo.trim()) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-tutoriales/${req.file.filename}`);

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
            videoUrl = `/uploads/maestria-tutoriales/${req.file.filename}`;
            videoNombreOriginal = req.file.originalname;
            tipoVideo = getTipoVideo(req.file.originalname, req.file.mimetype);
        }

        if (!videoUrl && !enlaceVideoNormalizado) {
            if (req.file) deleteUploadedFileIfExists(`/uploads/maestria-tutoriales/${req.file.filename}`);
            return res.status(400).json({
                ok: false,
                message: "El tutorial debe conservar un video o un enlace"
            });
        }

        const result = await pool.query(
            `UPDATE maestria_tutoriales
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
            module: "maestria",
            action: "update",
            description: `Tutorial de maestría actualizado: ${result.rows[0].titulo || existing.titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({ ok: true, item: result.rows[0] });
    } catch (error) {
        console.error("Error actualizando tutorial de maestría:", error);

        if (req.file) {
            deleteUploadedFileIfExists(`/uploads/maestria-tutoriales/${req.file.filename}`);
        }

        return res.status(500).json({ ok: false, message: "Error al actualizar tutorial de maestría" });
    }
}

async function deleteMaestriaTutorial(req, res) {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT id, centro, video_url, titulo
             FROM maestria_tutoriales
             WHERE id = $1`,
            [Number(id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, message: "Tutorial de maestría no encontrado" });
        }

        const permission = ensureCenterAccess(req.admin, result.rows[0].centro);
        if (!permission.allowed) {
            return res.status(403).json({
                ok: false,
                message: permission.message
            });
        }

        await pool.query(
            `DELETE FROM maestria_tutoriales
             WHERE id = $1`,
            [Number(id)]
        );

        if (result.rows[0].video_url) {
            deleteUploadedFileIfExists(result.rows[0].video_url);
        }

        await writeAuditLog(req, {
            module: "maestria",
            action: "delete",
            description: `Tutorial de maestría eliminado: ${result.rows[0].titulo || "sin título"} (${result.rows[0].centro})`,
            target_id: result.rows[0].id
        });

        return res.json({ ok: true, message: "Tutorial de maestría eliminado correctamente" });
    } catch (error) {
        console.error("Error eliminando tutorial de maestría:", error);
        return res.status(500).json({ ok: false, message: "Error al eliminar tutorial de maestría" });
    }
}

module.exports = {
    getPublicMaestriaInfo,
    getAdminMaestriaInfo,
    saveMaestriaInfo,

    getPublicMaestriaAvisos,
    getAdminMaestriaAvisos,
    createMaestriaAviso,
    updateMaestriaAviso,
    deleteMaestriaAviso,

    getPublicMaestriaReglamentos,
    getAdminMaestriaReglamentos,
    createMaestriaReglamento,
    updateMaestriaReglamento,
    deleteMaestriaReglamento,

    getPublicMaestriaFechas,
    getAdminMaestriaFechas,
    createMaestriaFecha,
    updateMaestriaFecha,
    deleteMaestriaFecha,

    getPublicMaestriaEncargados,
    getAdminMaestriaEncargados,
    createMaestriaEncargado,
    updateMaestriaEncargado,
    deleteMaestriaEncargado,

    getPublicMaestriaRecursos,
    getAdminMaestriaRecursos,
    createMaestriaRecurso,
    updateMaestriaRecurso,
    deleteMaestriaRecurso,

    getPublicMaestriaTutoriales,
    getAdminMaestriaTutoriales,
    createMaestriaTutorial,
    updateMaestriaTutorial,
    deleteMaestriaTutorial
};