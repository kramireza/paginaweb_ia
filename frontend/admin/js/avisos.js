AdminCore.requireAuth();

const {
    API,
    adminUser,
    getAuthHeaders,
    safeJson,
    escapeHtml,
    showStatus,
    clearStatus,
    applyCenterRestrictions,
    getAllowedCenters,
    getItemsByCenter,
    getNextOrder,
    getCenterLabel
} = AdminCore;

const allowedCenters = getAllowedCenters();

const form = document.getElementById("aviso-form");
const list = document.getElementById("avisos-list");
const statusBox = document.getElementById("status-box");
const formTitle = document.getElementById("form-title");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const logoutBtn = document.getElementById("logout-btn");
const ordenVisualInput = document.getElementById("orden_visual");
const manualOrderToggle = document.getElementById("manual-order-toggle");
const centroSelect = document.getElementById("centro");
const filterCentroSelect = document.getElementById("filter-centro");
const sidebarLinks = document.querySelectorAll(".admin-sidebar-link");

let avisosCache = [];

logoutBtn?.addEventListener("click", AdminCore.logout);

function getSelectedFilterCenter() {
    return filterCentroSelect?.value || allowedCenters[0] || "vs";
}

function getSelectedFormCenter() {
    return centroSelect?.value || allowedCenters[0] || "vs";
}

function getCurrentEditId() {
    return document.getElementById("aviso-id").value || "";
}

function isEditing() {
    return !!getCurrentEditId();
}

function updateOrderFieldState() {
    const manual = manualOrderToggle.checked;
    ordenVisualInput.readOnly = !manual;

    if (!manual) {
        if (isEditing()) return;

        const centroActivo = getSelectedFormCenter();
        const filtered = getItemsByCenter(avisosCache, centroActivo);
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
    loadAvisos();
});

function resetForm() {
    form.reset();
    document.getElementById("aviso-id").value = "";
    document.getElementById("activo").checked = true;
    document.getElementById("manual-order-toggle").checked = false;

    if (centroSelect) {
        centroSelect.value = getSelectedFilterCenter();
    }

    formTitle.textContent = "Nuevo aviso";
    updateOrderFieldState();
    clearStatus(statusBox);
}

cancelEditBtn?.addEventListener("click", resetForm);

function sortAvisos(items) {
    return [...items].sort((a, b) => {
        const orderA = Number(a.orden_visual || 0);
        const orderB = Number(b.orden_visual || 0);

        if (orderA !== orderB) return orderA - orderB;
        return String(a.titulo || "").localeCompare(String(b.titulo || ""), "es", { sensitivity: "base" });
    });
}

function validateForm() {
    const titulo = document.getElementById("titulo").value.trim();
    const resumen = document.getElementById("resumen").value.trim();
    const fecha = document.getElementById("fecha_publicacion").value.trim();
    const enlace = document.getElementById("enlace").value.trim();

    if (!titulo) throw new Error("El título es obligatorio.");
    if (titulo.length < 3) throw new Error("El título debe tener al menos 3 caracteres.");
    if (!resumen) throw new Error("El resumen es obligatorio.");
    if (resumen.length < 10) throw new Error("El resumen debe tener al menos 10 caracteres.");
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("La fecha de publicación no tiene un formato válido.");
    if (enlace && /\s/.test(enlace)) throw new Error("El enlace no debe contener espacios.");
}

