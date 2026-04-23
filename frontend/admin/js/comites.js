const API = `${window.location.origin}/informatica-api`.replace(/\/+$/, "");
const token = localStorage.getItem("token");
const adminUserRaw = localStorage.getItem("adminUser");

const form = document.getElementById("comite-form");
const list = document.getElementById("comites-list");
const statusBox = document.getElementById("status-box");
const formTitle = document.getElementById("form-title");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const logoutBtn = document.getElementById("logout-btn");
const ordenVisualInput = document.getElementById("orden_visual");
const manualOrderToggle = document.getElementById("manual-order-toggle");
const centroSelect = document.getElementById("centro");
const filterCentroSelect = document.getElementById("filter-centro");

let comitesCache = [];
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
    return filterCentroSelect?.value || allowedCenters[0] || "vs";
}

function getSelectedFormCenter() {
    return centroSelect?.value || allowedCenters[0] || "vs";
}

function getCurrentEditId() {
    return document.getElementById("comite-id").value || "";
}

function isEditing() {
    return !!getCurrentEditId();
}

function getItemsByCenter(items, centro) {
    return (Array.isArray(items) ? items : []).filter(
        item => String(item.centro || "").toLowerCase() === String(centro || "").toLowerCase()
    );
}

function getNextOrder(items) {
    if (!Array.isArray(items) || items.length === 0) return 1;

    const maxOrder = Math.max(...items.map(item => Number(item.orden_visual || 0)));
    return maxOrder + 1;
}

function updateOrderFieldState() {
    const manual = manualOrderToggle.checked;
    ordenVisualInput.readOnly = !manual;

    if (!manual) {
        if (isEditing()) return;

        const centroActivo = getSelectedFormCenter();
        const filtered = getItemsByCenter(comitesCache, centroActivo);
        ordenVisualInput.value = getNextOrder(filtered);
    }
}

manualOrderToggle?.addEventListener("change", updateOrderFieldState);

centroSelect?.addEventListener("change", () => {
    if (!isEditing()) {
        updateOrderFieldState();
    }
});

filterCentroSelect?.addEventListener("change", () => {
    if (!isEditing() && centroSelect) {
        centroSelect.value = getSelectedFilterCenter();
        updateOrderFieldState();
    }
    loadComites();
});

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

function resetForm() {
    form.reset();
    document.getElementById("comite-id").value = "";
    document.getElementById("activo").value = "true";
    document.getElementById("manual-order-toggle").checked = false;

    if (centroSelect) {
        centroSelect.value = getSelectedFilterCenter();
    }

    formTitle.textContent = "Nuevo comité";
    updateOrderFieldState();
    clearStatus();
}

cancelEditBtn?.addEventListener("click", resetForm);

function validateForm() {
    const nombre = document.getElementById("nombre").value.trim();
    const descripcion = document.getElementById("descripcion").value.trim();

    if (!nombre) {
        throw new Error("El nombre del comité es obligatorio.");
    }

    if (nombre.length < 3) {
        throw new Error("El nombre del comité debe tener al menos 3 caracteres.");
    }

    if (!descripcion) {
        throw new Error("La descripción es obligatoria.");
    }

    if (descripcion.length < 10) {
        throw new Error("La descripción debe tener al menos 10 caracteres.");
    }
}

function sortComites(items) {
    return [...items].sort((a, b) => {
        const orderA = Number(a.orden_visual || 0);
        const orderB = Number(b.orden_visual || 0);

        if (orderA !== orderB) return orderA - orderB;
        return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base" });
    });
}

async function safeJson(res) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`La respuesta no es JSON válido. Respuesta recibida: ${text.slice(0, 120)}`);
    }
}

