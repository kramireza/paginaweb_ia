const API = `${window.location.origin}/informatica-api`.replace(/\/+$/, "");
const token = localStorage.getItem("token");
const adminUserRaw = localStorage.getItem("adminUser");

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

const form = document.getElementById("logs-filter-form");
const logsList = document.getElementById("logs-list");
const statusBox = document.getElementById("logs-status");
const summaryBox = document.getElementById("logs-summary");
const resetFiltersBtn = document.getElementById("reset-filters-btn");
const reloadLogsBtn = document.getElementById("reload-logs-btn");
const logoutBtn = document.getElementById("logout-btn");
const exportExcelBtn = document.getElementById("export-excel-btn");
const exportPdfBtn = document.getElementById("export-pdf-btn");
const prevPageBtn = document.getElementById("logs-prev-page-btn");
const nextPageBtn = document.getElementById("logs-next-page-btn");
const pageIndicator = document.getElementById("logs-page-indicator");
const paginationSummary = document.getElementById("logs-pagination-summary");
const perPageSelect = document.getElementById("filter-per-page");
const usernameSelect = document.getElementById("filter-username");

let adminUser = null;
let currentPage = 1;
let totalPages = 1;

try {
    adminUser = adminUserRaw ? JSON.parse(adminUserRaw) : null;
} catch (error) {
    adminUser = null;
}

if (!token || !adminUser) {
    window.location.href = "./login.html";
}

if (adminUser.mustChangePassword === true) {
    window.location.href = "./change-password.html";
}

if (String(adminUser.role || "").toLowerCase() !== "superadmin") {
    window.location.href = "./dashboard.html";
}

function showStatus(message, type = "info") {
    statusBox.textContent = message;
    statusBox.className = `admin-status show ${type}`;
}

