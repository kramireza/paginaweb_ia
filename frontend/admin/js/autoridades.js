const API = `${window.location.origin}/informatica-api`.replace(/\/+$/, "");
const UPLOADS_BASE = `${window.location.origin}/informatica-uploads`.replace(/\/+$/, "");
const token = localStorage.getItem("token");
const adminUserRaw = localStorage.getItem("adminUser");

/* =========================
   ELEMENTOS AUTORIDADES
========================= */
const form = document.getElementById("autoridad-form");
const list = document.getElementById("autoridades-list");
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
   ELEMENTOS INFO GENERAL
========================= */
const autoridadesInfoForm = document.getElementById("autoridades-info-form");
const autoridadesInfoIdInput = document.getElementById("autoridades-info-id");
const autoridadesInfoCentroSelect = document.getElementById("autoridades-info-centro");
const autoridadesInfoTituloInput = document.getElementById("autoridades-info-titulo");
const autoridadesInfoDescripcionInput = document.getElementById("autoridades-info-descripcion");
const autoridadesInfoActivoInput = document.getElementById("autoridades-info-activo");
const autoridadesInfoStatusBox = document.getElementById("autoridades-info-status-box");
const autoridadesInfoCurrent = document.getElementById("autoridades-info-current");
const reloadAutoridadesInfoBtn = document.getElementById("reload-autoridades-info-btn");

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
    if (includeJson) headers["Content-Type"] = "application/json";
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
    [centroSelect, filterCentroSelect, autoridadesInfoCentroSelect].forEach(select => {
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
    "Presidencia": 1,
    "Vice-Presidencia": 2,
    "Secretaria General": 3,
    "Secretaria de Finanzas": 4,
    "Pro-Secretaria de Finanzas": 5,
    "Fiscalia": 6,
    "Secretaria de Accion Social": 7,
    "Pro-Secretaria de Accion Social": 8,
    "Secretaria de Publicidad": 9,
    "Pro-Secretaria de Publicidad": 10,
    "Secretaria del Interior": 11,
    "Pro-Secretaria del Interior": 12,
    "Secretaria de Relaciones Exteriores": 13,
    "Pro-Secretaria de Relaciones": 14,
    "Vocal": 15
};

function getSelectedFilterCenter() {
    return filterCentroSelect?.value || allowedCenters[0] || "vs";
}

function getSelectedFormCenter() {
    return centroSelect?.value || allowedCenters[0] || "vs";
}

function getSelectedInfoCenter() {
    return autoridadesInfoCentroSelect?.value || allowedCenters[0] || "vs";
}

function getCurrentEditId() {
    return document.getElementById("autoridad-id").value || "";
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

    if (autoridadesInfoCentroSelect) {
        autoridadesInfoCentroSelect.value = getSelectedFilterCenter();
    }

    loadAutoridades();
    loadAutoridadesInfo();
});

autoridadesInfoCentroSelect?.addEventListener("change", loadAutoridadesInfo);

function showStatus(message, type = "info") {
    statusBox.textContent = message;
    statusBox.className = `admin-status show ${type}`;
}

function clearStatus() {
    statusBox.textContent = "";
    statusBox.className = "admin-status";
}

function showInfoStatus(message, type = "info") {
    autoridadesInfoStatusBox.textContent = message;
    autoridadesInfoStatusBox.className = `admin-status show ${type}`;
}

function clearInfoStatus() {
    autoridadesInfoStatusBox.textContent = "";
    autoridadesInfoStatusBox.className = "admin-status";
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
    if (!fotoUrl) return "../assets/images/Wilmer_Presidencia.png";
    if (fotoUrl.startsWith("http://") || fotoUrl.startsWith("https://")) return fotoUrl;

    const normalized = String(fotoUrl).replace(/^\/uploads/, "").replace(/^\/+/, "");
    return `${UPLOADS_BASE}/${normalized}`;
}

function resetForm() {
    form.reset();
    document.getElementById("autoridad-id").value = "";
    document.getElementById("foto_actual").value = "";
    document.getElementById("activo").checked = true;
    document.getElementById("orden_visual").value = 0;
    document.getElementById("manual-order-toggle").checked = false;

    if (centroSelect) {
        centroSelect.value = getSelectedFilterCenter();
    }

    previewWrap.style.display = "none";
    previewImage.src = "";
    formTitle.textContent = "Nueva autoridad";
    updateOrderFieldState();
    clearStatus();
}