async function loadComites() {
    list.innerHTML = `<div class="admin-empty">Cargando comités...</div>`;

    const centroActivo = getSelectedFilterCenter();

    try {
        const res = await fetch(`${API}/comites/admin/list?centro=${encodeURIComponent(centroActivo)}`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (res.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudieron cargar los comités.");
        }

        comitesCache = Array.isArray(data.items) ? data.items : [];

        if (comitesCache.length === 0) {
            list.innerHTML = `<div class="admin-empty">No hay comités registrados para ${escapeHtml(getCenterLabel(centroActivo))}.</div>`;
            updateOrderFieldState();
            return;
        }

        const sortedItems = sortComites(comitesCache);

        list.innerHTML = sortedItems.map(item => `
            <article class="admin-item">
                <div class="admin-item-top">
                    <div>
                        <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                        <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activo" : "Inactivo"}</span>
                        <span class="admin-badge">Orden: ${escapeHtml(item.orden_visual ?? 0)}</span>
                    </div>
                </div>

                <h3>${escapeHtml(item.nombre)}</h3>
                <p><strong>Descripción:</strong> ${escapeHtml(item.descripcion || "")}</p>
                ${item.encargados ? `<p><strong>Encargados:</strong> ${escapeHtml(item.encargados)}</p>` : ""}

                <div class="admin-item-actions">
                    <button class="btn-warning" onclick='editComite(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Editar</button>
                    <button class="btn-danger" onclick="deleteComite(${item.id})">Eliminar</button>
                </div>
            </article>
        `).join("");

        updateOrderFieldState();
    } catch (error) {
        console.error(error);
        list.innerHTML = `<div class="admin-empty">Error al cargar comités.</div>`;
        showStatus(error.message, "error");
    }
}

window.editComite = function(item) {
    if (!allowedCenters.includes(String(item.centro || "").toLowerCase())) {
        showStatus("No tienes permisos para editar este centro.", "error");
        return;
    }

    document.getElementById("comite-id").value = item.id;
    document.getElementById("centro").value = item.centro || getSelectedFilterCenter();
    document.getElementById("nombre").value = item.nombre || "";
    document.getElementById("descripcion").value = item.descripcion || "";
    document.getElementById("encargados").value = item.encargados || "";
    document.getElementById("orden_visual").value = item.orden_visual ?? 0;
    document.getElementById("activo").value = String(!!item.activo);
    document.getElementById("manual-order-toggle").checked = false;
    updateOrderFieldState();

    formTitle.textContent = "Editar comité";
    window.scrollTo({ top: 0, behavior: "smooth" });
    showStatus("Editando comité seleccionado.", "info");
};

window.deleteComite = async function(id) {
    const ok = confirm("¿Seguro que deseas eliminar este comité?");
    if (!ok) return;

    try {
        const res = await fetch(`${API}/comites/admin/${id}`, {
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
            throw new Error(data.message || "No se pudo eliminar el comité.");
        }

        showStatus("Comité eliminado correctamente.", "success");
        loadComites();
        resetForm();
    } catch (error) {
        console.error(error);
        showStatus(error.message, "error");
    }
};

form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus();

    try {
        validateForm();

        const id = getCurrentEditId();
        const centro = getSelectedFormCenter();

        if (!allowedCenters.includes(centro)) {
            throw new Error("No tienes permisos para usar ese centro.");
        }

        const selectedOrder = manualOrderToggle.checked
            ? Number(document.getElementById("orden_visual").value || getNextOrder(getItemsByCenter(comitesCache, centro)))
            : (
                isEditing()
                    ? Number(document.getElementById("orden_visual").value || 0)
                    : getNextOrder(getItemsByCenter(comitesCache, centro))
            );

        const payload = {
            centro,
            nombre: document.getElementById("nombre").value.trim(),
            descripcion: document.getElementById("descripcion").value.trim(),
            encargados: document.getElementById("encargados").value.trim(),
            orden_visual: Number(selectedOrder),
            activo: document.getElementById("activo").value === "true"
        };

        const res = await fetch(
            id ? `${API}/comites/admin/${id}` : `${API}/comites/admin`,
            {
                method: id ? "PUT" : "POST",
                headers: getAuthHeaders(true),
                credentials: "include",
                body: JSON.stringify(payload)
            }
        );

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (res.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudo guardar el comité.");
        }

        showStatus(id ? "Comité actualizado correctamente." : "Comité creado correctamente.", "success");
        resetForm();
        loadComites();
    } catch (error) {
        console.error(error);
        showStatus(error.message, "error");
    }
});

applyCenterRestrictions();

if (centroSelect && filterCentroSelect) {
    centroSelect.value = filterCentroSelect.value;
}

updateOrderFieldState();
loadComites();