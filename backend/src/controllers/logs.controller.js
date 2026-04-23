const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const pool = require("../config/db");

const PER_PAGE_ALLOWED = [10, 20, 50, 100];

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

function normalizeText(value) {
    if (value === undefined || value === null) return "";
    return String(value).trim();
}

function formatDateForFilename() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${y}${m}${d}-${hh}${mm}`;
}

function buildLogsWhereClause(query = {}, startIndex = 1) {
    const conditions = [];
    const values = [];
    let index = startIndex;

    const moduleValue = normalizeText(query.module);
    const actionValue = normalizeText(query.action);
    const usernameValue = normalizeText(query.username);
    const dateFromValue = normalizeText(query.date_from);
    const dateToValue = normalizeText(query.date_to);

    if (moduleValue) {
        conditions.push(`module = $${index}`);
        values.push(moduleValue);
        index++;
    }

    if (actionValue) {
        conditions.push(`action = $${index}`);
        values.push(actionValue);
        index++;
    }

    if (usernameValue) {
        conditions.push(`username ILIKE $${index}`);
        values.push(`%${usernameValue}%`);
        index++;
    }

    if (dateFromValue) {
        conditions.push(`created_at >= $${index}`);
        values.push(dateFromValue);
        index++;
    }

    if (dateToValue) {
        conditions.push(`created_at <= $${index}`);
        values.push(dateToValue);
        index++;
    }

    return {
        whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
        values,
        nextIndex: index
    };
}

function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString("es-HN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

async function fetchLogs(query = {}, options = {}) {
    const exportMode = options.exportMode === true;
    const page = normalizePositiveInt(query.page, 1);
    const perPage = normalizePerPage(query.per_page);

    const { whereClause, values, nextIndex } = buildLogsWhereClause(query);

    const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM audit_logs
         ${whereClause}`,
        values
    );

    const total = Number(countResult.rows[0]?.total || 0);

    if (exportMode) {
        const rowsResult = await pool.query(
            `SELECT
                id,
                admin_id,
                username,
                role,
                module,
                action,
                description,
                target_id,
                ip_address,
                user_agent,
                created_at
             FROM audit_logs
             ${whereClause}
             ORDER BY created_at DESC, id DESC`,
            values
        );

        return {
            items: rowsResult.rows,
            total,
            pagination: null
        };
    }

    const totalPages = Math.max(Math.ceil(total / perPage), 1);
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * perPage;

    const paginatedValues = [...values, perPage, offset];

    const rowsResult = await pool.query(
        `SELECT
            id,
            admin_id,
            username,
            role,
            module,
            action,
            description,
            target_id,
            ip_address,
            user_agent,
            created_at
         FROM audit_logs
         ${whereClause}
         ORDER BY created_at DESC, id DESC
         LIMIT $${nextIndex}
         OFFSET $${nextIndex + 1}`,
        paginatedValues
    );

    return {
        items: rowsResult.rows,
        total,
        pagination: {
            total,
            page: safePage,
            per_page: perPage,
            total_pages: totalPages,
            from: total === 0 ? 0 : offset + 1,
            to: total === 0 ? 0 : Math.min(offset + rowsResult.rows.length, total)
        }
    };
}

async function listLogs(req, res) {
    try {
        const result = await fetchLogs(req.query, { exportMode: false });

        return res.json({
            ok: true,
            items: result.items,
            pagination: result.pagination
        });
    } catch (error) {
        console.error("Error listando logs:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener logs"
        });
    }
}

async function exportLogsExcel(req, res) {
    try {
        const result = await fetchLogs(req.query, { exportMode: true });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Logs");

        worksheet.columns = [
            { header: "ID Log", key: "id", width: 12 },
            { header: "Admin ID", key: "admin_id", width: 12 },
            { header: "Usuario", key: "username", width: 22 },
            { header: "Rol", key: "role", width: 18 },
            { header: "Módulo", key: "module", width: 18 },
            { header: "Acción", key: "action", width: 18 },
            { header: "Descripción", key: "description", width: 40 },
            { header: "Target ID", key: "target_id", width: 12 },
            { header: "IP", key: "ip_address", width: 18 },
            { header: "User-Agent", key: "user_agent", width: 55 },
            { header: "Fecha", key: "created_at", width: 24 }
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

        result.items.forEach(item => {
            worksheet.addRow({
                id: item.id ?? "",
                admin_id: item.admin_id ?? "",
                username: item.username ?? "",
                role: item.role ?? "",
                module: item.module ?? "",
                action: item.action ?? "",
                description: item.description ?? "",
                target_id: item.target_id ?? "",
                ip_address: item.ip_address ?? "",
                user_agent: item.user_agent ?? "",
                created_at: formatDateTime(item.created_at)
            });
        });

        worksheet.views = [{ state: "frozen", ySplit: 1 }];

        const fileName = `logs-${formatDateForFilename()}.xlsx`;

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Error exportando logs a Excel:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al exportar logs a Excel"
        });
    }
}

async function exportLogsPdf(req, res) {
    try {
        const result = await fetchLogs(req.query, { exportMode: true });
        const fileName = `logs-${formatDateForFilename()}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

        const doc = new PDFDocument({
            margin: 40,
            size: "A4"
        });

        doc.pipe(res);

        doc.fontSize(18).text("Logs del sistema", { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor("#555").text(`Generado: ${formatDateTime(new Date())}`, { align: "center" });
        doc.moveDown(1);

        doc.fillColor("#000");
        doc.fontSize(11).text(`Total exportado: ${result.total}`);
        doc.moveDown(0.8);

        result.items.forEach((item, index) => {
            if (index > 0) {
                doc.moveDown(0.5);
                doc.strokeColor("#d9e7f7")
                    .lineWidth(1)
                    .moveTo(doc.page.margins.left, doc.y)
                    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
                    .stroke();
                doc.moveDown(0.5);
            }

            doc.fontSize(11).fillColor("#002856").text(`${item.module || "sin módulo"} · ${item.action || "sin acción"}`, {
                continued: false
            });

            doc.moveDown(0.2);
            doc.fillColor("#000");
            doc.fontSize(10).text(`Usuario: ${item.username || "Usuario desconocido"}`);
            doc.text(`Rol: ${item.role || "sin rol"}`);
            doc.text(`Fecha: ${formatDateTime(item.created_at)}`);
            doc.text(`Admin ID: ${item.admin_id ?? "N/A"} | Target ID: ${item.target_id ?? "N/A"}`);
            doc.text(`IP: ${item.ip_address || "No disponible"}`);
            doc.text(`Descripción: ${item.description || "Sin descripción"}`);
            doc.text(`User-Agent: ${item.user_agent || "No disponible"}`, {
                width: doc.page.width - doc.page.margins.left - doc.page.margins.right
            });

            if (doc.y > 700) {
                doc.addPage();
            }
        });

        doc.end();
    } catch (error) {
        console.error("Error exportando logs a PDF:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al exportar logs a PDF"
        });
    }
}

module.exports = {
    listLogs,
    exportLogsExcel,
    exportLogsPdf
};