const pool = require("../config/db");

const CENTROS_VALIDOS = ["vs", "cu", "danli", "global"];
const PER_PAGE_ALLOWED = [10, 20, 50, 100];

function normalizeCentro(value) {
    if (value === undefined || value === null || value === "") return null;

    const centro = String(value).trim().toLowerCase();
    return CENTROS_VALIDOS.includes(centro) ? centro : null;
}

function normalizePageKey(value) {
    const pageKey = String(value || "").trim().toLowerCase();
    if (!pageKey) return null;
    return pageKey.slice(0, 120);
}

function normalizePath(value) {
    const pathValue = String(value || "").trim();
    if (!pathValue) return null;
    return pathValue.slice(0, 255);
}

function normalizeDateStart(value) {
    if (!value) return null;
    const text = String(value).trim();
    if (!text) return null;

    const date = new Date(`${text}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;

    return text;
}

function normalizeDateEnd(value) {
    if (!value) return null;
    const text = String(value).trim();
    if (!text) return null;

    const date = new Date(`${text}T23:59:59`);
    if (Number.isNaN(date.getTime())) return null;

    return text;
}

function normalizePositiveInt(value, fallback = 1) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function normalizePerPage(value) {
    const parsed = Number.parseInt(value, 10);
    if (!PER_PAGE_ALLOWED.includes(parsed)) return 10;
    return parsed;
}

function buildDateWhereClause(dateFrom, dateTo, startIndex = 1) {
    const conditions = [];
    const values = [];
    let index = startIndex;

    if (dateFrom) {
        conditions.push(`created_at >= $${index}`);
        values.push(`${dateFrom} 00:00:00`);
        index++;
    }

    if (dateTo) {
        conditions.push(`created_at <= $${index}`);
        values.push(`${dateTo} 23:59:59`);
        index++;
    }

    return {
        whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
        values,
        nextIndex: index
    };
}

function getIpAddress(req) {
    const forwardedFor = req.headers["x-forwarded-for"];

    if (forwardedFor) {
        return String(forwardedFor).split(",")[0].trim();
    }

    return (
        req.ip ||
        req.socket?.remoteAddress ||
        req.connection?.remoteAddress ||
        null
    );
}

function getUserAgent(req) {
    return req.headers["user-agent"] || null;
}

async function registerPageVisit(req, res) {
    try {
        const { page_key, centro, path } = req.body;

        const pageKey = normalizePageKey(page_key);
        const centroNormalizado = normalizeCentro(centro);
        const pathNormalizado = normalizePath(path);

        if (!pageKey) {
            return res.status(400).json({
                ok: false,
                message: "page_key es obligatorio"
            });
        }

        await pool.query(
            `INSERT INTO page_visits
             (page_key, centro, path, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                pageKey,
                centroNormalizado,
                pathNormalizado,
                getIpAddress(req),
                getUserAgent(req)
            ]
        );

        return res.status(201).json({
            ok: true,
            message: "Visita registrada correctamente"
        });
    } catch (error) {
        console.error("Error registrando visita:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al registrar visita"
        });
    }
}

async function getMetricsSummary(req, res) {
    try {
        const dateFrom = normalizeDateStart(req.query.date_from);
        const dateTo = normalizeDateEnd(req.query.date_to);

        if ((req.query.date_from && !dateFrom) || (req.query.date_to && !dateTo)) {
            return res.status(400).json({
                ok: false,
                message: "Rango de fechas inválido"
            });
        }

        const { whereClause, values } = buildDateWhereClause(dateFrom, dateTo);

        const totalResult = await pool.query(
            `SELECT COUNT(*)::int AS total_visitas
             FROM page_visits
             ${whereClause}`,
            values
        );

        const averageResult = await pool.query(
            `SELECT COALESCE(ROUND(AVG(daily_count), 2), 0) AS promedio_diario
             FROM (
                SELECT DATE(created_at) AS visit_date, COUNT(*) AS daily_count
                FROM page_visits
                ${whereClause}
                GROUP BY DATE(created_at)
             ) daily_stats`,
            values
        );

        const todayResult = await pool.query(
            `SELECT COUNT(*)::int AS visitas_hoy
             FROM page_visits
             WHERE DATE(created_at) = CURRENT_DATE`
        );

        const latestResult = await pool.query(
            `SELECT created_at
             FROM page_visits
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT 1`,
            values
        );

        return res.json({
            ok: true,
            summary: {
                total_visitas: totalResult.rows[0]?.total_visitas || 0,
                promedio_diario: Number(averageResult.rows[0]?.promedio_diario || 0),
                visitas_hoy: todayResult.rows[0]?.visitas_hoy || 0,
                ultima_visita: latestResult.rows[0]?.created_at || null,
                rango: {
                    date_from: dateFrom,
                    date_to: dateTo
                }
            }
        });
    } catch (error) {
        console.error("Error obteniendo resumen de métricas:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener resumen de métricas"
        });
    }
}