function clearStatus() {
    statusBox.textContent = "";
    statusBox.className = "admin-status";
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDateTime(value) {
    if (!value) return "Sin fecha";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("es-HN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

function getActionBadgeClass(action) {
    const normalized = String(action || "").toLowerCase();

    if (normalized === "login" || normalized === "create") return "active";
    if (normalized === "delete") return "inactive";
    if (normalized === "reset_password" || normalized === "change_password") return "pending";

    return "";
}

function getModuleLabel(module) {
    const key = String(module || "").trim().toLowerCase();
    return MODULE_LABELS[key] || module || "Sin módulo";
}

function getActionLabel(action) {
    const key = String(action || "").trim().toLowerCase();
    return ACTION_LABELS[key] || action || "Sin acción";
}

function getAuthHeaders() {
    const headers = {};

    if (token) {
        headers.Authorization = "Bearer " + token;
    }

    return headers;
}

function buildQueryParams(includePagination = true) {
    const params = new URLSearchParams();

    const module = document.getElementById("filter-module").value.trim();
    const action = document.getElementById("filter-action").value.trim();
    const username = document.getElementById("filter-username").value.trim();
    const dateFrom = document.getElementById("filter-date-from").value;
    const dateTo = document.getElementById("filter-date-to").value;
    const perPage = document.getElementById("filter-per-page").value;

    if (module) params.set("module", module);
    if (action) params.set("action", action);
    if (username) params.set("username", username);
    if (dateFrom) params.set("date_from", `${dateFrom} 00:00:00`);
    if (dateTo) params.set("date_to", `${dateTo} 23:59:59`);

    if (includePagination) {
        if (perPage) params.set("per_page", perPage);
        params.set("page", String(currentPage));
    }

    return params.toString();
}

async function safeJson(res) {
    const text = await res.text();

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`La respuesta no es JSON válido. Respuesta recibida: ${text.slice(0, 140)}`);
    }
}

async function loadAdminUsers() {
    try {
        const res = await fetch(`${API}/admins`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            throw new Error(data.message || "No se pudieron cargar los usuarios.");
        }

        const items = Array.isArray(data.items) ? data.items : [];
        const uniqueUsers = [...new Map(
            items
                .filter(item => item && item.username)
                .map(item => [
                    String(item.username).trim().toLowerCase(),
                    {
                        username: String(item.username).trim(),
                        full_name: String(item.full_name || "").trim()
                    }
                ])
        ).values()];

        uniqueUsers.sort((a, b) => {
            const nameA = `${a.full_name} ${a.username}`.trim().toLowerCase();
            const nameB = `${b.full_name} ${b.username}`.trim().toLowerCase();
            return nameA.localeCompare(nameB, "es");
        });

        usernameSelect.innerHTML = `
            <option value="">Todos</option>
            ${uniqueUsers.map(user => `
                <option value="${escapeHtml(user.username.toLowerCase())}">
                    ${escapeHtml(user.full_name ? `${user.full_name} (${user.username})` : user.username)}
                </option>
            `).join("")}
        `;
    } catch (error) {
        console.error("Error cargando usuarios admins:", error);
        usernameSelect.innerHTML = `<option value="">Todos</option>`;
        showStatus("No se pudieron cargar los usuarios para el filtro.", "error");
    }
}

function renderLogs(items) {
    if (!Array.isArray(items) || items.length === 0) {
        logsList.innerHTML = `<div class="admin-empty">No se encontraron logs con los filtros seleccionados.</div>`;
        return;
    }

    logsList.innerHTML = items.map(item => `
        <article class="admin-item admin-log-item logs-list-card">
            <div class="admin-item-top">
                <div class="admin-log-badges">
                    <span class="admin-badge">${escapeHtml(getModuleLabel(item.module))}</span>
                    <span class="admin-badge ${getActionBadgeClass(item.action)}">${escapeHtml(getActionLabel(item.action))}</span>
                    <span class="admin-badge">${escapeHtml(item.role || "sin rol")}</span>
                </div>
                <div>
                    <span class="admin-badge">ID log: ${escapeHtml(item.id)}</span>
                </div>
            </div>

            <h3>${escapeHtml(item.username || "Usuario desconocido")}</h3>

            <div class="admin-log-grid">
                <p><strong>Módulo interno:</strong> ${escapeHtml(item.module || "sin módulo")}</p>
                <p><strong>Acción interna:</strong> ${escapeHtml(item.action || "sin acción")}</p>
                <p><strong>Descripción:</strong> ${escapeHtml(item.description || "Sin descripción")}</p>
                <p><strong>Fecha:</strong> ${escapeHtml(formatDateTime(item.created_at))}</p>
                <p><strong>Admin ID:</strong> ${escapeHtml(item.admin_id ?? "N/A")}</p>
                <p><strong>Target ID:</strong> ${escapeHtml(item.target_id ?? "N/A")}</p>
                <p><strong>IP:</strong> ${escapeHtml(item.ip_address || "No disponible")}</p>
                <p><strong>User-Agent:</strong> ${escapeHtml(item.user_agent || "No disponible")}</p>
            </div>
        </article>
    `).join("");
}

function updatePagination(pagination) {
    if (!pagination) return;

    totalPages = Number(pagination.total_pages || 1);

    paginationSummary.textContent = `Mostrando ${pagination.from}–${pagination.to} de ${pagination.total}`;
    pageIndicator.textContent = `Página ${pagination.page} de ${pagination.total_pages}`;

    prevPageBtn.disabled = pagination.page <= 1;
    nextPageBtn.disabled = pagination.page >= pagination.total_pages;

    summaryBox.textContent = `Se encontraron ${pagination.total} registro(s) en total para la consulta actual.`;
}

async function loadLogs() {
    logsList.innerHTML = `<div class="admin-empty">Cargando logs...</div>`;
    summaryBox.textContent = "Consultando registros...";
    clearStatus();

    try {
        const query = buildQueryParams(true);
        const url = query ? `${API}/admins/logs?${query}` : `${API}/admins/logs`;

        const res = await fetch(url, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (res.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("adminUser");
                window.location.href = "./login.html";
                return;
            }

            if (res.status === 403) {
                showStatus(data.message || "No tienes permisos para ver esta sección.", "error");
                window.location.href = "./dashboard.html";
                return;
            }

            throw new Error(data.message || "No se pudieron cargar los logs.");
        }

        renderLogs(data.items || []);
        updatePagination(data.pagination);
    } catch (error) {
        console.error("Error cargando logs:", error);
        logsList.innerHTML = `<div class="admin-empty">Error al cargar logs.</div>`;
        summaryBox.textContent = "No se pudo completar la consulta.";
        showStatus(error.message || "Error al consultar logs.", "error");
    }
}

function resetFilters() {
    form.reset();
    if (perPageSelect) {
        perPageSelect.value = "10";
    }
    currentPage = 1;
    loadLogs();
}

async function downloadBlob(url, fallbackName) {
    const res = await fetch(url, {
        headers: getAuthHeaders(),
        credentials: "include"
    });

    if (!res.ok) {
        let message = "No se pudo exportar el archivo.";
        try {
            const data = await safeJson(res);
            message = data.message || message;
        } catch (error) {}
        throw new Error(message);
    }

    const blob = await res.blob();
    const objectUrl = window.URL.createObjectURL(blob);

    const contentDisposition = res.headers.get("Content-Disposition") || "";
    const match = contentDisposition.match(/filename="([^"]+)"/);
    const fileName = match ? match[1] : fallbackName;

    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(objectUrl);
}

