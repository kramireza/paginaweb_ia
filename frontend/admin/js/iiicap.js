const API = `${window.location.origin}/informatica-api`.replace(/\/+$/, "");
const FILES_BASE = `${window.location.origin}/informatica-uploads`.replace(/\/+$/, "");
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
        headers.Authorization = "Bearer " + token;
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

/* =========================
   UTILIDADES GENERALES
========================= */
function applyCenterRestrictions(selects = []) {
    selects.forEach(select => {
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

function ensureAllowedCenter(center) {
    return allowedCenters.includes(String(center || "").toLowerCase());
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

async function safeJson(res) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`La respuesta no es JSON válido. Respuesta recibida: ${text.slice(0, 120)}`);
    }
}

function showStatus(box, message, type = "info") {
    box.textContent = message;
    box.className = `admin-status show ${type}`;
}

function clearStatus(box) {
    box.textContent = "";
    box.className = "admin-status";
}

function getImageUrl(fileUrl) {
    if (!fileUrl) return "../assets/images/docente1.jpg";
    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) return fileUrl;

    const normalized = String(fileUrl)
        .replace(/^\/informatica-uploads/, "")
        .replace(/^\/uploads/, "")
        .replace(/^\/+/, "");

    return `${FILES_BASE}/${normalized}`;
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

function handleProtectedResponse(res, data) {
    if (res.status === 403 && String(data?.message || "").toLowerCase().includes("contraseña")) {
        window.location.href = "./change-password.html";
        return true;
    }
    return false;
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

/* =========================
   INFO GENERAL
========================= */
const infoForm = document.getElementById("iiicap-info-form");
const infoIdInput = document.getElementById("iiicap-info-id");
const infoCentroSelect = document.getElementById("iiicap-info-centro");
const infoTituloInput = document.getElementById("iiicap-info-titulo");
const infoDescripcionInput = document.getElementById("iiicap-info-descripcion");
const infoActivoInput = document.getElementById("iiicap-info-activo");
const infoStatusBox = document.getElementById("iiicap-info-status-box");
const infoCurrent = document.getElementById("iiicap-info-current");
const reloadInfoBtn = document.getElementById("reload-iiicap-info-btn");

function getSelectedInfoCenter() {
    return infoCentroSelect?.value || allowedCenters[0] || "vs";
}

function resetInfoForm(keepCenter = true) {
    infoForm.reset();
    infoIdInput.value = "";
    infoTituloInput.value = "IIICAP-IA";
    infoActivoInput.checked = true;

    if (keepCenter && infoCentroSelect) {
        infoCentroSelect.value = getSelectedInfoCenter();
    }

    clearStatus(infoStatusBox);
}

async function loadIiicapInfo() {
    const centroActivo = getSelectedInfoCenter();
    infoCurrent.innerHTML = `<div class="admin-empty">Cargando información...</div>`;

    try {
        const res = await fetch(`${API}/iiicap/admin/info?centro=${encodeURIComponent(centroActivo)}`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (handleProtectedResponse(res, data)) return;
            throw new Error(data.message || "No se pudo cargar la información general.");
        }

        resetInfoForm(false);

        if (!data.item) {
            infoCurrent.innerHTML = `
                <div class="admin-empty">
                    No hay información general registrada para ${escapeHtml(getCenterLabel(centroActivo))}. Puedes crearla desde este formulario.
                </div>
            `;
            return;
        }

        const item = data.item;

        infoIdInput.value = item.id || "";
        infoTituloInput.value = item.titulo || "IIICAP-IA";
        infoDescripcionInput.value = item.descripcion || "";
        infoActivoInput.checked = !!item.activo;

        infoCurrent.innerHTML = `
            <article class="admin-item">
                <div class="admin-item-top">
                    <div>
                        <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                        <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activo" : "Inactivo"}</span>
                    </div>
                </div>
                <h3>${escapeHtml(item.titulo || "IIICAP-IA")}</h3>
                <p><strong>Descripción:</strong> ${escapeHtml(item.descripcion || "")}</p>
            </article>
        `;
    } catch (error) {
        console.error(error);
        infoCurrent.innerHTML = `<div class="admin-empty">Error al cargar la información general.</div>`;
        showStatus(infoStatusBox, error.message, "error");
    }
}

infoCentroSelect?.addEventListener("change", loadIiicapInfo);
reloadInfoBtn?.addEventListener("click", loadIiicapInfo);

infoForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus(infoStatusBox);

    try {
        const titulo = infoTituloInput.value.trim();
        const descripcion = infoDescripcionInput.value.trim();
        const centro = getSelectedInfoCenter();

        if (!ensureAllowedCenter(centro)) throw new Error("No tienes permisos para usar ese centro.");
        if (!titulo) throw new Error("El título es obligatorio.");
        if (!descripcion) throw new Error("La descripción es obligatoria.");
        if (descripcion.length < 20) throw new Error("La descripción debe tener al menos 20 caracteres.");

        const payload = {
            centro,
            titulo,
            descripcion,
            activo: infoActivoInput.checked
        };

        const res = await fetch(`${API}/iiicap/admin/info`, {
            method: "POST",
            headers: getAuthHeaders(true),
            credentials: "include",
            body: JSON.stringify(payload)
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (handleProtectedResponse(res, data)) return;
            throw new Error(data.message || "No se pudo guardar la información general.");
        }

        showStatus(infoStatusBox, "Información general guardada correctamente.", "success");
        loadIiicapInfo();
    } catch (error) {
        console.error(error);
        showStatus(infoStatusBox, error.message, "error");
    }
});

/* =========================
   ENCARGADOS
========================= */
const encargadoForm = document.getElementById("encargado-form");
const encargadoList = document.getElementById("encargados-list");
const encargadoStatusBox = document.getElementById("encargado-status-box");
const encargadoFormTitle = document.getElementById("encargado-form-title");
const cancelEncargadoEditBtn = document.getElementById("cancel-encargado-edit-btn");
const encargadoOrdenInput = document.getElementById("encargado-orden");
const encargadoManualOrderToggle = document.getElementById("encargado-manual-order-toggle");
const encargadoCentroSelect = document.getElementById("encargado-centro");
const filterEncargadoCentroSelect = document.getElementById("filter-encargado-centro");
const encargadoFotoInput = document.getElementById("encargado-foto");
const encargadoPreviewWrap = document.getElementById("encargado-preview-wrap");
const encargadoPreviewImage = document.getElementById("encargado-preview-image");

let encargadosCache = [];

function getSelectedEncargadoFilterCenter() {
    return filterEncargadoCentroSelect?.value || allowedCenters[0] || "vs";
}

function getSelectedEncargadoFormCenter() {
    return encargadoCentroSelect?.value || allowedCenters[0] || "vs";
}

function getCurrentEncargadoEditId() {
    return document.getElementById("encargado-id").value || "";
}

function isEditingEncargado() {
    return !!getCurrentEncargadoEditId();
}

function updateEncargadoOrderFieldState() {
    const manual = encargadoManualOrderToggle.checked;
    encargadoOrdenInput.readOnly = !manual;

    if (!manual) {
        if (isEditingEncargado()) return;
        const centroActivo = getSelectedEncargadoFormCenter();
        const filtered = getItemsByCenter(encargadosCache, centroActivo);
        encargadoOrdenInput.value = getNextOrder(filtered);
    }
}

function resetEncargadoForm() {
    encargadoForm.reset();
    document.getElementById("encargado-id").value = "";
    document.getElementById("encargado-foto-actual").value = "";
    document.getElementById("encargado-activo").checked = true;
    document.getElementById("encargado-manual-order-toggle").checked = false;

    if (encargadoCentroSelect) {
        encargadoCentroSelect.value = getSelectedEncargadoFilterCenter();
    }

    encargadoPreviewWrap.style.display = "none";
    encargadoPreviewImage.src = "";
    encargadoFormTitle.textContent = "Nuevo encargado";
    updateEncargadoOrderFieldState();
    clearStatus(encargadoStatusBox);
}

encargadoManualOrderToggle?.addEventListener("change", updateEncargadoOrderFieldState);

encargadoCentroSelect?.addEventListener("change", () => {
    if (!isEditingEncargado()) {
        updateEncargadoOrderFieldState();
    }
});

filterEncargadoCentroSelect?.addEventListener("change", () => {
    if (!isEditingEncargado() && encargadoCentroSelect) {
        encargadoCentroSelect.value = getSelectedEncargadoFilterCenter();
        updateEncargadoOrderFieldState();
    }
    loadEncargados();
});

cancelEncargadoEditBtn?.addEventListener("click", resetEncargadoForm);

encargadoFotoInput?.addEventListener("change", () => {
    const file = encargadoFotoInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        encargadoPreviewImage.src = e.target.result;
        encargadoPreviewWrap.style.display = "block";
    };
    reader.readAsDataURL(file);
});