function resetInfoForm(keepCenter = true) {
    autoridadesInfoForm.reset();
    autoridadesInfoIdInput.value = "";
    autoridadesInfoTituloInput.value = "Directiva estudiantil";
    autoridadesInfoActivoInput.checked = true;

    if (keepCenter && autoridadesInfoCentroSelect) {
        autoridadesInfoCentroSelect.value = getSelectedFilterCenter();
    }

    clearInfoStatus();
}

cancelEditBtn?.addEventListener("click", resetForm);
reloadAutoridadesInfoBtn?.addEventListener("click", () => {
    if (autoridadesInfoCentroSelect) {
        autoridadesInfoCentroSelect.value = getSelectedFilterCenter();
    }
    loadAutoridadesInfo();
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

function sortAuthorities(items) {
    return [...items].sort((a, b) => {
        const orderA = Number(a.orden_visual ?? getCargoOrder(a.cargo));
        const orderB = Number(b.orden_visual ?? getCargoOrder(b.cargo));

        if (orderA !== orderB) return orderA - orderB;

        const cargoOrderA = getCargoOrder(a.cargo);
        const cargoOrderB = getCargoOrder(b.cargo);

        if (cargoOrderA !== cargoOrderB) return cargoOrderA - cargoOrderB;

        return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base" });
    });
}

function validateAutoridadForm() {
    const nombre = document.getElementById("nombre").value.trim();
    const cargo = document.getElementById("cargo").value.trim();
    const correo = document.getElementById("correo").value.trim();

    if (!nombre) throw new Error("El nombre completo es obligatorio.");
    if (nombre.length < 5) throw new Error("El nombre completo debe tener al menos 5 caracteres.");
    if (!cargo) throw new Error("Debes seleccionar un cargo.");
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        throw new Error("El correo no tiene un formato válido.");
    }
}

function validateInfoForm() {
    const titulo = autoridadesInfoTituloInput.value.trim();
    const descripcion = autoridadesInfoDescripcionInput.value.trim();

    if (!titulo) throw new Error("El título de la descripción general es obligatorio.");
    if (!descripcion) throw new Error("La descripción general es obligatoria.");
    if (descripcion.length < 20) throw new Error("La descripción general debe tener al menos 20 caracteres.");
}

async function safeJson(res) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error("Respuesta inválida del servidor");
    }
}

