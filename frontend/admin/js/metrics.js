const API = `${window.location.origin}/informatica-api`.replace(/\/+$/, "");
const token = localStorage.getItem("token");
const adminUserRaw = localStorage.getItem("adminUser");

const PAGE_LABELS = {
    index: "Inicio",
    docentes: "Docentes",
    jefatura: "Jefatura y coordinación",
    autoridades: "Autoridades estudiantiles",
    comites: "Comités y grupos",
    iiicap: "IIICAP-IA",
    maestria: "Maestría",
    contacto: "Contacto",
    mapa_clases: "Mapa de clases"
};

let latestVisitsPage = 1;
let latestVisitsPerPage = 10;
let latestVisitsTotalPages = 1;

if (!token) {
    window.location.href = "login.html";
}

let adminUser = null;

try {
    adminUser = adminUserRaw ? JSON.parse(adminUserRaw) : null;
} catch (error) {
    adminUser = null;
}

if (!adminUser) {
    localStorage.removeItem("token");
    localStorage.removeItem("adminUser");
    window.location.href = "login.html";
}

if (adminUser?.mustChangePassword === true) {
    window.location.href = "change-password.html";
}

if (adminUser?.role !== "superadmin") {
    window.location.href = "dashboard.html";
}

function showMetricsStatus(message, type = "info") {
    const statusBox = document.getElementById("metrics-status");
    if (!statusBox) return;

    statusBox.textContent = message;
    statusBox.className = `admin-status show ${type}`;
}

function clearMetricsStatus() {
    const statusBox = document.getElementById("metrics-status");
    if (!statusBox) return;

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
    if (!value) return "Sin registros";

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

function formatCenterLabel(value) {
    const center = String(value || "").toLowerCase();

    if (center === "vs") return "UNAH-VS";
    if (center === "cu") return "Ciudad Universitaria";
    if (center === "danli") return "UNAH Danlí";
    if (center === "global") return "Global";
    if (center === "sin-centro") return "Sin centro";

    return value || "Sin dato";
}

function formatPageLabel(value) {
    const pageKey = String(value || "").trim().toLowerCase();
    return PAGE_LABELS[pageKey] || (value || "Página desconocida");
}

function setMetricValue(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = value;
}

function setMetricDetail(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = value;
}

function formatDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getMetricsFilters() {
    const dateFrom = document.getElementById("metrics-date-from")?.value || "";
    const dateTo = document.getElementById("metrics-date-to")?.value || "";

    const params = new URLSearchParams();

    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);

    return params.toString();
}

function getLatestVisitsQueryString() {
    const params = new URLSearchParams(getMetricsFilters());
    params.set("page", String(latestVisitsPage));
    params.set("per_page", String(latestVisitsPerPage));
    return params.toString();
}

function getAuthHeaders() {
    const headers = {};

    if (token) {
        headers.Authorization = "Bearer " + token;
    }

    return headers;
}

function applyQuickDateRange(rangeKey) {
    const dateFromInput = document.getElementById("metrics-date-from");
    const dateToInput = document.getElementById("metrics-date-to");

    if (!dateFromInput || !dateToInput) return;

    const today = new Date();
    const start = new Date(today);
    const end = new Date(today);

    if (rangeKey === "today") {
        dateFromInput.value = formatDateInputValue(start);
        dateToInput.value = formatDateInputValue(end);
        latestVisitsPage = 1;
        loadDashboardMetrics();
        return;
    }

    if (rangeKey === "last7") {
        start.setDate(today.getDate() - 6);
        dateFromInput.value = formatDateInputValue(start);
        dateToInput.value = formatDateInputValue(end);
        latestVisitsPage = 1;
        loadDashboardMetrics();
        return;
    }

    if (rangeKey === "last30") {
        start.setDate(today.getDate() - 29);
        dateFromInput.value = formatDateInputValue(start);
        dateToInput.value = formatDateInputValue(end);
        latestVisitsPage = 1;
        loadDashboardMetrics();
        return;
    }

    if (rangeKey === "month") {
        start.setDate(1);
        dateFromInput.value = formatDateInputValue(start);
        dateToInput.value = formatDateInputValue(end);
        latestVisitsPage = 1;
        loadDashboardMetrics();
    }
}