async function exportLogsExcel() {
    try {
        clearStatus();
        const query = buildQueryParams(false);
        const url = query ? `${API}/admins/logs/export/excel?${query}` : `${API}/admins/logs/export/excel`;

        exportExcelBtn.disabled = true;
        exportExcelBtn.textContent = "Exportando...";
        await downloadBlob(url, "logs.xlsx");
    } catch (error) {
        console.error("Error exportando Excel:", error);
        showStatus(error.message || "Error al exportar Excel.", "error");
    } finally {
        exportExcelBtn.disabled = false;
        exportExcelBtn.textContent = "Exportar Excel";
    }
}

async function exportLogsPdf() {
    try {
        clearStatus();
        const query = buildQueryParams(false);
        const url = query ? `${API}/admins/logs/export/pdf?${query}` : `${API}/admins/logs/export/pdf`;

        exportPdfBtn.disabled = true;
        exportPdfBtn.textContent = "Exportando...";
        await downloadBlob(url, "logs.pdf");
    } catch (error) {
        console.error("Error exportando PDF:", error);
        showStatus(error.message || "Error al exportar PDF.", "error");
    } finally {
        exportPdfBtn.disabled = false;
        exportPdfBtn.textContent = "Exportar PDF";
    }
}

async function logoutAdmin() {
    try {
        if (logoutBtn) {
            logoutBtn.disabled = true;
            logoutBtn.textContent = "Cerrando...";
        }

        await fetch(`${API}/auth/logout`, {
            method: "POST",
            headers: getAuthHeaders(),
            credentials: "include"
        });
    } catch (error) {
        console.error("Error al registrar logout:", error);
    } finally {
        localStorage.removeItem("token");
        localStorage.removeItem("adminUser");
        window.location.href = "./login.html";
    }
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    currentPage = 1;
    await loadLogs();
});

resetFiltersBtn.addEventListener("click", resetFilters);
reloadLogsBtn.addEventListener("click", loadLogs);
logoutBtn.addEventListener("click", logoutAdmin);
exportExcelBtn.addEventListener("click", exportLogsExcel);
exportPdfBtn.addEventListener("click", exportLogsPdf);

perPageSelect.addEventListener("change", () => {
    currentPage = 1;
    loadLogs();
});

prevPageBtn.addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage -= 1;
        loadLogs();
    }
});

nextPageBtn.addEventListener("click", () => {
    if (currentPage < totalPages) {
        currentPage += 1;
        loadLogs();
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    await loadAdminUsers();
    await loadLogs();
});