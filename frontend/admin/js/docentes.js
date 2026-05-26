AdminCore.requireAuth();

const {
    API,
    adminUser,
    getAuthHeaders,
    safeJson,
    escapeHtml,
    getCenterLabel,
    getImageUrl,
    showStatus,
    clearStatus,
    applyCenterRestrictions,
    getAllowedCenters,
    getItemsByCenter,
    getNextOrder
} = AdminCore;

const allowedCenters = getAllowedCenters();

const form = document.getElementById("docente-form");
const list = document.getElementById("docentes-list");
const statusBox = document.getElementById("status-box");
const formTitle = document.getElementById("form-title");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const logoutBtn = document.getElementById("logout-btn");
const fotoInput = document.getElementById("foto");
const previewWrap = document.getElementById("preview-wrap");
const previewImage = document.getElementById("preview-image");
const ordenVisualInput = document.getElementById("orden_visual");
const manualOrderToggle = document.getElementById("manual-order-toggle");
const centroSelect = document.getElementById("centro");
const filterCentroSelect = document.getElementById("filter-centro");

let docentesCache = [];

logoutBtn?.addEventListener("click", AdminCore.logout);

function getSelectedFilterCenter() {
    return filterCentroSelect?.value || allowedCenters[0] || "vs";
}

function getSelectedFormCenter() {
    return centroSelect?.value || allowedCenters[0] || "vs";
}

function updateOrderFieldState() {
    const manual = manualOrderToggle.checked;
    ordenVisualInput.readOnly = !manual;

    if (!manual) {
        const currentId = document.getElementById("docente-id").value;
        if (currentId) return;

        const centroActivo = getSelectedFormCenter();
        const filtered = getItemsByCenter(docentesCache, centroActivo);
        ordenVisualInput.value = getNextOrder(filtered);
    }
}

manualOrderToggle?.addEventListener("change", updateOrderFieldState);

centroSelect?.addEventListener("change", () => {
    if (!document.getElementById("docente-id").value) {
        updateOrderFieldState();
    }
});

filterCentroSelect?.addEventListener("change", () => {
    if (!document.getElementById("docente-id").value && centroSelect) {
        centroSelect.value = getSelectedFilterCenter();
        updateOrderFieldState();
    }
    loadDocentes();
});

function resetForm() {
    form.reset();
    document.getElementById("docente-id").value = "";
    document.getElementById("foto_actual").value = "";
    document.getElementById("activo").checked = true;
    document.getElementById("manual-order-toggle").checked = false;

    if (centroSelect) {
        centroSelect.value = getSelectedFilterCenter();
    }

    previewWrap.style.display = "none";
    previewImage.src = "";
    formTitle.textContent = "Nuevo docente";
    updateOrderFieldState();
    clearStatus(statusBox);
}

cancelEditBtn?.addEventListener("click", resetForm);

fotoInput?.addEventListener("change", () => {
    const file = fotoInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        previewImage.src = e.target.result;
        previewWrap.style.display = "block";
    };
    reader.readAsDataURL(file);
});

function sortDocentes(items) {
    return [...items].sort((a, b) => {
        const orderA = Number(a.orden_visual || 0);
        const orderB = Number(b.orden_visual || 0);

        if (orderA !== orderB) return orderA - orderB;
        return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base" });
    });
}