function updateExecutiveMetrics(totalVisitas, byCenterItems, topPagesItems) {
    const topCenter = Array.isArray(byCenterItems) && byCenterItems.length > 0 ? byCenterItems[0] : null;
    const topPage = Array.isArray(topPagesItems) && topPagesItems.length > 0 ? topPagesItems[0] : null;

    if (topCenter) {
        setMetricValue("metric-top-center", formatCenterLabel(topCenter.centro));
        setMetricDetail("metric-top-center-detail", `${topCenter.total} visita(s) registradas`);
    } else {
        setMetricValue("metric-top-center", "--");
        setMetricDetail("metric-top-center-detail", "Sin datos todavía");
    }

    if (topPage) {
        setMetricValue("metric-top-page", formatPageLabel(topPage.page_key));
        setMetricDetail("metric-top-page-detail", `${topPage.total} visita(s) registradas`);
    } else {
        setMetricValue("metric-top-page", "--");
        setMetricDetail("metric-top-page-detail", "Sin datos todavía");
    }

    if (topPage && Number(totalVisitas) > 0) {
        const share = ((Number(topPage.total) / Number(totalVisitas)) * 100).toFixed(1);
        setMetricValue("metric-top-share", `${share}%`);
        setMetricDetail("metric-top-share-detail", `${formatPageLabel(topPage.page_key)} concentra la mayor parte del tráfico`);
    } else {
        setMetricValue("metric-top-share", "--");
        setMetricDetail("metric-top-share-detail", "Participación sobre el total del rango");
    }
}

function renderMiniCenterChart(items) {
    const container = document.getElementById("metrics-center-chart");
    if (!container) return;

    if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = `<div class="admin-empty">No hay datos para el gráfico por centro.</div>`;
        return;
    }

    const maxValue = Math.max(...items.map(item => Number(item.total || 0)), 1);

    container.innerHTML = items.map(item => {
        const total = Number(item.total || 0);
        const height = Math.max((total / maxValue) * 100, 12);

        return `
            <div class="metrics-mini-chart-item">
                <div class="metrics-mini-chart-bar-wrap">
                    <span class="metrics-mini-chart-value">${escapeHtml(total)}</span>
                    <div class="metrics-mini-chart-bar" style="height:${height}%"></div>
                </div>
                <div class="metrics-mini-chart-label">${escapeHtml(formatCenterLabel(item.centro))}</div>
            </div>
        `;
    }).join("");
}

function renderMiniPageChart(items) {
    const container = document.getElementById("metrics-page-chart");
    if (!container) return;

    if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = `<div class="admin-empty">No hay datos para el gráfico por página.</div>`;
        return;
    }

    const topFive = items.slice(0, 5);
    const maxValue = Math.max(...topFive.map(item => Number(item.total || 0)), 1);

    container.innerHTML = topFive.map(item => {
        const total = Number(item.total || 0);
        const height = Math.max((total / maxValue) * 100, 12);

        return `
            <div class="metrics-mini-chart-item">
                <div class="metrics-mini-chart-bar-wrap">
                    <span class="metrics-mini-chart-value">${escapeHtml(total)}</span>
                    <div class="metrics-mini-chart-bar metrics-mini-chart-bar-secondary" style="height:${height}%"></div>
                </div>
                <div class="metrics-mini-chart-label">${escapeHtml(formatPageLabel(item.page_key))}</div>
            </div>
        `;
    }).join("");
}

function renderVisitsByCenter(items) {
    const container = document.getElementById("metrics-by-center");
    if (!container) return;

    if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = `<div class="admin-empty">No hay visitas registradas por centro en ese rango.</div>`;
        return;
    }

    const maxValue = Math.max(...items.map(item => Number(item.total || 0)), 1);

    container.innerHTML = items.map(item => {
        const total = Number(item.total || 0);
        const width = Math.max((total / maxValue) * 100, 8);

        return `
            <div class="metrics-ranked-item">
                <div class="metrics-ranked-item-main">
                    <div class="metrics-ranked-item-text">
                        <strong>${escapeHtml(formatCenterLabel(item.centro))}</strong>
                        <small>${escapeHtml(total)} visita(s)</small>
                    </div>
                    <span class="metrics-ranked-item-value">${escapeHtml(total)}</span>
                </div>
                <div class="metrics-progress">
                    <span style="width:${width}%"></span>
                </div>
            </div>
        `;
    }).join("");
}

