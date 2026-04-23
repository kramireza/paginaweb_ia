const API = `${window.location.origin}/informatica-api`.replace(/\/+$/, "");

const IS_LOCAL =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost";

const FILES_BASE = IS_LOCAL
    ? "http://localhost:4000"
    : window.location.origin;

function buildFileUrl(filePath = "") {
    if (!filePath) return "";
    return IS_LOCAL
        ? `${FILES_BASE}${filePath}`
        : `${FILES_BASE}${filePath.replace(/^\/uploads/, "/informatica-uploads")}`;
}

const token = localStorage.getItem("token");
const adminUserRaw = localStorage.getItem("adminUser");

const form = document.getElementById("recurso-form");
const list = document.getElementById("recursos-list");
const statusBox = document.getElementById("status-box");
const formTitle = document.getElementById("form-title");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const logoutBtn = document.getElementById("logout-btn");
const centroSelect = document.getElementById("centro");
const filterCentroSelect = document.getElementById("filter-centro");
const archivoActualBox = document.getElementById("archivo-actual-box");

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

function getAuthHeaders() {
    const headers = {};
    if (token) {
        headers.Authorization = "Bearer " + token;
    }
    return headers;
}

logoutBtn?.addEventListener("click", async () => {
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

function getAllowedCentersForGlobalModule(user) {
    const role = String(user?.role || "").toLowerCase();
    const assigned = String(user?.assignedCenter || "").toLowerCase();

    if (role === "superadmin" || assigned === "global") {
        return ["global", "vs", "cu", "danli"];
    }

    if (["vs", "cu", "danli"].includes(assigned)) {
        return ["global", assigned];
    }

    return ["global", "vs"];
}

const allowedCenters = getAllowedCentersForGlobalModule(adminUser);

function applyCenterRestrictions() {
    [centroSelect, filterCentroSelect].forEach(select => {
        if (!select) return;

        Array.from(select.options).forEach(option => {
            const allowed = allowedCenters.includes(option.value);
            option.hidden = !allowed;
            option.disabled = !allowed;
        });

        if (!allowedCenters.includes(select.value)) {
            select.value = allowedCenters[0];
        }
    });
}

function getSelectedFilterCenter() {
    return filterCentroSelect?.value || allowedCenters[0] || "global";
}

function getSelectedFormCenter() {
    return centroSelect?.value || allowedCenters[0] || "global";
}

function getCenterLabel(centro) {
    const map = {
        global: "Global",
        vs: "UNAH-VS",
        cu: "Ciudad Universitaria",
        danli: "UNAH Danlí"
    };

    return map[String(centro || "").toLowerCase()] || "Sin centro";
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

function getFileTypeLabel(tipo) {
    const map = {
        pdf: "PDF",
        docx: "DOCX",
        xlsx: "XLSX",
        pptx: "PPTX",
        zip: "ZIP",
        png: "PNG",
        jpg: "JPG",
        jpeg: "JPG"
    };

    return map[String(tipo || "").toLowerCase()] || (tipo ? String(tipo).toUpperCase() : "Archivo");
}

function renderArchivoActual(item) {
    if (!item || (!item.archivo_url && !item.archivo_nombre_original)) {
        archivoActualBox.innerHTML = "";
        archivoActualBox.classList.add("hidden");
        return;
    }

    archivoActualBox.innerHTML = `
        <div class="admin-file-card">
            <strong>Archivo actual:</strong>
            <div class="admin-file-meta">
                <span>${escapeHtml(item.archivo_nombre_original || "Archivo cargado")}</span>
                ${item.tipo_archivo ? `<span class="admin-badge">${escapeHtml(getFileTypeLabel(item.tipo_archivo))}</span>` : ""}
            </div>
            ${item.archivo_url ? `<a href="${buildFileUrl(item.archivo_url)}" target="_blank" rel="noopener noreferrer">Ver / descargar archivo actual</a>` : ""}
        </div>
    `;

    archivoActualBox.classList.remove("hidden");
}

function resetForm() {
    form.reset();
    document.getElementById("recurso-id").value = "";
    document.getElementById("orden_visual").value = 0;
    document.getElementById("activo").value = "true";

    if (centroSelect) {
        centroSelect.value = getSelectedFilterCenter();
    }

    formTitle.textContent = "Nuevo recurso";
    renderArchivoActual(null);
    clearStatus();
}

cancelEditBtn?.addEventListener("click", resetForm);

filterCentroSelect?.addEventListener("change", () => {
    if (!document.getElementById("recurso-id").value && centroSelect) {
        centroSelect.value = getSelectedFilterCenter();
    }
    loadRecursos();
});

async function safeJson(res) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error("Respuesta inválida del servidor");
    }
}

async function loadRecursos() {
    list.innerHTML = `<div class="admin-empty">Cargando recursos...</div>`;

    const centroActivo = getSelectedFilterCenter();

    try {
        const res = await fetch(`${API}/avisos/admin/recursos/list?centro=${encodeURIComponent(centroActivo)}`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (res.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudieron cargar los recursos.");
        }

        const items = Array.isArray(data.items) ? data.items : [];

        if (items.length === 0) {
            list.innerHTML = `<div class="admin-empty">No hay recursos registrados para ${escapeHtml(getCenterLabel(centroActivo))}.</div>`;
            return;
        }

        const sortedItems = [...items].sort((a, b) => Number(a.orden_visual || 0) - Number(b.orden_visual || 0));

        list.innerHTML = sortedItems.map(item => `
            <article class="admin-item">
                <div>
                    <div class="admin-item-top">
                        <div>
                            <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                            <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activo" : "Inactivo"}</span>
                            <span class="admin-badge">Orden: ${escapeHtml(item.orden_visual ?? 0)}</span>
                            ${item.tipo_archivo ? `<span class="admin-badge">${escapeHtml(getFileTypeLabel(item.tipo_archivo))}</span>` : ""}
                        </div>
                    </div>

                    <h3>${escapeHtml(item.titulo)}</h3>
                    ${item.descripcion ? `<p><strong>Descripción:</strong> ${escapeHtml(item.descripcion)}</p>` : ""}
                    ${item.archivo_nombre_original ? `<p><strong>Archivo:</strong> ${escapeHtml(item.archivo_nombre_original)}</p>` : ""}
                    ${item.archivo_url ? `<p><strong>Archivo URL:</strong> <a href="${buildFileUrl(item.archivo_url)}" target="_blank" rel="noopener noreferrer">Abrir archivo</a></p>` : ""}
                    ${item.enlace_externo ? `<p><strong>Enlace externo:</strong> <a href="${escapeHtml(item.enlace_externo)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.enlace_externo)}</a></p>` : ""}

                    <div class="admin-item-actions">
                        <button class="btn-warning admin-edit-btn" data-item="${encodeURIComponent(JSON.stringify(item))}">Editar</button>
                        <button class="btn-danger admin-delete-btn" data-id="${item.id}">Eliminar</button>
                    </div>
                </div>
            </article>
        `).join("");

        document.querySelectorAll(".admin-edit-btn").forEach(button => {
            button.addEventListener("click", () => {
                const raw = button.getAttribute("data-item");
                const item = JSON.parse(decodeURIComponent(raw));
                editRecurso(item);
            });
        });

        document.querySelectorAll(".admin-delete-btn").forEach(button => {
            button.addEventListener("click", () => {
                const id = button.getAttribute("data-id");
                deleteRecurso(id);
            });
        });
    } catch (error) {
        console.error(error);
        list.innerHTML = `<div class="admin-empty">Error al cargar recursos.</div>`;
        showStatus(error.message, "error");
    }
}

function editRecurso(item) {
    if (!allowedCenters.includes(String(item.centro || "").toLowerCase())) {
        showStatus("No tienes permisos para editar ese centro.", "error");
        return;
    }

    document.getElementById("recurso-id").value = item.id;
    document.getElementById("centro").value = item.centro || getSelectedFilterCenter();
    document.getElementById("titulo").value = item.titulo || "";
    document.getElementById("descripcion").value = item.descripcion || "";
    document.getElementById("enlace_externo").value = item.enlace_externo || "";
    document.getElementById("orden_visual").value = item.orden_visual ?? 0;
    document.getElementById("activo").value = String(!!item.activo);

    formTitle.textContent = "Editar recurso";
    renderArchivoActual(item);
    window.scrollTo({ top: 0, behavior: "smooth" });
    showStatus("Editando recurso seleccionado.", "info");
}

async function deleteRecurso(id) {
    const ok = confirm("¿Seguro que deseas eliminar este recurso?");
    if (!ok) return;

    try {
        const res = await fetch(`${API}/avisos/admin/recursos/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (res.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudo eliminar el recurso.");
        }

        showStatus("Recurso eliminado correctamente.", "success");
        loadRecursos();
        resetForm();
    } catch (error) {
        console.error(error);
        showStatus(error.message, "error");
    }
}

form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus();

    const id = document.getElementById("recurso-id").value;
    const archivoInput = document.getElementById("archivo");
    const centro = getSelectedFormCenter();

    if (!allowedCenters.includes(centro)) {
        showStatus("No tienes permisos para usar ese centro.", "error");
        return;
    }

    const formData = new FormData();
    formData.append("centro", centro);
    formData.append("titulo", document.getElementById("titulo").value.trim());
    formData.append("descripcion", document.getElementById("descripcion").value.trim());
    formData.append("enlace_externo", document.getElementById("enlace_externo").value.trim());
    formData.append("orden_visual", document.getElementById("orden_visual").value || 0);
    formData.append("activo", document.getElementById("activo").value);

    if (archivoInput.files[0]) {
        formData.append("archivo", archivoInput.files[0]);
    }

    try {
        const res = await fetch(
            id ? `${API}/avisos/admin/recursos/${id}` : `${API}/avisos/admin/recursos`,
            {
                method: id ? "PUT" : "POST",
                headers: getAuthHeaders(),
                credentials: "include",
                body: formData
            }
        );

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (res.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudo guardar el recurso.");
        }

        showStatus(id ? "Recurso actualizado correctamente." : "Recurso creado correctamente.", "success");
        resetForm();
        loadRecursos();
    } catch (error) {
        console.error(error);
        showStatus(error.message, "error");
    }
});

applyCenterRestrictions();

if (centroSelect && filterCentroSelect) {
    centroSelect.value = filterCentroSelect.value;
}

loadRecursos();