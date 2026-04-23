const API = `${window.location.origin}/informatica-api`.replace(/\/+$/, "");
const UPLOADS_BASE = `${window.location.origin}/informatica-uploads`.replace(/\/+$/, "");
const token = localStorage.getItem("token");
const adminUserRaw = localStorage.getItem("adminUser");

/* =========================
   ELEMENTOS JEFATURA
========================= */
const form = document.getElementById("jefatura-form");
const list = document.getElementById("jefatura-list");
const statusBox = document.getElementById("status-box");
const formTitle = document.getElementById("form-title");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const logoutBtn = document.getElementById("logout-btn");
const fotoInput = document.getElementById("foto");
const previewWrap = document.getElementById("preview-wrap");
const previewImage = document.getElementById("preview-image");
const cargoSelect = document.getElementById("cargo");
const ordenVisualInput = document.getElementById("orden_visual");
const manualOrderToggle = document.getElementById("manual-order-toggle");
const centroSelect = document.getElementById("centro");
const filterCentroSelect = document.getElementById("filter-centro");

/* =========================
   ELEMENTOS UBICACIÓN
========================= */
const ubicacionForm = document.getElementById("ubicacion-form");
const ubicacionStatusBox = document.getElementById("ubicacion-status-box");
const ubicacionCentroSelect = document.getElementById("ubicacion-centro");
const ubicacionTituloInput = document.getElementById("ubicacion-titulo");
const ubicacionDescripcionInput = document.getElementById("ubicacion-descripcion");
const ubicacionImagenInput = document.getElementById("ubicacion-imagen");
const ubicacionActivoInput = document.getElementById("ubicacion-activo");
const imagenActualUbicacionInput = document.getElementById("imagen_actual_ubicacion");
const ubicacionIdInput = document.getElementById("ubicacion-id");
const previewUbicacionWrap = document.getElementById("preview-ubicacion-wrap");
const previewUbicacionImage = document.getElementById("preview-ubicacion-image");
const ubicacionCurrent = document.getElementById("ubicacion-current");
const reloadUbicacionBtn = document.getElementById("reload-ubicacion-btn");

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
    if (token) headers.Authorization = "Bearer " + token;
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
    [centroSelect, filterCentroSelect, ubicacionCentroSelect].forEach(select => {
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

const CARGO_ORDER_MAP = {
    "Jefe de la Carrera": 1,
    "Coordinador/a de la Carrera": 2
};

function getSelectedFilterCenter() {
    return filterCentroSelect?.value || allowedCenters[0] || "vs";
}

function getSelectedFormCenter() {
    return centroSelect?.value || allowedCenters[0] || "vs";
}

function getSelectedUbicacionCenter() {
    return ubicacionCentroSelect?.value || allowedCenters[0] || "vs";
}

function getCurrentEditId() {
    return document.getElementById("jefatura-id").value || "";
}

function isEditing() {
    return !!getCurrentEditId();
}

function getCenterLabel(centro) {
    const map = {
        vs: "UNAH-VS",
        cu: "Ciudad Universitaria",
        danli: "UNAH Danlí"
    };

    return map[String(centro || "").toLowerCase()] || "Sin centro";
}

function getCargoOrder(cargo) {
    return CARGO_ORDER_MAP[cargo] ?? 999;
}

function updateOrderFieldState() {
    const manual = manualOrderToggle.checked;
    ordenVisualInput.readOnly = !manual;

    if (!manual) {
        if (isEditing()) return;
        applySuggestedOrder();
    }
}

function applySuggestedOrder() {
    if (manualOrderToggle.checked) return;

    const cargo = cargoSelect.value;
    if (!cargo) {
        ordenVisualInput.value = 0;
        return;
    }

    ordenVisualInput.value = getCargoOrder(cargo);
}

cargoSelect?.addEventListener("change", () => {
    if (!isEditing()) {
        applySuggestedOrder();
    }
});
manualOrderToggle?.addEventListener("change", updateOrderFieldState);

filterCentroSelect?.addEventListener("change", () => {
    if (!isEditing() && centroSelect) {
        centroSelect.value = getSelectedFilterCenter();
    }

    if (ubicacionCentroSelect) {
        ubicacionCentroSelect.value = getSelectedFilterCenter();
    }

    loadJefatura();
    loadUbicacion();
});

function showStatus(message, type = "info") {
    statusBox.textContent = message;
    statusBox.className = `admin-status show ${type}`;
}

function clearStatus() {
    statusBox.textContent = "";
    statusBox.className = "admin-status";
}

function showUbicacionStatus(message, type = "info") {
    ubicacionStatusBox.textContent = message;
    ubicacionStatusBox.className = `admin-status show ${type}`;
}

function clearUbicacionStatus() {
    ubicacionStatusBox.textContent = "";
    ubicacionStatusBox.className = "admin-status";
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

function getImageUrl(fotoUrl) {
    if (!fotoUrl) return "../assets/images/docente1.jpg";
    if (fotoUrl.startsWith("http://") || fotoUrl.startsWith("https://")) return fotoUrl;

    const normalized = String(fotoUrl).replace(/^\/uploads/, "").replace(/^\/+/, "");
    return `${UPLOADS_BASE}/${normalized}`;
}

function resetForm() {
    form.reset();
    document.getElementById("jefatura-id").value = "";
    document.getElementById("foto_actual").value = "";
    document.getElementById("activo").checked = true;
    document.getElementById("orden_visual").value = 0;
    document.getElementById("manual-order-toggle").checked = false;

    if (centroSelect) {
        centroSelect.value = getSelectedFilterCenter();
    }

    previewWrap.style.display = "none";
    previewImage.src = "";
    formTitle.textContent = "Nuevo registro";
    updateOrderFieldState();
    clearStatus();
}

function resetUbicacionForm(keepCenter = true) {
    ubicacionForm.reset();
    ubicacionIdInput.value = "";
    imagenActualUbicacionInput.value = "";
    ubicacionTituloInput.value = "Ubicación del departamento";
    ubicacionActivoInput.checked = true;

    if (keepCenter && ubicacionCentroSelect) {
        ubicacionCentroSelect.value = getSelectedFilterCenter();
    }

    previewUbicacionWrap.style.display = "none";
    previewUbicacionImage.src = "";
    clearUbicacionStatus();
}

cancelEditBtn?.addEventListener("click", resetForm);
reloadUbicacionBtn?.addEventListener("click", () => {
    if (ubicacionCentroSelect) {
        ubicacionCentroSelect.value = getSelectedFilterCenter();
    }
    loadUbicacion();
});

fotoInput?.addEventListener("change", () => {
    const file = fotoInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        previewImage.src = e.target.result;
        previewWrap.style.display = "block";
    };
    reader.readAsDataURL(file);
});

ubicacionImagenInput?.addEventListener("change", () => {
    const file = ubicacionImagenInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        previewUbicacionImage.src = e.target.result;
        previewUbicacionWrap.style.display = "block";
    };
    reader.readAsDataURL(file);
});

ubicacionCentroSelect?.addEventListener("change", loadUbicacion);

function sortJefatura(items) {
    return [...items].sort((a, b) => {
        const orderA = Number(a.orden_visual ?? getCargoOrder(a.cargo));
        const orderB = Number(b.orden_visual ?? getCargoOrder(b.cargo));

        if (orderA !== orderB) return orderA - orderB;

        return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base" });
    });
}

function validateJefaturaForm() {
    const nombre = document.getElementById("nombre").value.trim();
    const cargo = document.getElementById("cargo").value.trim();
    const correo = document.getElementById("correo").value.trim();

    if (!nombre) throw new Error("El nombre completo es obligatorio.");
    if (nombre.length < 5) throw new Error("El nombre completo debe tener al menos 5 caracteres.");
    if (!cargo) throw new Error("Debes seleccionar un cargo.");
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new Error("El correo no tiene un formato válido.");
}

function validateUbicacionForm() {
    const titulo = ubicacionTituloInput.value.trim();
    const descripcion = ubicacionDescripcionInput.value.trim();

    if (!titulo) throw new Error("El título de ubicación es obligatorio.");
    if (descripcion && descripcion.length < 10) throw new Error("La descripción de ubicación debe tener al menos 10 caracteres si se completa.");
}

async function safeJson(res) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`La respuesta no es JSON válido. Respuesta recibida: ${text.slice(0, 140)}`);
    }
}