function sortEncargados(items) {
    return [...items].sort((a, b) => {
        const orderA = Number(a.orden_visual || 0);
        const orderB = Number(b.orden_visual || 0);
        if (orderA !== orderB) return orderA - orderB;
        return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base" });
    });
}

async function loadEncargados() {
    encargadoList.innerHTML = `<div class="admin-empty">Cargando encargados...</div>`;

    const centroActivo = getSelectedEncargadoFilterCenter();

    try {
        const res = await fetch(`${API}/iiicap/admin/encargados/list?centro=${encodeURIComponent(centroActivo)}`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (handleProtectedResponse(res, data)) return;
            throw new Error(data.message || "No se pudieron cargar los encargados.");
        }

        encargadosCache = Array.isArray(data.items) ? data.items : [];

        if (encargadosCache.length === 0) {
            encargadoList.innerHTML = `<div class="admin-empty">No hay encargados registrados para ${escapeHtml(getCenterLabel(centroActivo))}.</div>`;
            updateEncargadoOrderFieldState();
            return;
        }

        const sortedItems = sortEncargados(encargadosCache);

        encargadoList.innerHTML = sortedItems.map(item => `
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
                        <p><strong>Cargo:</strong> ${escapeHtml(item.cargo || "Sin cargo")}</p>
                        ${item.correo ? `<p><strong>Correo:</strong> ${escapeHtml(item.correo)}</p>` : ""}
                        ${item.telefono ? `<p><strong>Teléfono:</strong> ${escapeHtml(item.telefono)}</p>` : ""}
                        ${item.descripcion ? `<p><strong>Descripción:</strong> ${escapeHtml(item.descripcion)}</p>` : ""}

                        <div class="admin-item-actions">
                            <button class="btn-warning" onclick='editIiicapEncargado(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Editar</button>
                            <button class="btn-danger" onclick="deleteIiicapEncargado(${item.id})">Eliminar</button>
                        </div>
                    </div>
                </div>
            </article>
        `).join("");

        updateEncargadoOrderFieldState();
    } catch (error) {
        console.error(error);
        encargadoList.innerHTML = `<div class="admin-empty">Error al cargar encargados.</div>`;
        showStatus(encargadoStatusBox, error.message, "error");
    }
}