async function loadAvisos() {
    list.innerHTML = `<div class="admin-empty">Cargando avisos...</div>`;

    const centroActivo = getSelectedFilterCenter();

    try {
        const res = await fetch(`${API}/avisos/admin/list?centro=${encodeURIComponent(centroActivo)}`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (res.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudieron cargar los avisos.");
        }

        avisosCache = Array.isArray(data.items) ? data.items : [];

        if (avisosCache.length === 0) {
            list.innerHTML = `<div class="admin-empty">No hay avisos registrados para ${escapeHtml(getCenterLabel(centroActivo))}.</div>`;
            updateOrderFieldState();
            return;
        }

        const sortedItems = sortAvisos(avisosCache);

        list.innerHTML = sortedItems.map(item => `
            <article class="admin-item ${item.destacado ? "featured" : ""}">
                <div class="admin-item-top">
                    <div>
                        <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                        <span class="admin-badge">${escapeHtml(item.categoria || "General")}</span>
                        ${item.destacado ? `<span class="admin-badge">Destacado</span>` : ""}
                        <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activo" : "Inactivo"}</span>
                    </div>
                    <div>
                        <span class="admin-badge">Orden: ${escapeHtml(item.orden_visual ?? 0)}</span>
                    </div>
                </div>

                <h3>${escapeHtml(item.titulo)}</h3>
                <p><strong>Fecha:</strong> ${escapeHtml(item.fecha_publicacion || "Sin fecha")}</p>
                <p><strong>Resumen:</strong> ${escapeHtml(item.resumen || "")}</p>
                ${item.contenido ? `<p><strong>Contenido:</strong> ${escapeHtml(item.contenido)}</p>` : ""}
                ${item.enlace ? `<p><strong>Enlace:</strong> ${escapeHtml(item.enlace)}</p>` : ""}

                <div class="admin-item-actions">
                    <button class="btn-warning" onclick='editAviso(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Editar</button>
                    <button class="btn-danger" onclick="deleteAviso(${item.id})">Eliminar</button>
                </div>
            </article>
        `).join("");

        updateOrderFieldState();
    } catch (error) {
        console.error(error);
        list.innerHTML = `<div class="admin-empty">Error al cargar avisos.</div>`;
        showStatus(statusBox, error.message, "error");
    }
}

window.editAviso = function(item) {
    if (!allowedCenters.includes(String(item.centro || "").toLowerCase())) {
        showStatus(statusBox, "No tienes permisos para editar este centro.", "error");
        return;
    }

    document.getElementById("aviso-id").value = item.id;
    document.getElementById("centro").value = item.centro || getSelectedFilterCenter();
    document.getElementById("titulo").value = item.titulo || "";
    document.getElementById("categoria").value = item.categoria || "";
    document.getElementById("resumen").value = item.resumen || "";
    document.getElementById("contenido").value = item.contenido || "";
    document.getElementById("fecha_publicacion").value = item.fecha_publicacion || "";
    document.getElementById("orden_visual").value = item.orden_visual ?? 0;
    document.getElementById("enlace").value = item.enlace || "";
    document.getElementById("destacado").checked = !!item.destacado;
    document.getElementById("activo").checked = !!item.activo;
    document.getElementById("manual-order-toggle").checked = false;
    updateOrderFieldState();

    AdminLayout.activatePanel("panel-form");

    formTitle.textContent = "Editar aviso";
    window.scrollTo({ top: 0, behavior: "smooth" });
    showStatus(statusBox, "Editando aviso seleccionado.", "info");
};

window.deleteAviso = async function(id) {
    const ok = confirm("¿Seguro que deseas eliminar este aviso?");
    if (!ok) return;

    try {
        const res = await fetch(`${API}/avisos/admin/${id}`, {
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
            throw new Error(data.message || "No se pudo eliminar el aviso.");
        }

        showStatus(statusBox, "Aviso eliminado correctamente.", "success");
        loadAvisos();
        resetForm();
        AdminLayout.activatePanel("panel-list");
    } catch (error) {
        console.error(error);
        showStatus(statusBox, error.message, "error");
    }
};

form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus(statusBox);

    try {
        validateForm();

        const id = getCurrentEditId();
        const centro = getSelectedFormCenter();

        if (!allowedCenters.includes(centro)) {
            throw new Error("No tienes permisos para usar ese centro.");
        }

        const selectedOrder = manualOrderToggle.checked
            ? Number(document.getElementById("orden_visual").value || getNextOrder(getItemsByCenter(avisosCache, centro)))
            : (
                isEditing()
                    ? Number(document.getElementById("orden_visual").value || 0)
                    : getNextOrder(getItemsByCenter(avisosCache, centro))
            );

        const payload = {
            centro,
            titulo: document.getElementById("titulo").value.trim(),
            categoria: document.getElementById("categoria").value.trim(),
            resumen: document.getElementById("resumen").value.trim(),
            contenido: document.getElementById("contenido").value.trim(),
            fecha_publicacion: document.getElementById("fecha_publicacion").value,
            orden_visual: Number(selectedOrder),
            enlace: document.getElementById("enlace").value.trim(),
            destacado: document.getElementById("destacado").checked,
            activo: document.getElementById("activo").checked
        };

        const res = await fetch(
            id ? `${API}/avisos/admin/${id}` : `${API}/avisos/admin`,
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
            throw new Error(data.message || "No se pudo guardar el aviso.");
        }

        showStatus(statusBox, id ? "Aviso actualizado correctamente." : "Aviso creado correctamente.", "success");
        resetForm();
        loadAvisos();
        AdminLayout.activatePanel("panel-list");
    } catch (error) {
        console.error(error);
        showStatus(statusBox, error.message, "error");
    }
});

applyCenterRestrictions([
    centroSelect,
    filterCentroSelect
]);

if (centroSelect && filterCentroSelect) {
    centroSelect.value = filterCentroSelect.value;
}

AdminLayout.initSidebar("panel-form");

updateOrderFieldState();
loadAvisos();