async function loadJefatura() {
    list.innerHTML = `<div class="admin-empty">Cargando registros...</div>`;

    const centroActivo = getSelectedFilterCenter();

    try {
        const res = await fetch(`${API}/jefatura/admin/list?centro=${encodeURIComponent(centroActivo)}`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (res.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudieron cargar los registros.");
        }

        if (!Array.isArray(data.items) || data.items.length === 0) {
            list.innerHTML = `<div class="admin-empty">No hay registros de jefatura o coordinación para ${escapeHtml(getCenterLabel(centroActivo))}.</div>`;
            return;
        }

        const sortedItems = sortJefatura(data.items);

        list.innerHTML = sortedItems.map(item => `
            <article class="admin-item">
                <div class="admin-item-layout">
                    <img class="admin-photo" src="${escapeHtml(getImageUrl(item.foto_url))}" alt="${escapeHtml(item.nombre)}">

                    <div>
                        <div class="admin-item-top">
                            <div>
                                <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                                <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activo" : "Inactivo"}</span>
                                <span class="admin-badge">Orden: ${escapeHtml(item.orden_visual ?? getCargoOrder(item.cargo))}</span>
                            </div>
                        </div>

                        <h3>${escapeHtml(item.nombre)}</h3>
                        <p><strong>Cargo:</strong> ${escapeHtml(item.cargo || "Sin cargo")}</p>
                        ${item.correo ? `<p><strong>Correo:</strong> ${escapeHtml(item.correo)}</p>` : ""}
                        ${item.telefono ? `<p><strong>Teléfono:</strong> ${escapeHtml(item.telefono)}</p>` : ""}
                        ${item.descripcion ? `<p><strong>Descripción:</strong> ${escapeHtml(item.descripcion)}</p>` : ""}

                        <div class="admin-item-actions">
                            <button class="btn-warning" onclick='editJefatura(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Editar</button>
                            <button class="btn-danger" onclick="deleteJefatura(${item.id})">Eliminar</button>
                        </div>
                    </div>
                </div>
            </article>
        `).join("");
    } catch (error) {
        console.error(error);
        list.innerHTML = `<div class="admin-empty">Error al cargar registros.</div>`;
        showStatus(error.message, "error");
    }
}

async function loadUbicacion() {
    const centroActivo = getSelectedUbicacionCenter();

    ubicacionCurrent.innerHTML = `<div class="admin-empty">Cargando ubicación...</div>`;

    try {
        const res = await fetch(`${API}/jefatura/admin/ubicacion?centro=${encodeURIComponent(centroActivo)}`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (res.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudo cargar la ubicación.");
        }

        resetUbicacionForm(false);

        if (!data.item) {
            ubicacionIdInput.value = "";
            imagenActualUbicacionInput.value = "";
            ubicacionTituloInput.value = "Ubicación del departamento";
            ubicacionDescripcionInput.value = "";
            ubicacionActivoInput.checked = true;

            ubicacionCurrent.innerHTML = `
                <div class="admin-empty">
                    No hay ubicación registrada para ${escapeHtml(getCenterLabel(centroActivo))}. Puedes crearla desde este mismo formulario.
                </div>
            `;
            return;
        }

        const item = data.item;

        ubicacionIdInput.value = item.id || "";
        imagenActualUbicacionInput.value = item.imagen_url || "";
        ubicacionTituloInput.value = item.titulo || "Ubicación del departamento";
        ubicacionDescripcionInput.value = item.descripcion || "";
        ubicacionActivoInput.checked = !!item.activo;

        if (item.imagen_url) {
            previewUbicacionImage.src = getImageUrl(item.imagen_url);
            previewUbicacionWrap.style.display = "block";
        }

        ubicacionCurrent.innerHTML = `
            <article class="admin-item">
                <div class="admin-item-layout">
                    <img class="admin-photo" src="${escapeHtml(getImageUrl(item.imagen_url))}" alt="${escapeHtml(item.titulo || "Ubicación del departamento")}">

                    <div>
                        <div class="admin-item-top">
                            <div>
                                <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                                <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activo" : "Inactivo"}</span>
                            </div>
                        </div>

                        <h3>${escapeHtml(item.titulo || "Ubicación del departamento")}</h3>
                        ${item.descripcion ? `<p><strong>Descripción:</strong> ${escapeHtml(item.descripcion)}</p>` : "<p><strong>Descripción:</strong> Sin descripción.</p>"}
                    </div>
                </div>
            </article>
        `;
    } catch (error) {
        console.error(error);
        ubicacionCurrent.innerHTML = `<div class="admin-empty">Error al cargar la ubicación.</div>`;
        showUbicacionStatus(error.message, "error");
    }
}

window.editJefatura = function (item) {
    if (!allowedCenters.includes(String(item.centro || "").toLowerCase())) {
        showStatus("No tienes permisos para editar este centro.", "error");
        return;
    }

    document.getElementById("jefatura-id").value = item.id;
    document.getElementById("foto_actual").value = item.foto_url || "";
    document.getElementById("centro").value = item.centro || getSelectedFilterCenter();
    document.getElementById("nombre").value = item.nombre || "";
    document.getElementById("cargo").value = item.cargo || "";
    document.getElementById("correo").value = item.correo || "";
    document.getElementById("telefono").value = item.telefono || "";
    document.getElementById("descripcion").value = item.descripcion || "";
    document.getElementById("orden_visual").value = item.orden_visual ?? getCargoOrder(item.cargo);
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

    formTitle.textContent = "Editar registro";
    window.scrollTo({ top: 0, behavior: "smooth" });
    showStatus("Editando registro seleccionado.", "info");
};

window.deleteJefatura = async function (id) {
    const ok = confirm("¿Seguro que deseas eliminar este registro?");
    if (!ok) return;

    try {
        const res = await fetch(`${API}/jefatura/admin/${id}`, {
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
            throw new Error(data.message || "No se pudo eliminar el registro.");
        }

        showStatus("Registro eliminado correctamente.", "success");
        loadJefatura();
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
        validateJefaturaForm();

        const id = getCurrentEditId();
        const centro = getSelectedFormCenter();

        if (!allowedCenters.includes(centro)) {
            throw new Error("No tienes permisos para usar ese centro.");
        }

        const selectedCargo = document.getElementById("cargo").value;
        const selectedOrder = manualOrderToggle.checked
            ? Number(document.getElementById("orden_visual").value || getCargoOrder(selectedCargo))
            : (
                isEditing()
                    ? Number(document.getElementById("orden_visual").value || getCargoOrder(selectedCargo))
                    : getCargoOrder(selectedCargo)
            );

        const formData = new FormData();
        formData.append("centro", centro);
        formData.append("nombre", document.getElementById("nombre").value.trim());
        formData.append("cargo", selectedCargo);
        formData.append("correo", document.getElementById("correo").value.trim());
        formData.append("telefono", document.getElementById("telefono").value.trim());
        formData.append("descripcion", document.getElementById("descripcion").value.trim());
        formData.append("orden_visual", selectedOrder);
        formData.append("activo", document.getElementById("activo").checked);
        formData.append("foto_actual", document.getElementById("foto_actual").value);

        if (fotoInput.files[0]) {
            formData.append("foto", fotoInput.files[0]);
        }

        const res = await fetch(
            id ? `${API}/jefatura/admin/${id}` : `${API}/jefatura/admin`,
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
            throw new Error(data.message || "No se pudo guardar el registro.");
        }

        showStatus(id ? "Registro actualizado correctamente." : "Registro creado correctamente.", "success");
        resetForm();
        loadJefatura();
    } catch (error) {
        console.error(error);
        showStatus(error.message, "error");
    }
});

ubicacionForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearUbicacionStatus();

    try {
        validateUbicacionForm();

        const centro = getSelectedUbicacionCenter();

        if (!allowedCenters.includes(centro)) {
            throw new Error("No tienes permisos para usar ese centro.");
        }

        const formData = new FormData();
        formData.append("centro", centro);
        formData.append("titulo", ubicacionTituloInput.value.trim());
        formData.append("descripcion", ubicacionDescripcionInput.value.trim());
        formData.append("activo", ubicacionActivoInput.checked);
        formData.append("imagen_actual", imagenActualUbicacionInput.value || "");

        if (ubicacionImagenInput.files[0]) {
            formData.append("imagen", ubicacionImagenInput.files[0]);
        }

        const res = await fetch(`${API}/jefatura/admin/ubicacion`, {
            method: "POST",
            headers: getAuthHeaders(),
            credentials: "include",
            body: formData
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (res.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudo guardar la ubicación.");
        }

        showUbicacionStatus("Ubicación guardada correctamente.", "success");
        loadUbicacion();
    } catch (error) {
        console.error(error);
        showUbicacionStatus(error.message, "error");
    }
});

applyCenterRestrictions();

if (centroSelect && filterCentroSelect) {
    centroSelect.value = filterCentroSelect.value;
}

if (ubicacionCentroSelect && filterCentroSelect) {
    ubicacionCentroSelect.value = filterCentroSelect.value;
}

updateOrderFieldState();
loadJefatura();
loadUbicacion();