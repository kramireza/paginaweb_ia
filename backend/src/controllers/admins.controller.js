const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { writeAuditLog } = require("../utils/audit");

const VALID_ROLES = ["superadmin", "admin"];
const VALID_CARGOS = ["directiva", "docente"];
const VALID_CENTERS = ["vs", "cu", "danli", "global"];
const PER_PAGE_ALLOWED = [10, 20, 50, 100];

const MODULE_LABELS = {
    auth: "Autenticación",
    admins: "Administradores",
    avisos: "Avisos",
    fechas: "Fechas importantes",
    docentes: "Docentes",
    jefatura: "Jefatura y coordinación",
    autoridades: "Autoridades estudiantiles",
    comites: "Comités y grupos",
    iiicap: "IIICAP-IA",
    maestria: "Maestría",
    contactos: "Contactos",
    metrics: "Métricas"
};

const ACTION_LABELS = {
    login: "Inicio de sesión",
    logout: "Cierre de sesión",
    change_password: "Cambio de contraseña",
    create: "Crear",
    update: "Editar",
    delete: "Eliminar",
    reset_password: "Resetear contraseña"
};

function normalizeRole(value) {
    const role = String(value || "").trim().toLowerCase();
    return VALID_ROLES.includes(role) ? role : null;
}

function normalizeCargo(value) {
    const cargo = String(value || "").trim().toLowerCase();
    return VALID_CARGOS.includes(cargo) ? cargo : null;
}

function normalizeCenter(value) {
    const center = String(value || "").trim().toLowerCase();
    return VALID_CENTERS.includes(center) ? center : null;
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

function getModuleLabel(value) {
    const key = String(value || "").trim().toLowerCase();
    return MODULE_LABELS[key] || value || "Sin módulo";
}

function getActionLabel(value) {
    const key = String(value || "").trim().toLowerCase();
    return ACTION_LABELS[key] || value || "Sin acción";
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

function formatDateForFilename() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${y}${m}${d}-${hh}${mm}`;
}

function buildAuditLogsWhereClause(query = {}, startIndex = 1) {
    const conditions = [];
    const values = [];
    let paramIndex = startIndex;

    const module = query.module && String(query.module).trim()
        ? String(query.module).trim().toLowerCase()
        : "";

    const action = query.action && String(query.action).trim()
        ? String(query.action).trim().toLowerCase()
        : "";

    const username = query.username && String(query.username).trim()
        ? String(query.username).trim().toLowerCase()
        : "";

    const dateFrom = query.date_from && String(query.date_from).trim()
        ? String(query.date_from).trim()
        : "";

    const dateTo = query.date_to && String(query.date_to).trim()
        ? String(query.date_to).trim()
        : "";

    if (module) {
        conditions.push(`module = $${paramIndex}`);
        values.push(module);
        paramIndex++;
    }

    if (action) {
        conditions.push(`action = $${paramIndex}`);
        values.push(action);
        paramIndex++;
    }

    if (username) {
        conditions.push(`LOWER(username) = $${paramIndex}`);
        values.push(username);
        paramIndex++;
    }

    if (dateFrom) {
        conditions.push(`created_at >= $${paramIndex}`);
        values.push(dateFrom);
        paramIndex++;
    }

    if (dateTo) {
        conditions.push(`created_at <= $${paramIndex}`);
        values.push(dateTo);
        paramIndex++;
    }

    const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    return {
        whereClause,
        values,
        nextIndex: paramIndex
    };
}

async function fetchAuditLogs(query = {}, options = {}) {
    const exportMode = options.exportMode === true;
    const page = normalizePositiveInt(query.page, 1);
    const perPage = normalizePerPage(query.per_page);

    const { whereClause, values, nextIndex } = buildAuditLogsWhereClause(query);

    const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM audit_logs
         ${whereClause}`,
        values
    );

    const total = Number(countResult.rows[0]?.total || 0);

    if (exportMode) {
        const result = await pool.query(
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
            items: result.rows,
            total,
            pagination: null
        };
    }

    const totalPages = Math.max(Math.ceil(total / perPage), 1);
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * perPage;

    const paginatedValues = [...values, perPage, offset];

    const result = await pool.query(
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
        items: result.rows,
        total,
        pagination: {
            total,
            page: safePage,
            per_page: perPage,
            total_pages: totalPages,
            from: total === 0 ? 0 : offset + 1,
            to: total === 0 ? 0 : Math.min(offset + result.rows.length, total)
        }
    };
}