function renderTopPages(items) {
    const container = document.getElementById("metrics-top-pages");
    if (!container) return;

    if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = `<div class="admin-empty">No hay páginas registradas en ese rango.</div>`;
        return;
    }

    const maxValue = Math.max(...items.map(item => Number(item.total || 0)), 1);

    container.innerHTML = items.map((item, index) => {
        const total = Number(item.total || 0);
        const width = Math.max((total / maxValue) * 100, 8);

        return `
            <div class="metrics-ranked-item">
                <div class="metrics-ranked-item-main">
                    <div class="metrics-rank-badge">#${index + 1}</div>
                    <div class="metrics-ranked-item-text">
                        <strong>${escapeHtml(formatPageLabel(item.page_key))}</strong>
                        <small>${escapeHtml(item.page_key || "sin-clave")}</small>
                    </div>
                    <span class="metrics-ranked-item-value">${escapeHtml(total)}</span>
                </div>
                <div class="metrics-progress">
                    <span style="width:${width}%"></span>
                </div>
            </div>
        `;
    }).join("");
}

function renderLatestVisits(items) {
    const container = document.getElementById("metrics-latest-visits");
    if (!container) return;

    if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = `<div class="admin-empty">No hay visitas recientes registradas en ese rango.</div>`;
        return;
    }

    container.innerHTML = items.map(item => `
        <article class="admin-item admin-metric-visit-item metrics-visit-card">
            <div class="admin-item-top metrics-visit-top">
                <div class="admin-log-badges">
                    <span class="admin-badge">${escapeHtml(formatPageLabel(item.page_key))}</span>
                    <span class="admin-badge">${escapeHtml(formatCenterLabel(item.centro || "sin-centro"))}</span>
                </div>
                <span class="admin-badge">${escapeHtml(formatDateTime(item.created_at))}</span>
            </div>

            <div class="admin-log-grid metrics-visit-grid">
                <p><strong>Clave interna:</strong> ${escapeHtml(item.page_key || "sin página")}</p>
                <p><strong>Ruta:</strong> ${escapeHtml(item.path || "No disponible")}</p>
                <p><strong>IP:</strong> ${escapeHtml(item.ip_address || "No disponible")}</p>
                <p><strong>User-Agent:</strong> ${escapeHtml(item.user_agent || "No disponible")}</p>
            </div>
        </article>
    `).join("");
}

function updateRecentPagination(pagination) {
    const summary = document.getElementById("metrics-pagination-summary");
    const indicator = document.getElementById("metrics-page-indicator");
    const prevBtn = document.getElementById("metrics-prev-page-btn");
    const nextBtn = document.getElementById("metrics-next-page-btn");

    if (!pagination) return;

    latestVisitsTotalPages = Number(pagination.total_pages || 1);

    if (summary) {
        summary.textContent = `Mostrando ${pagination.from}–${pagination.to} de ${pagination.total}`;
    }

    if (indicator) {
        indicator.textContent = `Página ${pagination.page} de ${pagination.total_pages}`;
    }

    if (prevBtn) {
        prevBtn.disabled = pagination.page <= 1;
    }

    if (nextBtn) {
        nextBtn.disabled = pagination.page >= pagination.total_pages;
    }
}

async function safeJson(res) {
    const text = await res.text();

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`La respuesta no es JSON válido. Respuesta recibida: ${text.slice(0, 160)}`);
    }
}

async function fetchProtectedMetric(url) {
    const res = await fetch(url, {
        headers: getAuthHeaders(),
        credentials: "include"
    });

    const data = await safeJson(res);

    if (!res.ok || !data.ok) {
        throw new Error(data.message || "No se pudo cargar la métrica.");
    }

    return data;
}

