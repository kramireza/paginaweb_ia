AdminCore.requireAuth();

const {
    API,
    adminUser,
    getAuthHeaders,
    safeJson,
    showStatus,
    clearStatus,
    applyCenterRestrictions,
    getAllowedCenters,
    getItemsByCenter,
    getNextOrder
} = AdminCore;

const allowedCenters = getAllowedCenters(adminUser);

const form = document.getElementById("fecha-form");
const list = document.getElementById("fechas-list");
const statusBox = document.getElementById("status-box");
const formTitle = document.getElementById("form-title");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const logoutBtn = document.getElementById("logout-btn");
const ordenVisualInput = document.getElementById("orden_visual");
const manualOrderToggle = document.getElementById("manual-order-toggle");
const centroSelect = document.getElementById("centro");
const filterCentroSelect = document.getElementById("filter-centro");

let fechasCache = [];

logoutBtn?.addEventListener("click", AdminCore.logout);

function getSelectedFilterCenter() {
    return filterCentroSelect?.value || allowedCenters[0] || "vs";
}

function getSelectedFormCenter() {
    return centroSelect?.value || allowedCenters[0] || "vs";
}

function getCurrentEditId() {
    return document.getElementById("fecha-id").value || "";
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
        const filtered = getItemsByCenter(fechasCache, centroActivo);
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
    loadFechas();
});

function resetForm() {
    form.reset();
    document.getElementById("fecha-id").value = "";
    document.getElementById("activo").checked = true;
    document.getElementById("manual-order-toggle").checked = false;

    if (centroSelect) {
        centroSelect.value = getSelectedFilterCenter();
    }

    formTitle.textContent = "Nueva fecha importante";
    updateOrderFieldState();
    clearStatus(statusBox);
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

function formatDate(fecha) {
    if (!fecha) return "Sin fecha";
    const date = new Date(`${fecha}T00:00:00`);
    if (Number.isNaN(date.getTime())) return fecha;

    return date.toLocaleDateString("es-HN", {
        year: "numeric",
        month: "long",
        day: "2-digit"
    });
}

function validateForm() {
    const titulo = document.getElementById("titulo").value.trim();
    const descripcion = document.getElementById("descripcion").value.trim();
    const fecha = document.getElementById("fecha").value.trim();

    if (!titulo) throw new Error("El título es obligatorio.");
    if (titulo.length < 3) throw new Error("El título debe tener al menos 3 caracteres.");
    if (!descripcion) throw new Error("La descripción es obligatoria.");
    if (descripcion.length < 8) throw new Error("La descripción debe tener al menos 8 caracteres.");
    if (!fecha) throw new Error("La fecha es obligatoria.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("La fecha no tiene un formato válido.");
}

cancelEditBtn?.addEventListener("click", resetForm);

function sortFechas(items) {
    return [...items].sort((a, b) => {
        const orderA = Number(a.orden_visual || 0);
        const orderB = Number(b.orden_visual || 0);

        if (orderA !== orderB) return orderA - orderB;
        return String(a.titulo || "").localeCompare(String(b.titulo || ""), "es", { sensitivity: "base" });
    });
}

async function loadFechas() {
    list.innerHTML = `<div class="admin-empty">Cargando fechas...</div>`;

    const centroActivo = getSelectedFilterCenter();

    try {
        const res = await fetch(`${API}/fechas/admin/list?centro=${encodeURIComponent(centroActivo)}`, {
            headers: { Authorization: "Bearer " + token }
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            if (res.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudieron cargar las fechas.");
        }

        fechasCache = Array.isArray(data.items) ? data.items : [];

        if (fechasCache.length === 0) {
            list.innerHTML = `<div class="admin-empty">No hay fechas registradas para ${escapeHtml(getCenterLabel(centroActivo))}.</div>`;
            updateOrderFieldState();
            return;
        }

        const sortedItems = sortFechas(fechasCache);

        list.innerHTML = sortedItems.map(item => `
            <article class="admin-item">
                <div class="admin-item-top">
                    <div>
                        <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                        <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activa" : "Inactiva"}</span>
                        <span class="admin-badge">Orden: ${escapeHtml(item.orden_visual ?? 0)}</span>
                    </div>
                </div>

                <h3>${escapeHtml(item.titulo)}</h3>
                <p><strong>Fecha:</strong> ${escapeHtml(formatDate(item.fecha))}</p>
                <p><strong>Descripción:</strong> ${escapeHtml(item.descripcion || "")}</p>

                <div class="admin-item-actions">
                    <button class="btn-warning" onclick='editFecha(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Editar</button>
                    <button class="btn-danger" onclick="deleteFecha(${item.id})">Eliminar</button>
                </div>
            </article>
        `).join("");
        updateOrderFieldState();
    } catch (error) {
        console.error(error);
        list.innerHTML = `<div class="admin-empty">Error al cargar fechas.</div>`;
        showStatus(statusBox, error.message, "error");
    }
}

window.editFecha = function(item) {
    if (!allowedCenters.includes(String(item.centro || "").toLowerCase())) {
        showStatus(statusBox, "No tienes permisos para editar este centro.", "error");
        return;
    }

    document.getElementById("fecha-id").value = item.id;
    document.getElementById("centro").value = item.centro || getSelectedFilterCenter();
    document.getElementById("titulo").value = item.titulo || "";
    document.getElementById("descripcion").value = item.descripcion || "";
    document.getElementById("fecha").value = item.fecha || "";
    document.getElementById("orden_visual").value = item.orden_visual ?? 0;
    document.getElementById("activo").checked = !!item.activo;
    document.getElementById("manual-order-toggle").checked = false;
    updateOrderFieldState();

    formTitle.textContent = "Editar fecha importante";
    window.scrollTo({ top: 0, behavior: "smooth" });
    showStatus(statusBox, "Editando fecha seleccionada.", "info");
};

window.deleteFecha = async function(id) {
    const ok = confirm("¿Seguro que deseas eliminar esta fecha importante?");
    if (!ok) return;

    try {
        const res = await fetch(`${API}/fechas/admin/${id}`, {
            method: "DELETE",
            headers: { Authorization: "Bearer " + token }
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            if (res.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudo eliminar la fecha.");
        }

        showStatus(statusBox, "Fecha eliminada correctamente.", "success");
        loadFechas();
        resetForm();
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
            ? Number(document.getElementById("orden_visual").value || getNextOrder(getItemsByCenter(fechasCache, centro)))
            : (
                isEditing()
                    ? Number(document.getElementById("orden_visual").value || 0)
                    : getNextOrder(getItemsByCenter(fechasCache, centro))
            );

        const payload = {
            centro,
            titulo: document.getElementById("titulo").value.trim(),
            descripcion: document.getElementById("descripcion").value.trim(),
            fecha: document.getElementById("fecha").value,
            orden_visual: Number(selectedOrder),
            activo: document.getElementById("activo").checked
        };

        const res = await fetch(
            id ? `${API}/fechas/admin/${id}` : `${API}/fechas/admin`,
            {
                method: id ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + token
                },
                body: JSON.stringify(payload)
            }
        );

        const data = await res.json();

        if (!res.ok || !data.ok) {
            if (res.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudo guardar la fecha.");
        }

        showStatus(statusBox, id ? "Fecha actualizada correctamente." : "Fecha creada correctamente.", "success");
        resetForm();
        loadFechas();
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

updateOrderFieldState();
loadFechas();