async function loadAutoridades() {
    list.innerHTML = `<div class="admin-empty">Cargando autoridades...</div>`;

    const centroActivo = getSelectedFilterCenter();

    try {
        const res = await fetch(`${API}/autoridades/admin/list?centro=${encodeURIComponent(centroActivo)}`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (res.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudieron cargar las autoridades.");
        }

        const items = Array.isArray(data.items) ? data.items : [];

        if (items.length === 0) {
            list.innerHTML = `<div class="admin-empty">No hay autoridades registradas para ${escapeHtml(getCenterLabel(centroActivo))}.</div>`;
            return;
        }

        const sortedItems = sortAuthorities(items);

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
                        ${item.periodo ? `<p><strong>Período:</strong> ${escapeHtml(item.periodo)}</p>` : ""}
                        ${item.correo ? `<p><strong>Correo:</strong> ${escapeHtml(item.correo)}</p>` : ""}
                        ${item.telefono ? `<p><strong>Teléfono:</strong> ${escapeHtml(item.telefono)}</p>` : ""}
                        ${item.descripcion ? `<p><strong>Descripción:</strong> ${escapeHtml(item.descripcion)}</p>` : ""}

                        <div class="admin-item-actions">
                            <button class="btn-warning" onclick='editAutoridad(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Editar</button>
                            <button class="btn-danger" onclick="deleteAutoridad(${item.id})">Eliminar</button>
                        </div>
                    </div>
                </div>
            </article>
        `).join("");
    } catch (error) {
        console.error(error);
        list.innerHTML = `<div class="admin-empty">Error al cargar autoridades.</div>`;
        showStatus(error.message, "error");
    }
}

async function loadAutoridadesInfo() {
    const centroActivo = getSelectedInfoCenter();

    autoridadesInfoCurrent.innerHTML = `<div class="admin-empty">Cargando información...</div>`;

    try {
        const res = await fetch(`${API}/autoridades/admin/info?centro=${encodeURIComponent(centroActivo)}`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (res.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudo cargar la información general.");
        }

        resetInfoForm(false);

        if (!data.item) {
            autoridadesInfoIdInput.value = "";
            autoridadesInfoTituloInput.value = "Directiva estudiantil";
            autoridadesInfoDescripcionInput.value = "";
            autoridadesInfoActivoInput.checked = true;

            autoridadesInfoCurrent.innerHTML = `
                <div class="admin-empty">
                    No hay descripción general registrada para ${escapeHtml(getCenterLabel(centroActivo))}. Puedes crearla desde este mismo formulario.
                </div>
            `;
            return;
        }

        const item = data.item;

        autoridadesInfoIdInput.value = item.id || "";
        autoridadesInfoTituloInput.value = item.titulo || "Directiva estudiantil";
        autoridadesInfoDescripcionInput.value = item.descripcion || "";
        autoridadesInfoActivoInput.checked = !!item.activo;

        autoridadesInfoCurrent.innerHTML = `
            <article class="admin-item">
                <div>
                    <div class="admin-item-top">
                        <div>
                            <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                            <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activo" : "Inactivo"}</span>
                        </div>
                    </div>

                    <h3>${escapeHtml(item.titulo || "Directiva estudiantil")}</h3>
                    <p><strong>Descripción:</strong> ${escapeHtml(item.descripcion || "")}</p>
                </div>
            </article>
        `;
    } catch (error) {
        console.error(error);
        autoridadesInfoCurrent.innerHTML = `<div class="admin-empty">Error al cargar la información general.</div>`;
        showInfoStatus(error.message, "error");
    }
}

window.editAutoridad = function (item) {
    if (!allowedCenters.includes(String(item.centro || "").toLowerCase())) {
        showStatus("No tienes permisos para editar este centro.", "error");
        return;
    }

    document.getElementById("autoridad-id").value = item.id;
    document.getElementById("foto_actual").value = item.foto_url || "";
    document.getElementById("centro").value = item.centro || getSelectedFilterCenter();
    document.getElementById("nombre").value = item.nombre || "";
    document.getElementById("cargo").value = item.cargo || "";
    document.getElementById("periodo").value = item.periodo || "";
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

    formTitle.textContent = "Editar autoridad";
    window.scrollTo({ top: 0, behavior: "smooth" });
    showStatus("Editando autoridad seleccionada.", "info");
};

window.deleteAutoridad = async function (id) {
    const ok = confirm("¿Seguro que deseas eliminar esta autoridad?");
    if (!ok) return;

    try {
        const res = await fetch(`${API}/autoridades/admin/${id}`, {
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
            throw new Error(data.message || "No se pudo eliminar la autoridad.");
        }

        showStatus("Autoridad eliminada correctamente.", "success");
        loadAutoridades();
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
        validateAutoridadForm();

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
        formData.append("periodo", document.getElementById("periodo").value.trim());
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
            id ? `${API}/autoridades/admin/${id}` : `${API}/autoridades/admin`,
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
            throw new Error(data.message || "No se pudo guardar la autoridad.");
        }

        showStatus(id ? "Autoridad actualizada correctamente." : "Autoridad creada correctamente.", "success");
        resetForm();
        loadAutoridades();
    } catch (error) {
        console.error(error);
        showStatus(error.message, "error");
    }
});

autoridadesInfoForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearInfoStatus();

    try {
        validateInfoForm();

        const centro = getSelectedInfoCenter();

        if (!allowedCenters.includes(centro)) {
            throw new Error("No tienes permisos para usar ese centro.");
        }

        const payload = {
            centro,
            titulo: autoridadesInfoTituloInput.value.trim(),
            descripcion: autoridadesInfoDescripcionInput.value.trim(),
            activo: autoridadesInfoActivoInput.checked
        };

        const res = await fetch(`${API}/autoridades/admin/info`, {
            method: "POST",
            headers: getAuthHeaders(true),
            credentials: "include",
            body: JSON.stringify(payload)
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (res.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudo guardar la descripción general.");
        }

        showInfoStatus("Descripción general guardada correctamente.", "success");
        loadAutoridadesInfo();
    } catch (error) {
        console.error(error);
        showInfoStatus(error.message, "error");
    }
});

applyCenterRestrictions();

if (centroSelect && filterCentroSelect) {
    centroSelect.value = filterCentroSelect.value;
}

if (autoridadesInfoCentroSelect && filterCentroSelect) {
    autoridadesInfoCentroSelect.value = filterCentroSelect.value;
}

updateOrderFieldState();
loadAutoridades();
loadAutoridadesInfo();