async function listAdmins(req, res) {
    try {
        const result = await pool.query(
            `SELECT
                id,
                username,
                full_name,
                role,
                cargo,
                assigned_center,
                must_change_password,
                is_active,
                created_by_admin_id,
                created_at,
                updated_at,
                last_login_at
             FROM admins
             ORDER BY created_at DESC, id DESC`
        );

        return res.json({
            ok: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Error listando admins:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener admins"
        });
    }
}

async function createAdmin(req, res) {
    try {
        const {
            full_name,
            username,
            temporary_password,
            cargo,
            assigned_center,
            role
        } = req.body;

        if (!full_name || !full_name.trim()) {
            return res.status(400).json({
                ok: false,
                message: "El nombre completo es obligatorio"
            });
        }

        if (!username || !username.trim()) {
            return res.status(400).json({
                ok: false,
                message: "El usuario es obligatorio"
            });
        }

        if (!temporary_password || temporary_password.length < 8) {
            return res.status(400).json({
                ok: false,
                message: "La contraseña temporal debe tener al menos 8 caracteres"
            });
        }

        const roleNormalized = normalizeRole(role || "admin");
        const cargoNormalized = normalizeCargo(cargo);
        const centerNormalized = normalizeCenter(assigned_center);

        if (!roleNormalized) {
            return res.status(400).json({
                ok: false,
                message: "Rol inválido"
            });
        }

        if (!cargoNormalized) {
            return res.status(400).json({
                ok: false,
                message: "Cargo inválido"
            });
        }

        if (!centerNormalized) {
            return res.status(400).json({
                ok: false,
                message: "Centro asignado inválido"
            });
        }

        const exists = await pool.query(
            `SELECT id
             FROM admins
             WHERE username = $1
             LIMIT 1`,
            [username.trim()]
        );

        if (exists.rows.length > 0) {
            return res.status(400).json({
                ok: false,
                message: "Ya existe un admin con ese usuario"
            });
        }

        const hash = await bcrypt.hash(temporary_password, 10);

        const result = await pool.query(
            `INSERT INTO admins
             (
                username,
                password_hash,
                full_name,
                role,
                cargo,
                assigned_center,
                must_change_password,
                is_active,
                created_by_admin_id
             )
             VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE, $7)
             RETURNING
                id,
                username,
                full_name,
                role,
                cargo,
                assigned_center,
                must_change_password,
                is_active,
                created_by_admin_id,
                created_at,
                updated_at,
                last_login_at`,
            [
                username.trim(),
                hash,
                full_name.trim(),
                roleNormalized,
                cargoNormalized,
                centerNormalized,
                req.admin.id
            ]
        );

        await writeAuditLog(req, {
            module: "admins",
            action: "create",
            description: `Admin creado: ${result.rows[0].username}`,
            target_id: result.rows[0].id
        });

        return res.status(201).json({
            ok: true,
            message: "Admin creado correctamente",
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error creando admin:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al crear admin"
        });
    }
}