async function getVisitsByCenter(req, res) {
    try {
        const dateFrom = normalizeDateStart(req.query.date_from);
        const dateTo = normalizeDateEnd(req.query.date_to);

        if ((req.query.date_from && !dateFrom) || (req.query.date_to && !dateTo)) {
            return res.status(400).json({
                ok: false,
                message: "Rango de fechas inválido"
            });
        }

        const { whereClause, values } = buildDateWhereClause(dateFrom, dateTo);

        const result = await pool.query(
            `SELECT
                COALESCE(centro, 'sin-centro') AS centro,
                COUNT(*)::int AS total
             FROM page_visits
             ${whereClause}
             GROUP BY COALESCE(centro, 'sin-centro')
             ORDER BY total DESC, centro ASC`,
            values
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo visitas por centro:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener visitas por centro"
        });
    }
}

async function getTopPages(req, res) {
    try {
        const dateFrom = normalizeDateStart(req.query.date_from);
        const dateTo = normalizeDateEnd(req.query.date_to);

        if ((req.query.date_from && !dateFrom) || (req.query.date_to && !dateTo)) {
            return res.status(400).json({
                ok: false,
                message: "Rango de fechas inválido"
            });
        }

        const { whereClause, values } = buildDateWhereClause(dateFrom, dateTo);

        const result = await pool.query(
            `SELECT
                page_key,
                COUNT(*)::int AS total
             FROM page_visits
             ${whereClause}
             GROUP BY page_key
             ORDER BY total DESC, page_key ASC
             LIMIT 10`,
            values
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error obteniendo páginas más visitadas:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener páginas más visitadas"
        });
    }
}

async function getLatestVisits(req, res) {
    try {
        const dateFrom = normalizeDateStart(req.query.date_from);
        const dateTo = normalizeDateEnd(req.query.date_to);
        const page = normalizePositiveInt(req.query.page, 1);
        const perPage = normalizePerPage(req.query.per_page);

        if ((req.query.date_from && !dateFrom) || (req.query.date_to && !dateTo)) {
            return res.status(400).json({
                ok: false,
                message: "Rango de fechas inválido"
            });
        }

        const { whereClause, values, nextIndex } = buildDateWhereClause(dateFrom, dateTo);

        const countResult = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM page_visits
             ${whereClause}`,
            values
        );

        const total = Number(countResult.rows[0]?.total || 0);
        const totalPages = Math.max(Math.ceil(total / perPage), 1);
        const safePage = Math.min(page, totalPages);
        const offset = (safePage - 1) * perPage;

        const paginatedValues = [...values, perPage, offset];

        const result = await pool.query(
            `SELECT
                id,
                page_key,
                centro,
                path,
                ip_address,
                user_agent,
                created_at
             FROM page_visits
             ${whereClause}
             ORDER BY created_at DESC, id DESC
             LIMIT $${nextIndex}
             OFFSET $${nextIndex + 1}`,
            paginatedValues
        );

        return res.json({
            ok: true,
            items: result.rows,
            pagination: {
                total,
                page: safePage,
                per_page: perPage,
                total_pages: totalPages,
                from: total === 0 ? 0 : offset + 1,
                to: total === 0 ? 0 : Math.min(offset + result.rows.length, total)
            }
        });
    } catch (error) {
        console.error("Error obteniendo últimas visitas:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener últimas visitas"
        });
    }
}

module.exports = {
    registerPageVisit,
    getMetricsSummary,
    getVisitsByCenter,
    getTopPages,
    getLatestVisits
};