async function loadDocentes() {
    list.innerHTML = `<div class="admin-empty">Cargando docentes...</div>`;

    const centroActivo = getSelectedFilterCenter();

    try {
        const res = await fetch(`${API}/docentes/admin/list?centro=${encodeURIComponent(centroActivo)}`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (res.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudieron cargar los docentes.");
        }

        docentesCache = Array.isArray(data.items) ? data.items : [];

        if (docentesCache.length === 0) {
            list.innerHTML = `<div class="admin-empty">No hay docentes registrados para ${escapeHtml(getCenterLabel(centroActivo))}.</div>`;
            updateOrderFieldState();
            return;
        }

        const sortedItems = sortDocentes(docentesCache);

        list.innerHTML = sortedItems.map(item => `
            <article class="admin-item">
                <div class="admin-item-layout">
                    <img class="admin-photo" src="${escapeHtml(getImageUrl(item.foto_url))}" alt="${escapeHtml(item.nombre)}">

                    <div>
                        <div class="admin-item-top">
                            <div>
                                <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                                <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activo" : "Inactivo"}</span>
                                <span class="admin-badge">Orden: ${escapeHtml(item.orden_visual ?? 0)}</span>
                            </div>
                        </div>

                        <h3>${escapeHtml(item.nombre)}</h3>
                        <p><strong>Cargo:</strong> ${escapeHtml(item.cargo || "Sin especificar")}</p>
                        ${item.correo ? `<p><strong>Correo:</strong> ${escapeHtml(item.correo)}</p>` : ""}
                        ${item.telefono ? `<p><strong>Teléfono:</strong> ${escapeHtml(item.telefono)}</p>` : ""}
                        ${item.descripcion ? `<p><strong>Descripción:</strong> ${escapeHtml(item.descripcion)}</p>` : ""}

                        <div class="admin-item-actions">
                            <button class="btn-warning" onclick='editDocente(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Editar</button>
                            <button class="btn-danger" onclick="deleteDocente(${item.id})">Eliminar</button>
                        </div>
                    </div>
                </div>
            </article>
        `).join("");

        updateOrderFieldState();
    } catch (error) {
        console.error(error);
        list.innerHTML = `<div class="admin-empty">Error al cargar docentes.</div>`;
        showStatus(statusBox, error.message, "error");
    }
}

window.editDocente = function(item) {
    if (!allowedCenters.includes(String(item.centro || "").toLowerCase())) {
        showStatus(statusBox, "No tienes permisos para editar este centro.", "error");
        return;
    }

    document.getElementById("docente-id").value = item.id;
    document.getElementById("foto_actual").value = item.foto_url || "";
    document.getElementById("centro").value = item.centro || getSelectedFilterCenter();
    document.getElementById("nombre").value = item.nombre || "";
    document.getElementById("cargo").value = item.cargo || "";
    document.getElementById("correo").value = item.correo || "";
    document.getElementById("telefono").value = item.telefono || "";
    document.getElementById("descripcion").value = item.descripcion || "";
    document.getElementById("orden_visual").value = item.orden_visual ?? 0;
    document.getElementById("activo").checked = !!item.activo;
    document.getElementById("manual-order-toggle").checked = false;
    updateOrderFieldState();

    if (item.foto_url) {
        previewImage.src = getImageUrl(item.foto_url);
        previewWrap.style.display = "block";
    } else {
        previewWrap.style.display = "none";
        previewImage.src = "";
    }

    formTitle.textContent = "Editar docente";
    window.scrollTo({ top: 0, behavior: "smooth" });
    showStatus(statusBox, "Editando docente seleccionado.", "info");
};

window.deleteDocente = async function(id) {
    const ok = confirm("¿Seguro que deseas eliminar este docente?");
    if (!ok) return;

    try {
        const res = await fetch(`${API}/docentes/admin/${id}`, {
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
            throw new Error(data.message || "No se pudo eliminar el docente.");
        }

        showStatus(statusBox, "Docente eliminado correctamente.", "success");
        loadDocentes();
        resetForm();
    } catch (error) {
        console.error(error);
        showStatus(statusBox, error.message, "error");
    }
};

form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus(statusBox);

    const id = document.getElementById("docente-id").value;
    const centro = getSelectedFormCenter();

    if (!allowedCenters.includes(centro)) {
        showStatus(statusBox, "No tienes permisos para usar ese centro.", "error");
        return;
    }

    const selectedOrder = manualOrderToggle.checked
        ? (document.getElementById("orden_visual").value || getNextOrder(getItemsByCenter(docentesCache, centro)))
        : (
            id
                ? Number(document.getElementById("orden_visual").value || 0)
                : getNextOrder(getItemsByCenter(docentesCache, centro))
        );

    const formData = new FormData();
    formData.append("centro", centro);
    formData.append("nombre", document.getElementById("nombre").value.trim());
    formData.append("cargo", document.getElementById("cargo").value.trim());
    formData.append("correo", document.getElementById("correo").value.trim());
    formData.append("telefono", document.getElementById("telefono").value.trim());
    formData.append("descripcion", document.getElementById("descripcion").value.trim());
    formData.append("orden_visual", selectedOrder);
    formData.append("activo", document.getElementById("activo").checked);
    formData.append("foto_actual", document.getElementById("foto_actual").value);

    if (fotoInput.files[0]) {
        formData.append("foto", fotoInput.files[0]);
    }

    try {
        const res = await fetch(
            id ? `${API}/docentes/admin/${id}` : `${API}/docentes/admin`,
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
            throw new Error(data.message || "No se pudo guardar el docente.");
        }

        showStatus(statusBox, id ? "Docente actualizado correctamente." : "Docente creado correctamente.", "success");
        resetForm();
        loadDocentes();
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
loadDocentes();