async function resetAdminPassword(req, res) {
    try {
        const id = Number(req.params.id);
        const { temporary_password } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                ok: false,
                message: "ID inválido"
            });
        }

        if (!temporary_password || temporary_password.length < 8) {
            return res.status(400).json({
                ok: false,
                message: "La contraseña temporal debe tener al menos 8 caracteres"
            });
        }

        if (req.admin.id === id) {
            return res.status(400).json({
                ok: false,
                message: "No puedes resetear tu propia contraseña desde este módulo"
            });
        }

        const hash = await bcrypt.hash(temporary_password, 10);

        const result = await pool.query(
            `UPDATE admins
             SET password_hash = $1,
                 must_change_password = TRUE,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING
                id,
                username,
                full_name,
                role,
                cargo,
                assigned_center,
                must_change_password,
                is_active,
                created_by_admin_id,
                created_at,
                updated_at,
                last_login_at`,
            [hash, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Admin no encontrado"
            });
        }

        await writeAuditLog(req, {
            module: "admins",
            action: "reset_password",
            description: `Contraseña reseteada para admin: ${result.rows[0].username}`,
            target_id: result.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Contraseña reseteada correctamente",
            item: result.rows[0]
        });
    } catch (error) {
        console.error("Error reseteando contraseña:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al resetear contraseña"
        });
    }
}

async function deleteAdmin(req, res) {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                ok: false,
                message: "ID inválido"
            });
        }

        if (req.admin.id === id) {
            return res.status(400).json({
                ok: false,
                message: "No puedes eliminar tu propio usuario"
            });
        }

        const result = await pool.query(
            `DELETE FROM admins
             WHERE id = $1
             RETURNING id, username`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Admin no encontrado"
            });
        }

        await writeAuditLog(req, {
            module: "admins",
            action: "delete",
            description: `Admin eliminado: ${result.rows[0].username}`,
            target_id: result.rows[0].id
        });

        return res.json({
            ok: true,
            message: "Admin eliminado correctamente"
        });
    } catch (error) {
        console.error("Error eliminando admin:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al eliminar admin"
        });
    }
}

async function listAuditLogs(req, res) {
    try {
        const result = await fetchAuditLogs(req.query, { exportMode: false });

        return res.json({
            ok: true,
            items: result.items,
            pagination: result.pagination
        });
    } catch (error) {
        console.error("Error listando audit logs:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener logs"
        });
    }
}

async function exportAuditLogsExcel(req, res) {
    try {
        const result = await fetchAuditLogs(req.query, { exportMode: true });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Logs");

        worksheet.columns = [
            { header: "ID Log", key: "id", width: 12 },
            { header: "Admin ID", key: "admin_id", width: 12 },
            { header: "Usuario", key: "username", width: 22 },
            { header: "Rol", key: "role", width: 18 },
            { header: "Módulo", key: "module", width: 24 },
            { header: "Acción", key: "action", width: 24 },
            { header: "Descripción", key: "description", width: 42 },
            { header: "Target ID", key: "target_id", width: 12 },
            { header: "IP", key: "ip_address", width: 18 },
            { header: "User-Agent", key: "user_agent", width: 55 },
            { header: "Fecha", key: "created_at", width: 24 }
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
        worksheet.views = [{ state: "frozen", ySplit: 1 }];

        result.items.forEach(item => {
            worksheet.addRow({
                id: item.id ?? "",
                admin_id: item.admin_id ?? "",
                username: item.username ?? "",
                role: item.role ?? "",
                module: getModuleLabel(item.module),
                action: getActionLabel(item.action),
                description: item.description ?? "",
                target_id: item.target_id ?? "",
                ip_address: item.ip_address ?? "",
                user_agent: item.user_agent ?? "",
                created_at: formatDateTime(item.created_at)
            });
        });

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

async function exportAuditLogsPdf(req, res) {
    try {
        const result = await fetchAuditLogs(req.query, { exportMode: true });
        const fileName = `logs-${formatDateForFilename()}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

        const doc = new PDFDocument({
            margin: 40,
            size: "A4"
        });

        doc.pipe(res);

        doc.fontSize(18).text("Logs del sistema", { align: "center" });
        doc.moveDown(0.4);
        doc.fontSize(10).fillColor("#555").text(`Generado: ${formatDateTime(new Date())}`, { align: "center" });
        doc.moveDown(0.8);

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

            doc.fontSize(11).fillColor("#002856").text(
                `${getModuleLabel(item.module)} · ${getActionLabel(item.action)}`
            );
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
    listAdmins,
    createAdmin,
    resetAdminPassword,
    deleteAdmin,
    listAuditLogs,
    exportAuditLogsExcel,
    exportAuditLogsPdf
};