window.editIiicapEncargado = function(item) {
    if (!ensureAllowedCenter(item.centro)) {
        showStatus(encargadoStatusBox, "No tienes permisos para editar ese centro.", "error");
        return;
    }

    document.getElementById("encargado-id").value = item.id;
    document.getElementById("encargado-foto-actual").value = item.foto_url || "";
    document.getElementById("encargado-centro").value = item.centro || getSelectedEncargadoFilterCenter();
    document.getElementById("encargado-nombre").value = item.nombre || "";
    document.getElementById("encargado-cargo").value = item.cargo || "";
    document.getElementById("encargado-correo").value = item.correo || "";
    document.getElementById("encargado-telefono").value = item.telefono || "";
    document.getElementById("encargado-descripcion").value = item.descripcion || "";
    document.getElementById("encargado-orden").value = item.orden_visual ?? 0;
    document.getElementById("encargado-activo").checked = !!item.activo;
    document.getElementById("encargado-manual-order-toggle").checked = false;
    updateEncargadoOrderFieldState();

    if (item.foto_url) {
        encargadoPreviewImage.src = getImageUrl(item.foto_url);
        encargadoPreviewWrap.style.display = "block";
    } else {
        encargadoPreviewWrap.style.display = "none";
        encargadoPreviewImage.src = "";
    }

    encargadoFormTitle.textContent = "Editar encargado";
    window.scrollTo({ top: 0, behavior: "smooth" });
    showStatus(encargadoStatusBox, "Editando encargado seleccionado.", "info");
};

