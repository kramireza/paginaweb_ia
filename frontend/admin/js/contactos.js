const API = `${window.location.origin}/informatica-api`.replace(/\/+$/, "");
const token = localStorage.getItem("token");
const adminUserRaw = localStorage.getItem("adminUser");

let adminUser = null;

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

function getAuthHeaders(includeJson = false) {
    const headers = {};

    if (includeJson) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

document.getElementById("logout-btn")?.addEventListener("click", async () => {
    try {
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
});

const statusBox = document.getElementById("status-box");
const contactosList = document.getElementById("contactos-list");
const detailBox = document.getElementById("contact-detail");

const filterCentro = document.getElementById("filter-centro");
const filterDestinatario = document.getElementById("filter-destinatario");
const filterEstado = document.getElementById("filter-estado");
const applyFiltersBtn = document.getElementById("apply-filters-btn");
const clearFiltersBtn = document.getElementById("clear-filters-btn");

function getAllowedCentersForExclusiveModule(user) {
    const role = String(user?.role || "").toLowerCase();
    const assigned = String(user?.assignedCenter || "").toLowerCase();

    if (role === "superadmin" || assigned === "global") {
        return ["vs", "cu", "danli"];
    }

    if (["vs", "cu", "danli"].includes(assigned)) {
        return [assigned];
    }

    return ["vs"];
}

const allowedCenters = getAllowedCentersForExclusiveModule(adminUser);

function applyCenterRestrictions() {
    if (!filterCentro) return;

    Array.from(filterCentro.options).forEach(option => {
        if (option.value === "") return;

        const allowed = allowedCenters.includes(option.value);
        option.hidden = !allowed;
        option.disabled = !allowed;
    });

    if (filterCentro.value && !allowedCenters.includes(filterCentro.value)) {
        filterCentro.value = "";
    }
}

function getDefaultCenterForList() {
    if (adminUser.role === "superadmin" || String(adminUser.assignedCenter || "").toLowerCase() === "global") {
        return "";
    }
    return allowedCenters[0] || "";
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

function getCenterLabel(centro) {
    const map = {
        vs: "UNAH-VS",
        cu: "Ciudad Universitaria",
        danli: "UNAH Danlí"
    };
    return map[String(centro || "").toLowerCase()] || "Sin centro";
}

function getDestinationLabel(destinatario) {
    const map = {
        jefatura: "Jefatura",
        coordinacion: "Coordinación",
        directiva: "Directiva"
    };
    return map[String(destinatario || "").toLowerCase()] || "Sin destinatario";
}

function getStatusLabel(estado) {
    const map = {
        pendiente: "Pendiente",
        leido: "Leído",
        respondido: "Respondido"
    };
    return map[String(estado || "").toLowerCase()] || "Sin estado";
}

function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    return date.toLocaleString("es-HN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getFiltersQuery() {
    const params = new URLSearchParams();

    const selectedCenter = filterCentro.value || getDefaultCenterForList();

    if (selectedCenter) params.set("centro", selectedCenter);
    if (filterDestinatario.value) params.set("destinatario", filterDestinatario.value);
    if (filterEstado.value) params.set("estado", filterEstado.value);

    return params.toString();
}

async function safeJson(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error("Respuesta inválida del servidor");
    }
}

async function loadContactos() {
    clearStatus();
    contactosList.innerHTML = `<div class="admin-empty">Cargando contactos...</div>`;

    try {
        const query = getFiltersQuery();
        const url = query
            ? `${API}/admin/contactos?${query}`
            : `${API}/admin/contactos`;

        const response = await fetch(url, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            if (response.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudieron cargar los contactos");
        }

        const items = Array.isArray(data.items) ? data.items : [];

        if (items.length === 0) {
            contactosList.innerHTML = `<div class="admin-empty">No hay contactos registrados con los filtros actuales.</div>`;
            return;
        }

        contactosList.innerHTML = items.map(item => `
            <article class="admin-item">
                <div class="admin-item-top">
                    <div>
                        <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                        <span class="admin-badge">${escapeHtml(getDestinationLabel(item.destinatario))}</span>
                        <span class="admin-badge ${item.estado === "respondido" ? "active" : item.estado === "leido" ? "" : "inactive"}">
                            ${escapeHtml(getStatusLabel(item.estado))}
                        </span>
                    </div>
                    <div>
                        <span class="admin-badge">${escapeHtml(formatDate(item.created_at))}</span>
                    </div>
                </div>

                <h3>${escapeHtml(item.asunto)}</h3>
                <p><strong>Nombre:</strong> ${escapeHtml(item.nombre)}</p>
                <p><strong>Correo:</strong> ${escapeHtml(item.correo)}</p>
                <p><strong>Teléfono:</strong> ${escapeHtml(item.telefono)}</p>
                <p><strong>Mensaje:</strong> ${escapeHtml(item.mensaje).slice(0, 180)}${item.mensaje.length > 180 ? "..." : ""}</p>

                <div class="admin-item-actions">
                    <button class="btn-primary" onclick="viewContacto(${item.id})">Ver detalle</button>
                    <button class="btn-secondary" onclick="changeEstado(${item.id}, 'leido')">Marcar leído</button>
                    <button class="btn-warning" onclick="changeEstado(${item.id}, 'respondido')">Marcar respondido</button>
                    <button class="btn-danger" onclick="changeEstado(${item.id}, 'pendiente')">Volver a pendiente</button>
                </div>
            </article>
        `).join("");
    } catch (error) {
        console.error(error);
        contactosList.innerHTML = `<div class="admin-empty">Error al cargar contactos.</div>`;
        showStatus(error.message, "error");
    }
}

async function viewContacto(id) {
    clearStatus();
    detailBox.innerHTML = `<div class="admin-empty">Cargando detalle...</div>`;

    try {
        const response = await fetch(`${API}/admin/contactos/${id}`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            if (response.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudo cargar el detalle");
        }

        const item = data.item;

        detailBox.innerHTML = `
            <article class="admin-item">
                <div class="admin-item-top">
                    <div>
                        <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                        <span class="admin-badge">${escapeHtml(getDestinationLabel(item.destinatario))}</span>
                        <span class="admin-badge">${escapeHtml(getStatusLabel(item.estado))}</span>
                    </div>
                </div>

                <h3>${escapeHtml(item.asunto)}</h3>
                <p><strong>Nombre:</strong> ${escapeHtml(item.nombre)}</p>
                <p><strong>Correo:</strong> ${escapeHtml(item.correo)}</p>
                <p><strong>Teléfono:</strong> ${escapeHtml(item.telefono)}</p>
                <p><strong>Creado:</strong> ${escapeHtml(formatDate(item.created_at))}</p>
                <p><strong>Actualizado:</strong> ${escapeHtml(formatDate(item.updated_at))}</p>
                <p><strong>Mensaje completo:</strong></p>
                <div style="padding:12px; background:#f7fbff; border:1px solid #d7e0eb; border-radius:10px; line-height:1.7; white-space:pre-line;">
                    ${escapeHtml(item.mensaje)}
                </div>
            </article>
        `;
    } catch (error) {
        console.error(error);
        detailBox.innerHTML = `<div class="admin-empty">Error al cargar el detalle.</div>`;
        showStatus(error.message, "error");
    }
}

async function changeEstado(id, estado) {
    clearStatus();

    try {
        const response = await fetch(`${API}/admin/contactos/${id}/estado`, {
            method: "PUT",
            headers: getAuthHeaders(true),
            credentials: "include",
            body: JSON.stringify({ estado })
        });

        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            if (response.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudo actualizar el estado");
        }

        showStatus("Estado actualizado correctamente.", "success");
        await loadContactos();
        await viewContacto(id);
    } catch (error) {
        console.error(error);
        showStatus(error.message, "error");
    }
}

applyFiltersBtn?.addEventListener("click", loadContactos);

clearFiltersBtn?.addEventListener("click", () => {
    filterCentro.value = getDefaultCenterForList();
    filterDestinatario.value = "";
    filterEstado.value = "";
    loadContactos();
});

window.viewContacto = viewContacto;
window.changeEstado = changeEstado;

applyCenterRestrictions();

if (!filterCentro.value) {
    filterCentro.value = getDefaultCenterForList();
}

loadContactos();