async function loadDashboardMetrics() {
    const reloadBtn = document.getElementById("reload-metrics-btn");
    const baseFilterQuery = getMetricsFilters();
    const baseQs = baseFilterQuery ? `?${baseFilterQuery}` : "";
    const latestQs = getLatestVisitsQueryString();

    try {
        clearMetricsStatus();

        if (reloadBtn) {
            reloadBtn.disabled = true;
            reloadBtn.textContent = "Cargando...";
        }

        const [summaryData, byCenterData, topPagesData, latestData] = await Promise.all([
            fetchProtectedMetric(`${API}/metrics/summary${baseQs}`),
            fetchProtectedMetric(`${API}/metrics/by-center${baseQs}`),
            fetchProtectedMetric(`${API}/metrics/top-pages${baseQs}`),
            fetchProtectedMetric(`${API}/metrics/latest?${latestQs}`)
        ]);

        const summary = summaryData.summary || {};
        const totalVisitas = Number(summary.total_visitas ?? 0);
        const byCenterItems = byCenterData.items || [];
        const topPagesItems = topPagesData.items || [];

        setMetricValue("metric-total-visits", totalVisitas);
        setMetricValue("metric-average-daily", summary.promedio_diario ?? 0);
        setMetricValue("metric-today-visits", summary.visitas_hoy ?? 0);
        setMetricValue("metric-last-visit", formatDateTime(summary.ultima_visita));

        updateExecutiveMetrics(totalVisitas, byCenterItems, topPagesItems);
        renderMiniCenterChart(byCenterItems);
        renderMiniPageChart(topPagesItems);
        renderVisitsByCenter(byCenterItems);
        renderTopPages(topPagesItems);
        renderLatestVisits(latestData.items || []);
        updateRecentPagination(latestData.pagination);
    } catch (error) {
        console.error("Error cargando métricas:", error);
        showMetricsStatus(error.message || "No se pudieron cargar las métricas.", "error");
    } finally {
        if (reloadBtn) {
            reloadBtn.disabled = false;
            reloadBtn.textContent = "Recargar métricas";
        }
    }
}

function clearMetricsFilters() {
    const dateFrom = document.getElementById("metrics-date-from");
    const dateTo = document.getElementById("metrics-date-to");

    if (dateFrom) dateFrom.value = "";
    if (dateTo) dateTo.value = "";

    latestVisitsPage = 1;
    loadDashboardMetrics();
}

async function logoutAdmin() {
    const logoutBtn = document.getElementById("logout-btn");

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
        window.location.href = "login.html";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const perPageSelect = document.getElementById("metrics-per-page");

    document.getElementById("logout-btn")?.addEventListener("click", logoutAdmin);
    document.getElementById("reload-metrics-btn")?.addEventListener("click", loadDashboardMetrics);

    const metricsFilterForm = document.getElementById("metrics-filter-form");
    if (metricsFilterForm) {
        metricsFilterForm.addEventListener("submit", (event) => {
            event.preventDefault();
            latestVisitsPage = 1;
            loadDashboardMetrics();
        });
    }

    document.getElementById("clear-metrics-filters-btn")?.addEventListener("click", clearMetricsFilters);

    document.querySelectorAll(".metrics-quick-filter-btn").forEach(button => {
        button.addEventListener("click", () => {
            applyQuickDateRange(button.dataset.range);
        });
    });

    if (perPageSelect) {
        perPageSelect.value = String(latestVisitsPerPage);

        perPageSelect.addEventListener("change", () => {
            latestVisitsPerPage = Number(perPageSelect.value || 10);
            latestVisitsPage = 1;
            loadDashboardMetrics();
        });
    }

    document.getElementById("metrics-prev-page-btn")?.addEventListener("click", () => {
        if (latestVisitsPage > 1) {
            latestVisitsPage -= 1;
            loadDashboardMetrics();
        }
    });

    document.getElementById("metrics-next-page-btn")?.addEventListener("click", () => {
        if (latestVisitsPage < latestVisitsTotalPages) {
            latestVisitsPage += 1;
            loadDashboardMetrics();
        }
    });

    loadDashboardMetrics();
});