window.deleteIiicapEncargado = async function(id) {
    const ok = confirm("¿Seguro que deseas eliminar este encargado?");
    if (!ok) return;

    try {
        const res = await fetch(`${API}/iiicap/admin/encargados/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (handleProtectedResponse(res, data)) return;
            throw new Error(data.message || "No se pudo eliminar el encargado.");
        }

        showStatus(encargadoStatusBox, "Encargado eliminado correctamente.", "success");
        loadEncargados();
        resetEncargadoForm();
    } catch (error) {
        console.error(error);
        showStatus(encargadoStatusBox, error.message, "error");
    }
};

encargadoForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus(encargadoStatusBox);

    try {
        const nombre = document.getElementById("encargado-nombre").value.trim();
        const cargo = document.getElementById("encargado-cargo").value.trim();
        const correo = document.getElementById("encargado-correo").value.trim();
        const id = getCurrentEncargadoEditId();
        const centro = getSelectedEncargadoFormCenter();

        if (!ensureAllowedCenter(centro)) throw new Error("No tienes permisos para usar ese centro.");
        if (!nombre) throw new Error("El nombre es obligatorio.");
        if (nombre.length < 5) throw new Error("El nombre debe tener al menos 5 caracteres.");
        if (!cargo) throw new Error("El cargo es obligatorio.");
        if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
            throw new Error("El correo no tiene un formato válido.");
        }

        const selectedOrder = encargadoManualOrderToggle.checked
            ? Number(document.getElementById("encargado-orden").value || getNextOrder(getItemsByCenter(encargadosCache, centro)))
            : (
                isEditingEncargado()
                    ? Number(document.getElementById("encargado-orden").value || 0)
                    : getNextOrder(getItemsByCenter(encargadosCache, centro))
            );

        const formData = new FormData();
        formData.append("centro", centro);
        formData.append("nombre", nombre);
        formData.append("cargo", cargo);
        formData.append("correo", correo);
        formData.append("telefono", document.getElementById("encargado-telefono").value.trim());
        formData.append("descripcion", document.getElementById("encargado-descripcion").value.trim());
        formData.append("orden_visual", Number(selectedOrder));
        formData.append("activo", document.getElementById("encargado-activo").checked);
        formData.append("foto_actual", document.getElementById("encargado-foto-actual").value);

        if (encargadoFotoInput.files[0]) {
            formData.append("foto", encargadoFotoInput.files[0]);
        }

        const res = await fetch(
            id ? `${API}/iiicap/admin/encargados/${id}` : `${API}/iiicap/admin/encargados`,
            {
                method: id ? "PUT" : "POST",
                headers: getAuthHeaders(),
                credentials: "include",
                body: formData
            }
        );

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (handleProtectedResponse(res, data)) return;
            throw new Error(data.message || "No se pudo guardar el encargado.");
        }

        showStatus(encargadoStatusBox, id ? "Encargado actualizado correctamente." : "Encargado creado correctamente.", "success");
        resetEncargadoForm();
        loadEncargados();
    } catch (error) {
        console.error(error);
        showStatus(encargadoStatusBox, error.message, "error");
    }
});

/* =========================
   INVESTIGACIONES
========================= */
const investigacionForm = document.getElementById("investigacion-form");
const investigacionesList = document.getElementById("investigaciones-list");
const investigacionStatusBox = document.getElementById("investigacion-status-box");
const investigacionFormTitle = document.getElementById("investigacion-form-title");
const cancelInvestigacionEditBtn = document.getElementById("cancel-investigacion-edit-btn");
const investigacionOrdenInput = document.getElementById("investigacion-orden");
const investigacionManualOrderToggle = document.getElementById("investigacion-manual-order-toggle");
const investigacionCentroSelect = document.getElementById("investigacion-centro");
const filterInvestigacionCentroSelect = document.getElementById("filter-investigacion-centro");
const investigacionArchivoInput = document.getElementById("investigacion-archivo");
const investigacionArchivoActualBox = document.getElementById("investigacion-archivo-actual-box");

let investigacionesCache = [];

function getSelectedInvestigacionFilterCenter() {
    return filterInvestigacionCentroSelect?.value || allowedCenters[0] || "vs";
}

function getSelectedInvestigacionFormCenter() {
    return investigacionCentroSelect?.value || allowedCenters[0] || "vs";
}

function getCurrentInvestigacionEditId() {
    return document.getElementById("investigacion-id").value || "";
}

function isEditingInvestigacion() {
    return !!getCurrentInvestigacionEditId();
}

function updateInvestigacionOrderFieldState() {
    const manual = investigacionManualOrderToggle.checked;
    investigacionOrdenInput.readOnly = !manual;

    if (!manual) {
        if (isEditingInvestigacion()) return;
        const centroActivo = getSelectedInvestigacionFormCenter();
        const filtered = getItemsByCenter(investigacionesCache, centroActivo);
        investigacionOrdenInput.value = getNextOrder(filtered);
    }
}

function renderInvestigacionArchivoActual(item) {
    if (!item || (!item.archivo_url && !item.archivo_nombre_original)) {
        investigacionArchivoActualBox.innerHTML = "";
        investigacionArchivoActualBox.classList.add("hidden");
        return;
    }

    investigacionArchivoActualBox.innerHTML = `
        <div class="admin-file-card">
            <strong>Archivo actual:</strong>
            <div class="admin-file-meta">
                <span>${escapeHtml(item.archivo_nombre_original || "Archivo cargado")}</span>
                ${item.tipo_archivo ? `<span class="admin-badge">${escapeHtml(getFileTypeLabel(item.tipo_archivo))}</span>` : ""}
            </div>
            ${item.archivo_url ? `<a href="${FILES_BASE}/${escapeHtml(String(item.archivo_url).replace(/^\/informatica-uploads/, "").replace(/^\/uploads/, "").replace(/^\/+/, ""))}" target="_blank" rel="noopener noreferrer">Ver / descargar archivo actual</a>` : ""}
        </div>
    `;

    investigacionArchivoActualBox.classList.remove("hidden");
}

function resetInvestigacionForm() {
    investigacionForm.reset();
    document.getElementById("investigacion-id").value = "";
    document.getElementById("investigacion-activo").checked = true;
    document.getElementById("investigacion-manual-order-toggle").checked = false;

    if (investigacionCentroSelect) {
        investigacionCentroSelect.value = getSelectedInvestigacionFilterCenter();
    }

    investigacionFormTitle.textContent = "Nueva investigación";
    renderInvestigacionArchivoActual(null);
    updateInvestigacionOrderFieldState();
    clearStatus(investigacionStatusBox);
}

investigacionManualOrderToggle?.addEventListener("change", updateInvestigacionOrderFieldState);

investigacionCentroSelect?.addEventListener("change", () => {
    if (!isEditingInvestigacion()) {
        updateInvestigacionOrderFieldState();
    }
});

filterInvestigacionCentroSelect?.addEventListener("change", () => {
    if (!isEditingInvestigacion() && investigacionCentroSelect) {
        investigacionCentroSelect.value = getSelectedInvestigacionFilterCenter();
        updateInvestigacionOrderFieldState();
    }
    loadInvestigaciones();
});

cancelInvestigacionEditBtn?.addEventListener("click", resetInvestigacionForm);

function sortInvestigaciones(items) {
    return [...items].sort((a, b) => {
        const orderA = Number(a.orden_visual || 0);
        const orderB = Number(b.orden_visual || 0);
        if (orderA !== orderB) return orderA - orderB;
        return String(a.titulo || "").localeCompare(String(b.titulo || ""), "es", { sensitivity: "base" });
    });
}

async function loadInvestigaciones() {
    investigacionesList.innerHTML = `<div class="admin-empty">Cargando investigaciones...</div>`;

    const centroActivo = getSelectedInvestigacionFilterCenter();

    try {
        const res = await fetch(`${API}/iiicap/admin/investigaciones/list?centro=${encodeURIComponent(centroActivo)}`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (handleProtectedResponse(res, data)) return;
            throw new Error(data.message || "No se pudieron cargar las investigaciones.");
        }

        investigacionesCache = Array.isArray(data.items) ? data.items : [];

        if (investigacionesCache.length === 0) {
            investigacionesList.innerHTML = `<div class="admin-empty">No hay investigaciones registradas para ${escapeHtml(getCenterLabel(centroActivo))}.</div>`;
            updateInvestigacionOrderFieldState();
            return;
        }

        const sortedItems = sortInvestigaciones(investigacionesCache);

        investigacionesList.innerHTML = sortedItems.map(item => `
            <article class="admin-item">
                <div class="admin-item-top">
                    <div>
                        <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                        <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activo" : "Inactivo"}</span>
                        <span class="admin-badge">Orden: ${escapeHtml(item.orden_visual ?? 0)}</span>
                    </div>
                </div>

                <h3>${escapeHtml(item.titulo)}</h3>
                <p><strong>Fecha:</strong> ${escapeHtml(item.fecha || "Sin fecha")}</p>
                <p><strong>Descripción:</strong> ${escapeHtml(item.descripcion || "")}</p>
                ${item.archivo_nombre_original ? `<p><strong>Archivo:</strong> ${escapeHtml(item.archivo_nombre_original)}</p>` : ""}
                ${item.enlace_externo ? `<p><strong>Enlace:</strong> <a href="${escapeHtml(item.enlace_externo)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.enlace_externo)}</a></p>` : ""}

                <div class="admin-item-actions">
                    <button class="btn-warning" onclick='editIiicapInvestigacion(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Editar</button>
                    <button class="btn-danger" onclick="deleteIiicapInvestigacion(${item.id})">Eliminar</button>
                </div>
            </article>
        `).join("");

        updateInvestigacionOrderFieldState();
    } catch (error) {
        console.error(error);
        investigacionesList.innerHTML = `<div class="admin-empty">Error al cargar investigaciones.</div>`;
        showStatus(investigacionStatusBox, error.message, "error");
    }
}

window.editIiicapInvestigacion = function(item) {
    if (!ensureAllowedCenter(item.centro)) {
        showStatus(investigacionStatusBox, "No tienes permisos para editar ese centro.", "error");
        return;
    }

    document.getElementById("investigacion-id").value = item.id;
    document.getElementById("investigacion-centro").value = item.centro || getSelectedInvestigacionFilterCenter();
    document.getElementById("investigacion-titulo").value = item.titulo || "";
    document.getElementById("investigacion-descripcion").value = item.descripcion || "";
    document.getElementById("investigacion-fecha").value = item.fecha || "";
    document.getElementById("investigacion-orden").value = item.orden_visual ?? 0;
    document.getElementById("investigacion-enlace").value = item.enlace_externo || "";
    document.getElementById("investigacion-activo").checked = !!item.activo;
    document.getElementById("investigacion-manual-order-toggle").checked = false;
    renderInvestigacionArchivoActual(item);
    updateInvestigacionOrderFieldState();

    investigacionFormTitle.textContent = "Editar investigación";
    window.scrollTo({ top: 0, behavior: "smooth" });
    showStatus(investigacionStatusBox, "Editando investigación seleccionada.", "info");
};

window.deleteIiicapInvestigacion = async function(id) {
    const ok = confirm("¿Seguro que deseas eliminar esta investigación?");
    if (!ok) return;

    try {
        const res = await fetch(`${API}/iiicap/admin/investigaciones/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (handleProtectedResponse(res, data)) return;
            throw new Error(data.message || "No se pudo eliminar la investigación.");
        }

        showStatus(investigacionStatusBox, "Investigación eliminada correctamente.", "success");
        loadInvestigaciones();
        resetInvestigacionForm();
    } catch (error) {
        console.error(error);
        showStatus(investigacionStatusBox, error.message, "error");
    }
};

investigacionForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus(investigacionStatusBox);

    try {
        const titulo = document.getElementById("investigacion-titulo").value.trim();
        const descripcion = document.getElementById("investigacion-descripcion").value.trim();
        const fecha = document.getElementById("investigacion-fecha").value.trim();
        const enlace = document.getElementById("investigacion-enlace").value.trim();
        const archivo = investigacionArchivoInput.files[0];
        const id = getCurrentInvestigacionEditId();
        const centro = getSelectedInvestigacionFormCenter();

        if (!ensureAllowedCenter(centro)) throw new Error("No tienes permisos para usar ese centro.");
        if (!titulo) throw new Error("El título es obligatorio.");
        if (!descripcion) throw new Error("La descripción es obligatoria.");
        if (descripcion.length < 10) throw new Error("La descripción debe tener al menos 10 caracteres.");
        if (!fecha) throw new Error("La fecha es obligatoria.");
        if (!archivo && !enlace && !id) {
            throw new Error("Debes subir un archivo o proporcionar un enlace externo.");
        }

        const selectedOrder = investigacionManualOrderToggle.checked
            ? Number(document.getElementById("investigacion-orden").value || getNextOrder(getItemsByCenter(investigacionesCache, centro)))
            : (
                isEditingInvestigacion()
                    ? Number(document.getElementById("investigacion-orden").value || 0)
                    : getNextOrder(getItemsByCenter(investigacionesCache, centro))
            );

        const formData = new FormData();
        formData.append("centro", centro);
        formData.append("titulo", titulo);
        formData.append("descripcion", descripcion);
        formData.append("fecha", fecha);
        formData.append("enlace_externo", enlace);
        formData.append("orden_visual", Number(selectedOrder));
        formData.append("activo", document.getElementById("investigacion-activo").checked);

        if (archivo) {
            formData.append("archivo", archivo);
        }

        const res = await fetch(
            id ? `${API}/iiicap/admin/investigaciones/${id}` : `${API}/iiicap/admin/investigaciones`,
            {
                method: id ? "PUT" : "POST",
                headers: getAuthHeaders(),
                credentials: "include",
                body: formData
            }
        );

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (handleProtectedResponse(res, data)) return;
            throw new Error(data.message || "No se pudo guardar la investigación.");
        }

        showStatus(investigacionStatusBox, id ? "Investigación actualizada correctamente." : "Investigación creada correctamente.", "success");
        resetInvestigacionForm();
        loadInvestigaciones();
    } catch (error) {
        console.error(error);
        showStatus(investigacionStatusBox, error.message, "error");
    }
});

applyCenterRestrictions([
    infoCentroSelect,
    encargadoCentroSelect,
    filterEncargadoCentroSelect,
    investigacionCentroSelect,
    filterInvestigacionCentroSelect
]);

if (encargadoCentroSelect && filterEncargadoCentroSelect) {
    encargadoCentroSelect.value = filterEncargadoCentroSelect.value;
}

if (investigacionCentroSelect && filterInvestigacionCentroSelect) {
    investigacionCentroSelect.value = filterInvestigacionCentroSelect.value;
}

loadIiicapInfo();
loadEncargados();
loadInvestigaciones();