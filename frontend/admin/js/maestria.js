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

/* =========================
   PERMISOS
========================= */
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

/* =========================
   UTILIDADES
========================= */
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
        jpeg: "JPG",
        mp4: "MP4",
        webm: "WEBM",
        ogg: "OGG"
    };
    return map[String(tipo || "").toLowerCase()] || (tipo ? String(tipo).toUpperCase() : "Archivo");
}

function showStatus(box, message, type = "info") {
    box.textContent = message;
    box.className = `admin-status show ${type}`;
}

function clearStatus(box) {
    box.textContent = "";
    box.className = "admin-status";
}

async function safeJson(res) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`La respuesta no es JSON válido. Respuesta recibida: ${text.slice(0, 150)}`);
    }
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

function renderFileCurrentBox(box, item, kind = "archivo") {
    if (!item) {
        box.innerHTML = "";
        box.classList.add("hidden");
        return;
    }

    const urlField = kind === "video" ? item.video_url : item.archivo_url;
    const nameField = kind === "video" ? item.video_nombre_original : item.archivo_nombre_original;
    const typeField = kind === "video" ? item.tipo_video : item.tipo_archivo;

    if (!urlField && !nameField) {
        box.innerHTML = "";
        box.classList.add("hidden");
        return;
    }

    const normalizedUrl = urlField
        ? `${FILES_BASE}/${String(urlField).replace(/^\/informatica-uploads/, "").replace(/^\/uploads/, "").replace(/^\/+/, "")}`
        : "";

    box.innerHTML = `
        <div class="admin-file-card">
            <strong>${kind === "video" ? "Video actual:" : "Archivo actual:"}</strong>
            <div class="admin-file-meta">
                <span>${escapeHtml(nameField || (kind === "video" ? "Video cargado" : "Archivo cargado"))}</span>
                ${typeField ? `<span class="admin-badge">${escapeHtml(getFileTypeLabel(typeField))}</span>` : ""}
            </div>
            ${urlField ? `<a href="${escapeHtml(normalizedUrl)}" target="_blank" rel="noopener noreferrer">Ver actual</a>` : ""}
        </div>
    `;

    box.classList.remove("hidden");
}

function sortByOrderAndTitle(items, titleField = "titulo") {
    return [...items].sort((a, b) => {
        const orderA = Number(a.orden_visual || 0);
        const orderB = Number(b.orden_visual || 0);
        if (orderA !== orderB) return orderA - orderB;

        return String(a[titleField] || "").localeCompare(String(b[titleField] || ""), "es", { sensitivity: "base" });
    });
}

/* =========================
   INFO GENERAL
========================= */
const infoForm = document.getElementById("maestria-info-form");
const infoIdInput = document.getElementById("maestria-info-id");
const infoCentroSelect = document.getElementById("maestria-info-centro");
const infoTituloInput = document.getElementById("maestria-info-titulo");
const infoDescripcionInput = document.getElementById("maestria-info-descripcion");
const infoFinalTituloInput = document.getElementById("maestria-final-titulo");
const infoFinalDescripcionInput = document.getElementById("maestria-final-descripcion");
const infoActivoInput = document.getElementById("maestria-info-activo");
const infoStatusBox = document.getElementById("maestria-info-status-box");
const infoCurrent = document.getElementById("maestria-info-current");
const reloadInfoBtn = document.getElementById("reload-maestria-info-btn");

function getSelectedInfoCenter() {
    return infoCentroSelect?.value || allowedCenters[0] || "vs";
}

async function loadMaestriaInfo() {
    const centroActivo = getSelectedInfoCenter();
    infoCurrent.innerHTML = `<div class="admin-empty">Cargando información...</div>`;

    try {
        const res = await fetch(`${API}/maestria/admin/info?centro=${encodeURIComponent(centroActivo)}`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (handleProtectedResponse(res, data)) return;
            throw new Error(data.message || "No se pudo cargar la información.");
        }

        infoIdInput.value = data.item?.id || "";
        infoTituloInput.value = data.item?.titulo || "Maestría";
        infoDescripcionInput.value = data.item?.descripcion || "";
        infoFinalTituloInput.value = data.item?.mensaje_final_titulo || "";
        infoFinalDescripcionInput.value = data.item?.mensaje_final_descripcion || "";
        infoActivoInput.value = String(data.item?.activo ?? true);

        if (!data.item) {
            infoCurrent.innerHTML = `<div class="admin-empty">No hay información registrada para ${escapeHtml(getCenterLabel(centroActivo))}.</div>`;
            return;
        }

        infoCurrent.innerHTML = `
            <article class="admin-item">
                <div class="admin-item-top">
                    <div>
                        <span class="admin-badge">${escapeHtml(getCenterLabel(data.item.centro))}</span>
                        <span class="admin-badge ${data.item.activo ? "active" : "inactive"}">${data.item.activo ? "Activo" : "Inactivo"}</span>
                    </div>
                </div>
                <h3>${escapeHtml(data.item.titulo || "Maestría")}</h3>
                <p><strong>Descripción:</strong> ${escapeHtml(data.item.descripcion || "")}</p>
                ${data.item.mensaje_final_titulo ? `<p><strong>Bloque final:</strong> ${escapeHtml(data.item.mensaje_final_titulo)}</p>` : ""}
                ${data.item.mensaje_final_descripcion ? `<p><strong>Texto final:</strong> ${escapeHtml(data.item.mensaje_final_descripcion)}</p>` : ""}
            </article>
        `;
    } catch (error) {
        console.error(error);
        infoCurrent.innerHTML = `<div class="admin-empty">Error al cargar la información general.</div>`;
        showStatus(infoStatusBox, error.message, "error");
    }
}

infoCentroSelect?.addEventListener("change", loadMaestriaInfo);
reloadInfoBtn?.addEventListener("click", loadMaestriaInfo);

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
            mensaje_final_titulo: infoFinalTituloInput.value.trim(),
            mensaje_final_descripcion: infoFinalDescripcionInput.value.trim(),
            activo: infoActivoInput.value === "true"
        };

        const res = await fetch(`${API}/maestria/admin/info`, {
            method: "POST",
            headers: getAuthHeaders(true),
            credentials: "include",
            body: JSON.stringify(payload)
        });

        const data = await safeJson(res);
        if (!res.ok || !data.ok) {
            if (handleProtectedResponse(res, data)) return;
            throw new Error(data.message || "No se pudo guardar la información.");
        }

        showStatus(infoStatusBox, "Información general guardada correctamente.", "success");
        loadMaestriaInfo();
    } catch (error) {
        console.error(error);
        showStatus(infoStatusBox, error.message, "error");
    }
});

/* =========================
   FABRICA DE MÓDULOS DE TEXTO
========================= */
function createTextModule(config) {
    const {
        formId,
        listId,
        statusBoxId,
        formTitleId,
        cancelBtnId,
        filterCentroId,
        formCentroId,
        idInputId,
        orderInputId,
        manualToggleId,
        endpointList,
        endpointCreate,
        endpointUpdateBase,
        endpointDeleteBase,
        validate,
        buildPayload,
        fillForm,
        renderItem,
        emptyMessage,
        titleDefault,
        titleField = "titulo"
    } = config;

    const form = document.getElementById(formId);
    const list = document.getElementById(listId);
    const statusBox = document.getElementById(statusBoxId);
    const formTitle = document.getElementById(formTitleId);
    const cancelBtn = document.getElementById(cancelBtnId);
    const filterCentro = document.getElementById(filterCentroId);
    const formCentro = document.getElementById(formCentroId);
    const idInput = document.getElementById(idInputId);
    const orderInput = document.getElementById(orderInputId);
    const manualToggle = document.getElementById(manualToggleId);

    let cache = [];

    function getFilterCenter() {
        return filterCentro?.value || allowedCenters[0] || "vs";
    }

    function getFormCenter() {
        return formCentro?.value || allowedCenters[0] || "vs";
    }

    function getCurrentId() {
        return idInput.value || "";
    }

    function isEditing() {
        return !!getCurrentId();
    }

    function updateOrderFieldState() {
        const manual = manualToggle.checked;
        orderInput.readOnly = !manual;

        if (!manual) {
            if (isEditing()) return;
            const filtered = getItemsByCenter(cache, getFormCenter());
            orderInput.value = getNextOrder(filtered);
        }
    }

    function resetForm() {
        form.reset();
        idInput.value = "";
        manualToggle.checked = false;

        if (formCentro) {
            formCentro.value = getFilterCenter();
        }

        formTitle.textContent = titleDefault;
        updateOrderFieldState();
        clearStatus(statusBox);
    }

    async function load() {
        list.innerHTML = `<div class="admin-empty">Cargando...</div>`;

        try {
            const res = await fetch(`${API}${endpointList}?centro=${encodeURIComponent(getFilterCenter())}`, {
                headers: getAuthHeaders(),
                credentials: "include"
            });

            const data = await safeJson(res);

            if (!res.ok || !data.ok) {
                if (handleProtectedResponse(res, data)) return;
                throw new Error(data.message || "No se pudo cargar la información.");
            }

            cache = Array.isArray(data.items) ? data.items : [];

            if (cache.length === 0) {
                list.innerHTML = `<div class="admin-empty">${emptyMessage(getFilterCenter())}</div>`;
                updateOrderFieldState();
                return;
            }

            const sorted = sortByOrderAndTitle(cache, titleField);
            list.innerHTML = sorted.map(renderItem).join("");
            updateOrderFieldState();
        } catch (error) {
            console.error(error);
            list.innerHTML = `<div class="admin-empty">Error al cargar datos.</div>`;
            showStatus(statusBox, error.message, "error");
        }
    }

    window[`edit_${formId}`] = function(item) {
        if (!ensureAllowedCenter(item.centro)) {
            showStatus(statusBox, "No tienes permisos para editar ese centro.", "error");
            return;
        }

        idInput.value = item.id;
        formCentro.value = item.centro || getFilterCenter();
        fillForm(item);
        manualToggle.checked = false;
        updateOrderFieldState();
        formTitle.textContent = `Editar ${titleDefault.replace("Nuevo ", "").replace("Nueva ", "")}`;
        window.scrollTo({ top: 0, behavior: "smooth" });
        showStatus(statusBox, "Editando registro seleccionado.", "info");
    };

    window[`delete_${formId}`] = async function(id) {
        const ok = confirm("¿Seguro que deseas eliminar este registro?");
        if (!ok) return;

        try {
            const res = await fetch(`${API}${endpointDeleteBase}/${id}`, {
                method: "DELETE",
                headers: getAuthHeaders(),
                credentials: "include"
            });

            const data = await safeJson(res);

            if (!res.ok || !data.ok) {
                if (handleProtectedResponse(res, data)) return;
                throw new Error(data.message || "No se pudo eliminar.");
            }

            showStatus(statusBox, "Registro eliminado correctamente.", "success");
            load();
            resetForm();
        } catch (error) {
            console.error(error);
            showStatus(statusBox, error.message, "error");
        }
    };

    cancelBtn?.addEventListener("click", resetForm);
    manualToggle?.addEventListener("change", updateOrderFieldState);

    formCentro?.addEventListener("change", () => {
        if (!isEditing()) updateOrderFieldState();
    });

    filterCentro?.addEventListener("change", () => {
        if (!isEditing() && formCentro) {
            formCentro.value = getFilterCenter();
            updateOrderFieldState();
        }
        load();
    });

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearStatus(statusBox);

        try {
            validate();

            const id = getCurrentId();
            const centro = getFormCenter();

            if (!ensureAllowedCenter(centro)) {
                throw new Error("No tienes permisos para usar ese centro.");
            }

            const selectedOrder = manualToggle.checked
                ? Number(orderInput.value || getNextOrder(getItemsByCenter(cache, centro)))
                : (isEditing() ? Number(orderInput.value || 0) : getNextOrder(getItemsByCenter(cache, centro)));

            const payload = buildPayload(selectedOrder);

            const res = await fetch(
                id ? `${API}${endpointUpdateBase}/${id}` : `${API}${endpointCreate}`,
                {
                    method: id ? "PUT" : "POST",
                    headers: getAuthHeaders(true),
                    credentials: "include",
                    body: JSON.stringify(payload)
                }
            );

            const data = await safeJson(res);

            if (!res.ok || !data.ok) {
                if (handleProtectedResponse(res, data)) return;
                throw new Error(data.message || "No se pudo guardar.");
            }

            showStatus(statusBox, id ? "Registro actualizado correctamente." : "Registro creado correctamente.", "success");
            resetForm();
            load();
        } catch (error) {
            console.error(error);
            showStatus(statusBox, error.message, "error");
        }
    });

    applyCenterRestrictions([filterCentro, formCentro]);

    if (formCentro && filterCentro) {
        formCentro.value = filterCentro.value;
    }

    updateOrderFieldState();
    load();

    return { load, resetForm, getCache: () => cache };
}

/* =========================
   AVISOS
========================= */
createTextModule({
    formId: "maestria-aviso-form",
    listId: "maestria-avisos-list",
    statusBoxId: "maestria-aviso-status-box",
    formTitleId: "maestria-aviso-form-title",
    cancelBtnId: "cancel-maestria-aviso-edit-btn",
    filterCentroId: "filter-maestria-aviso-centro",
    formCentroId: "maestria-aviso-centro",
    idInputId: "maestria-aviso-id",
    orderInputId: "maestria-aviso-orden",
    manualToggleId: "maestria-aviso-manual-order-toggle",
    endpointList: "/maestria/admin/avisos/list",
    endpointCreate: "/maestria/admin/avisos",
    endpointUpdateBase: "/maestria/admin/avisos",
    endpointDeleteBase: "/maestria/admin/avisos",
    titleDefault: "Nuevo aviso",
    emptyMessage: centro => `No hay avisos registrados para ${getCenterLabel(centro)}.`,
    validate() {
        const titulo = document.getElementById("maestria-aviso-titulo").value.trim();
        const resumen = document.getElementById("maestria-aviso-resumen").value.trim();
        if (!titulo) throw new Error("El título es obligatorio.");
        if (!resumen) throw new Error("El resumen es obligatorio.");
        if (resumen.length < 10) throw new Error("El resumen debe tener al menos 10 caracteres.");
    },
    buildPayload(selectedOrder) {
        return {
            centro: document.getElementById("maestria-aviso-centro").value,
            titulo: document.getElementById("maestria-aviso-titulo").value.trim(),
            categoria: document.getElementById("maestria-aviso-categoria").value.trim(),
            resumen: document.getElementById("maestria-aviso-resumen").value.trim(),
            contenido: document.getElementById("maestria-aviso-contenido").value.trim(),
            fecha_publicacion: document.getElementById("maestria-aviso-fecha").value,
            orden_visual: Number(selectedOrder),
            enlace: document.getElementById("maestria-aviso-enlace").value.trim(),
            destacado: document.getElementById("maestria-aviso-destacado").checked,
            activo: document.getElementById("maestria-aviso-activo").value === "true"
        };
    },
    fillForm(item) {
        document.getElementById("maestria-aviso-centro").value = item.centro || "vs";
        document.getElementById("maestria-aviso-titulo").value = item.titulo || "";
        document.getElementById("maestria-aviso-categoria").value = item.categoria || "";
        document.getElementById("maestria-aviso-resumen").value = item.resumen || "";
        document.getElementById("maestria-aviso-contenido").value = item.contenido || "";
        document.getElementById("maestria-aviso-fecha").value = item.fecha_publicacion || "";
        document.getElementById("maestria-aviso-orden").value = item.orden_visual ?? 0;
        document.getElementById("maestria-aviso-enlace").value = item.enlace || "";
        document.getElementById("maestria-aviso-destacado").checked = !!item.destacado;
        document.getElementById("maestria-aviso-activo").value = String(!!item.activo);
    },
    renderItem(item) {
        return `
            <article class="admin-item">
                <div class="admin-item-top">
                    <div>
                        <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                        <span class="admin-badge">${escapeHtml(item.categoria || "General")}</span>
                        ${item.destacado ? `<span class="admin-badge">Destacado</span>` : ""}
                        <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activo" : "Inactivo"}</span>
                    </div>
                    <div><span class="admin-badge">Orden: ${escapeHtml(item.orden_visual ?? 0)}</span></div>
                </div>
                <h3>${escapeHtml(item.titulo)}</h3>
                <p><strong>Resumen:</strong> ${escapeHtml(item.resumen || "")}</p>
                ${item.contenido ? `<p><strong>Contenido:</strong> ${escapeHtml(item.contenido)}</p>` : ""}
                ${item.enlace ? `<p><strong>Enlace:</strong> ${escapeHtml(item.enlace)}</p>` : ""}
                <div class="admin-item-actions">
                    <button class="btn-warning" onclick='edit_maestria-aviso-form(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Editar</button>
                    <button class="btn-danger" onclick="delete_maestria-aviso-form(${item.id})">Eliminar</button>
                </div>
            </article>
        `;
    }
});

/* =========================
   FECHAS
========================= */
createTextModule({
    formId: "maestria-fecha-form",
    listId: "maestria-fechas-list",
    statusBoxId: "maestria-fecha-status-box",
    formTitleId: "maestria-fecha-form-title",
    cancelBtnId: "cancel-maestria-fecha-edit-btn",
    filterCentroId: "filter-maestria-fecha-centro",
    formCentroId: "maestria-fecha-centro",
    idInputId: "maestria-fecha-id",
    orderInputId: "maestria-fecha-orden",
    manualToggleId: "maestria-fecha-manual-order-toggle",
    endpointList: "/maestria/admin/fechas/list",
    endpointCreate: "/maestria/admin/fechas",
    endpointUpdateBase: "/maestria/admin/fechas",
    endpointDeleteBase: "/maestria/admin/fechas",
    titleDefault: "Nueva fecha",
    emptyMessage: centro => `No hay fechas registradas para ${getCenterLabel(centro)}.`,
    validate() {
        const titulo = document.getElementById("maestria-fecha-titulo").value.trim();
        const descripcion = document.getElementById("maestria-fecha-descripcion").value.trim();
        const fecha = document.getElementById("maestria-fecha-fecha").value.trim();
        if (!titulo) throw new Error("El título es obligatorio.");
        if (!descripcion) throw new Error("La descripción es obligatoria.");
        if (!fecha) throw new Error("La fecha es obligatoria.");
    },
    buildPayload(selectedOrder) {
        return {
            centro: document.getElementById("maestria-fecha-centro").value,
            titulo: document.getElementById("maestria-fecha-titulo").value.trim(),
            descripcion: document.getElementById("maestria-fecha-descripcion").value.trim(),
            fecha: document.getElementById("maestria-fecha-fecha").value,
            orden_visual: Number(selectedOrder),
            activo: document.getElementById("maestria-fecha-activo").value === "true"
        };
    },
    fillForm(item) {
        document.getElementById("maestria-fecha-centro").value = item.centro || "vs";
        document.getElementById("maestria-fecha-titulo").value = item.titulo || "";
        document.getElementById("maestria-fecha-descripcion").value = item.descripcion || "";
        document.getElementById("maestria-fecha-fecha").value = item.fecha || "";
        document.getElementById("maestria-fecha-orden").value = item.orden_visual ?? 0;
        document.getElementById("maestria-fecha-activo").value = String(!!item.activo);
    },
    renderItem(item) {
        return `
            <article class="admin-item">
                <div class="admin-item-top">
                    <div>
                        <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                        <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activo" : "Inactivo"}</span>
                    </div>
                    <div><span class="admin-badge">Orden: ${escapeHtml(item.orden_visual ?? 0)}</span></div>
                </div>
                <h3>${escapeHtml(item.titulo)}</h3>
                <p><strong>Fecha:</strong> ${escapeHtml(item.fecha || "")}</p>
                <p><strong>Descripción:</strong> ${escapeHtml(item.descripcion || "")}</p>
                <div class="admin-item-actions">
                    <button class="btn-warning" onclick='edit_maestria-fecha-form(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Editar</button>
                    <button class="btn-danger" onclick="delete_maestria-fecha-form(${item.id})">Eliminar</button>
                </div>
            </article>
        `;
    }
});

/* =========================
   REGLAMENTOS
========================= */
createTextModule({
    formId: "maestria-reglamento-form",
    listId: "maestria-reglamentos-list",
    statusBoxId: "maestria-reglamento-status-box",
    formTitleId: "maestria-reglamento-form-title",
    cancelBtnId: "cancel-maestria-reglamento-edit-btn",
    filterCentroId: "filter-maestria-reglamento-centro",
    formCentroId: "maestria-reglamento-centro",
    idInputId: "maestria-reglamento-id",
    orderInputId: "maestria-reglamento-orden",
    manualToggleId: "maestria-reglamento-manual-order-toggle",
    endpointList: "/maestria/admin/reglamentos/list",
    endpointCreate: "/maestria/admin/reglamentos",
    endpointUpdateBase: "/maestria/admin/reglamentos",
    endpointDeleteBase: "/maestria/admin/reglamentos",
    titleDefault: "Nuevo reglamento",
    emptyMessage: centro => `No hay reglamentos registrados para ${getCenterLabel(centro)}.`,
    validate() {
        const titulo = document.getElementById("maestria-reglamento-titulo").value.trim();
        const fragmento = document.getElementById("maestria-reglamento-fragmento").value.trim();
        if (!titulo) throw new Error("El título es obligatorio.");
        if (!fragmento) throw new Error("El fragmento es obligatorio.");
    },
    buildPayload(selectedOrder) {
        return {
            centro: document.getElementById("maestria-reglamento-centro").value,
            titulo: document.getElementById("maestria-reglamento-titulo").value.trim(),
            fragmento: document.getElementById("maestria-reglamento-fragmento").value.trim(),
            enlace: document.getElementById("maestria-reglamento-enlace").value.trim(),
            orden_visual: Number(selectedOrder),
            activo: document.getElementById("maestria-reglamento-activo").value === "true"
        };
    },
    fillForm(item) {
        document.getElementById("maestria-reglamento-centro").value = item.centro || "vs";
        document.getElementById("maestria-reglamento-titulo").value = item.titulo || "";
        document.getElementById("maestria-reglamento-fragmento").value = item.fragmento || "";
        document.getElementById("maestria-reglamento-enlace").value = item.enlace || "";
        document.getElementById("maestria-reglamento-orden").value = item.orden_visual ?? 0;
        document.getElementById("maestria-reglamento-activo").value = String(!!item.activo);
    },
    renderItem(item) {
        return `
            <article class="admin-item">
                <div class="admin-item-top">
                    <div>
                        <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                        <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activo" : "Inactivo"}</span>
                    </div>
                    <div><span class="admin-badge">Orden: ${escapeHtml(item.orden_visual ?? 0)}</span></div>
                </div>
                <h3>${escapeHtml(item.titulo)}</h3>
                <p><strong>Fragmento:</strong> ${escapeHtml(item.fragmento || "")}</p>
                ${item.enlace ? `<p><strong>Enlace:</strong> ${escapeHtml(item.enlace)}</p>` : ""}
                <div class="admin-item-actions">
                    <button class="btn-warning" onclick='edit_maestria-reglamento-form(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Editar</button>
                    <button class="btn-danger" onclick="delete_maestria-reglamento-form(${item.id})">Eliminar</button>
                </div>
            </article>
        `;
    }
});

/* =========================
   ENCARGADOS
========================= */
(function () {
    const form = document.getElementById("maestria-encargado-form");
    const list = document.getElementById("maestria-encargados-list");
    const statusBox = document.getElementById("maestria-encargado-status-box");
    const formTitle = document.getElementById("maestria-encargado-form-title");
    const cancelBtn = document.getElementById("cancel-maestria-encargado-edit-btn");
    const filterCentro = document.getElementById("filter-maestria-encargado-centro");
    const formCentro = document.getElementById("maestria-encargado-centro");
    const idInput = document.getElementById("maestria-encargado-id");
    const orderInput = document.getElementById("maestria-encargado-orden");
    const manualToggle = document.getElementById("maestria-encargado-manual-order-toggle");
    const fotoInput = document.getElementById("maestria-encargado-foto");
    const fotoActualInput = document.getElementById("maestria-encargado-foto-actual");
    const previewWrap = document.getElementById("maestria-encargado-preview-wrap");
    const previewImage = document.getElementById("maestria-encargado-preview-image");

    let cache = [];

    function getFilterCenter() {
        return filterCentro?.value || allowedCenters[0] || "vs";
    }

    function getFormCenter() {
        return formCentro?.value || allowedCenters[0] || "vs";
    }

    function getCurrentId() {
        return idInput.value || "";
    }

    function isEditing() {
        return !!getCurrentId();
    }

    function updateOrderFieldState() {
        const manual = manualToggle.checked;
        orderInput.readOnly = !manual;

        if (!manual) {
            if (isEditing()) return;
            const filtered = getItemsByCenter(cache, getFormCenter());
            orderInput.value = getNextOrder(filtered);
        }
    }

    function resetForm() {
        form.reset();
        idInput.value = "";
        fotoActualInput.value = "";
        manualToggle.checked = false;

        if (formCentro) {
            formCentro.value = getFilterCenter();
        }

        previewWrap.style.display = "none";
        previewImage.src = "";
        formTitle.textContent = "Nuevo encargado";
        updateOrderFieldState();
        clearStatus(statusBox);
    }

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

    manualToggle?.addEventListener("change", updateOrderFieldState);

    formCentro?.addEventListener("change", () => {
        if (!isEditing()) updateOrderFieldState();
    });

    filterCentro?.addEventListener("change", () => {
        if (!isEditing() && formCentro) {
            formCentro.value = getFilterCenter();
            updateOrderFieldState();
        }
        load();
    });

    cancelBtn?.addEventListener("click", resetForm);

    async function load() {
        list.innerHTML = `<div class="admin-empty">Cargando encargados...</div>`;

        try {
            const res = await fetch(`${API}/maestria/admin/encargados/list?centro=${encodeURIComponent(getFilterCenter())}`, {
                headers: getAuthHeaders(),
                credentials: "include"
            });

            const data = await safeJson(res);

            if (!res.ok || !data.ok) {
                if (handleProtectedResponse(res, data)) return;
                throw new Error(data.message || "No se pudo cargar.");
            }

            cache = Array.isArray(data.items) ? data.items : [];

            if (cache.length === 0) {
                list.innerHTML = `<div class="admin-empty">No hay encargados registrados para ${escapeHtml(getCenterLabel(getFilterCenter()))}.</div>`;
                updateOrderFieldState();
                return;
            }

            const sorted = sortByOrderAndTitle(cache, "nombre");
            list.innerHTML = sorted.map(item => `
                <article class="admin-item">
                    <div class="admin-item-layout">
                        <img class="admin-photo" src="${escapeHtml(getImageUrl(item.foto_url))}" alt="${escapeHtml(item.nombre)}">
                        <div>
                            <div class="admin-item-top">
                                <div>
                                    <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                                    <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activo" : "Inactivo"}</span>
                                </div>
                                <div><span class="admin-badge">Orden: ${escapeHtml(item.orden_visual ?? 0)}</span></div>
                            </div>
                            <h3>${escapeHtml(item.nombre)}</h3>
                            ${item.cargo ? `<p><strong>Cargo:</strong> ${escapeHtml(item.cargo)}</p>` : ""}
                            ${item.correo ? `<p><strong>Correo:</strong> ${escapeHtml(item.correo)}</p>` : ""}
                            ${item.telefono ? `<p><strong>Teléfono:</strong> ${escapeHtml(item.telefono)}</p>` : ""}
                            ${item.descripcion ? `<p><strong>Descripción:</strong> ${escapeHtml(item.descripcion)}</p>` : ""}
                            <div class="admin-item-actions">
                                <button class="btn-warning" onclick='window.editMaestriaEncargado(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Editar</button>
                                <button class="btn-danger" onclick="window.deleteMaestriaEncargado(${item.id})">Eliminar</button>
                            </div>
                        </div>
                    </div>
                </article>
            `).join("");

            updateOrderFieldState();
        } catch (error) {
            console.error(error);
            list.innerHTML = `<div class="admin-empty">Error al cargar encargados.</div>`;
            showStatus(statusBox, error.message, "error");
        }
    }

    window.editMaestriaEncargado = function (item) {
        if (!ensureAllowedCenter(item.centro)) {
            showStatus(statusBox, "No tienes permisos para editar ese centro.", "error");
            return;
        }

        idInput.value = item.id;
        fotoActualInput.value = item.foto_url || "";
        formCentro.value = item.centro || getFilterCenter();
        document.getElementById("maestria-encargado-nombre").value = item.nombre || "";
        document.getElementById("maestria-encargado-cargo").value = item.cargo || "";
        document.getElementById("maestria-encargado-correo").value = item.correo || "";
        document.getElementById("maestria-encargado-telefono").value = item.telefono || "";
        document.getElementById("maestria-encargado-descripcion").value = item.descripcion || "";
        orderInput.value = item.orden_visual ?? 0;
        document.getElementById("maestria-encargado-activo").value = String(!!item.activo);
        manualToggle.checked = false;
        updateOrderFieldState();

        if (item.foto_url) {
            previewImage.src = getImageUrl(item.foto_url);
            previewWrap.style.display = "block";
        } else {
            previewWrap.style.display = "none";
            previewImage.src = "";
        }

        formTitle.textContent = "Editar encargado";
        window.scrollTo({ top: 0, behavior: "smooth" });
        showStatus(statusBox, "Editando encargado seleccionado.", "info");
    };

    window.deleteMaestriaEncargado = async function (id) {
        const ok = confirm("¿Seguro que deseas eliminar este encargado?");
        if (!ok) return;

        try {
            const res = await fetch(`${API}/maestria/admin/encargados/${id}`, {
                method: "DELETE",
                headers: getAuthHeaders(),
                credentials: "include"
            });

            const data = await safeJson(res);

            if (!res.ok || !data.ok) {
                if (handleProtectedResponse(res, data)) return;
                throw new Error(data.message || "No se pudo eliminar.");
            }

            showStatus(statusBox, "Encargado eliminado correctamente.", "success");
            load();
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
            const nombre = document.getElementById("maestria-encargado-nombre").value.trim();
            const correo = document.getElementById("maestria-encargado-correo").value.trim();
            const centro = getFormCenter();

            if (!ensureAllowedCenter(centro)) throw new Error("No tienes permisos para usar ese centro.");
            if (!nombre) throw new Error("El nombre es obligatorio.");
            if (nombre.length < 5) throw new Error("El nombre debe tener al menos 5 caracteres.");
            if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
                throw new Error("El correo no tiene un formato válido.");
            }

            const id = getCurrentId();
            const selectedOrder = manualToggle.checked
                ? Number(orderInput.value || getNextOrder(getItemsByCenter(cache, getFormCenter())))
                : (isEditing() ? Number(orderInput.value || 0) : getNextOrder(getItemsByCenter(cache, getFormCenter())));

            const formData = new FormData();
            formData.append("centro", centro);
            formData.append("nombre", nombre);
            formData.append("cargo", document.getElementById("maestria-encargado-cargo").value.trim());
            formData.append("correo", correo);
            formData.append("telefono", document.getElementById("maestria-encargado-telefono").value.trim());
            formData.append("descripcion", document.getElementById("maestria-encargado-descripcion").value.trim());
            formData.append("orden_visual", Number(selectedOrder));
            formData.append("activo", document.getElementById("maestria-encargado-activo").value === "true");
            formData.append("foto_actual", fotoActualInput.value);

            if (fotoInput.files[0]) {
                formData.append("foto", fotoInput.files[0]);
            }

            const res = await fetch(
                id ? `${API}/maestria/admin/encargados/${id}` : `${API}/maestria/admin/encargados`,
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
                throw new Error(data.message || "No se pudo guardar.");
            }

            showStatus(statusBox, id ? "Encargado actualizado correctamente." : "Encargado creado correctamente.", "success");
            resetForm();
            load();
        } catch (error) {
            console.error(error);
            showStatus(statusBox, error.message, "error");
        }
    });

    applyCenterRestrictions([filterCentro, formCentro]);

    if (formCentro && filterCentro) {
        formCentro.value = filterCentro.value;
    }

    updateOrderFieldState();
    load();
})();

/* =========================
   RECURSOS
========================= */
(function () {
    const form = document.getElementById("maestria-recurso-form");
    const list = document.getElementById("maestria-recursos-list");
    const statusBox = document.getElementById("maestria-recurso-status-box");
    const formTitle = document.getElementById("maestria-recurso-form-title");
    const cancelBtn = document.getElementById("cancel-maestria-recurso-edit-btn");
    const filterCentro = document.getElementById("filter-maestria-recurso-centro");
    const formCentro = document.getElementById("maestria-recurso-centro");
    const idInput = document.getElementById("maestria-recurso-id");
    const orderInput = document.getElementById("maestria-recurso-orden");
    const manualToggle = document.getElementById("maestria-recurso-manual-order-toggle");
    const archivoInput = document.getElementById("maestria-recurso-archivo");
    const archivoActualBox = document.getElementById("maestria-recurso-archivo-actual-box");

    let cache = [];

    function getFilterCenter() {
        return filterCentro?.value || allowedCenters[0] || "vs";
    }

    function getFormCenter() {
        return formCentro?.value || allowedCenters[0] || "vs";
    }

    function getCurrentId() {
        return idInput.value || "";
    }

    function isEditing() {
        return !!getCurrentId();
    }

    function updateOrderFieldState() {
        const manual = manualToggle.checked;
        orderInput.readOnly = !manual;

        if (!manual) {
            if (isEditing()) return;
            const filtered = getItemsByCenter(cache, getFormCenter());
            orderInput.value = getNextOrder(filtered);
        }
    }

    function resetForm() {
        form.reset();
        idInput.value = "";
        manualToggle.checked = false;

        if (formCentro) {
            formCentro.value = getFilterCenter();
        }

        formTitle.textContent = "Nuevo recurso";
        renderFileCurrentBox(archivoActualBox, null, "archivo");
        updateOrderFieldState();
        clearStatus(statusBox);
    }

    manualToggle?.addEventListener("change", updateOrderFieldState);

    formCentro?.addEventListener("change", () => {
        if (!isEditing()) updateOrderFieldState();
    });

    filterCentro?.addEventListener("change", () => {
        if (!isEditing() && formCentro) {
            formCentro.value = getFilterCenter();
            updateOrderFieldState();
        }
        load();
    });

    cancelBtn?.addEventListener("click", resetForm);

    async function load() {
        list.innerHTML = `<div class="admin-empty">Cargando recursos...</div>`;

        try {
            const res = await fetch(`${API}/maestria/admin/recursos/list?centro=${encodeURIComponent(getFilterCenter())}`, {
                headers: getAuthHeaders(),
                credentials: "include"
            });

            const data = await safeJson(res);

            if (!res.ok || !data.ok) {
                if (handleProtectedResponse(res, data)) return;
                throw new Error(data.message || "No se pudo cargar.");
            }

            cache = Array.isArray(data.items) ? data.items : [];

            if (cache.length === 0) {
                list.innerHTML = `<div class="admin-empty">No hay recursos registrados para ${escapeHtml(getCenterLabel(getFilterCenter()))}.</div>`;
                updateOrderFieldState();
                return;
            }

            const sorted = sortByOrderAndTitle(cache, "titulo");
            list.innerHTML = sorted.map(item => `
                <article class="admin-item">
                    <div class="admin-item-top">
                        <div>
                            <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                            <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activo" : "Inactivo"}</span>
                        </div>
                        <div><span class="admin-badge">Orden: ${escapeHtml(item.orden_visual ?? 0)}</span></div>
                    </div>
                    <h3>${escapeHtml(item.titulo)}</h3>
                    ${item.descripcion ? `<p><strong>Descripción:</strong> ${escapeHtml(item.descripcion)}</p>` : ""}
                    ${item.archivo_nombre_original ? `<p><strong>Archivo:</strong> ${escapeHtml(item.archivo_nombre_original)}</p>` : ""}
                    ${item.enlace_externo ? `<p><strong>Enlace:</strong> ${escapeHtml(item.enlace_externo)}</p>` : ""}
                    <div class="admin-item-actions">
                        <button class="btn-warning" onclick='window.editMaestriaRecurso(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Editar</button>
                        <button class="btn-danger" onclick="window.deleteMaestriaRecurso(${item.id})">Eliminar</button>
                    </div>
                </article>
            `).join("");

            updateOrderFieldState();
        } catch (error) {
            console.error(error);
            list.innerHTML = `<div class="admin-empty">Error al cargar recursos.</div>`;
            showStatus(statusBox, error.message, "error");
        }
    }

    window.editMaestriaRecurso = function (item) {
        if (!ensureAllowedCenter(item.centro)) {
            showStatus(statusBox, "No tienes permisos para editar ese centro.", "error");
            return;
        }

        idInput.value = item.id;
        formCentro.value = item.centro || getFilterCenter();
        document.getElementById("maestria-recurso-titulo").value = item.titulo || "";
        document.getElementById("maestria-recurso-descripcion").value = item.descripcion || "";
        document.getElementById("maestria-recurso-enlace").value = item.enlace_externo || "";
        orderInput.value = item.orden_visual ?? 0;
        document.getElementById("maestria-recurso-activo").value = String(!!item.activo);
        manualToggle.checked = false;
        renderFileCurrentBox(archivoActualBox, item, "archivo");
        updateOrderFieldState();

        formTitle.textContent = "Editar recurso";
        window.scrollTo({ top: 0, behavior: "smooth" });
        showStatus(statusBox, "Editando recurso seleccionado.", "info");
    };

    window.deleteMaestriaRecurso = async function (id) {
        const ok = confirm("¿Seguro que deseas eliminar este recurso?");
        if (!ok) return;

        try {
            const res = await fetch(`${API}/maestria/admin/recursos/${id}`, {
                method: "DELETE",
                headers: getAuthHeaders(),
                credentials: "include"
            });

            const data = await safeJson(res);

            if (!res.ok || !data.ok) {
                if (handleProtectedResponse(res, data)) return;
                throw new Error(data.message || "No se pudo eliminar.");
            }

            showStatus(statusBox, "Recurso eliminado correctamente.", "success");
            load();
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
            const titulo = document.getElementById("maestria-recurso-titulo").value.trim();
            const enlace = document.getElementById("maestria-recurso-enlace").value.trim();
            const archivo = archivoInput.files[0];
            const centro = getFormCenter();

            if (!ensureAllowedCenter(centro)) throw new Error("No tienes permisos para usar ese centro.");
            if (!titulo) throw new Error("El título es obligatorio.");
            if (!archivo && !enlace && !getCurrentId()) {
                throw new Error("Debes subir un archivo o proporcionar un enlace.");
            }

            const selectedOrder = manualToggle.checked
                ? Number(orderInput.value || getNextOrder(getItemsByCenter(cache, getFormCenter())))
                : (isEditing() ? Number(orderInput.value || 0) : getNextOrder(getItemsByCenter(cache, getFormCenter())));

            const formData = new FormData();
            formData.append("centro", centro);
            formData.append("titulo", titulo);
            formData.append("descripcion", document.getElementById("maestria-recurso-descripcion").value.trim());
            formData.append("enlace_externo", enlace);
            formData.append("orden_visual", Number(selectedOrder));
            formData.append("activo", document.getElementById("maestria-recurso-activo").value === "true");

            if (archivo) {
                formData.append("archivo", archivo);
            }

            const id = getCurrentId();
            const res = await fetch(
                id ? `${API}/maestria/admin/recursos/${id}` : `${API}/maestria/admin/recursos`,
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
                throw new Error(data.message || "No se pudo guardar.");
            }

            showStatus(statusBox, id ? "Recurso actualizado correctamente." : "Recurso creado correctamente.", "success");
            resetForm();
            load();
        } catch (error) {
            console.error(error);
            showStatus(statusBox, error.message, "error");
        }
    });

    applyCenterRestrictions([filterCentro, formCentro]);

    if (formCentro && filterCentro) {
        formCentro.value = filterCentro.value;
    }

    updateOrderFieldState();
    load();
})();

/* =========================
   TUTORIALES
========================= */
(function () {
    const form = document.getElementById("maestria-tutorial-form");
    const list = document.getElementById("maestria-tutoriales-list");
    const statusBox = document.getElementById("maestria-tutorial-status-box");
    const formTitle = document.getElementById("maestria-tutorial-form-title");
    const cancelBtn = document.getElementById("cancel-maestria-tutorial-edit-btn");
    const filterCentro = document.getElementById("filter-maestria-tutorial-centro");
    const formCentro = document.getElementById("maestria-tutorial-centro");
    const idInput = document.getElementById("maestria-tutorial-id");
    const orderInput = document.getElementById("maestria-tutorial-orden");
    const manualToggle = document.getElementById("maestria-tutorial-manual-order-toggle");
    const videoInput = document.getElementById("maestria-tutorial-video");
    const videoActualBox = document.getElementById("maestria-tutorial-video-actual-box");

    let cache = [];

    function getFilterCenter() {
        return filterCentro?.value || allowedCenters[0] || "vs";
    }

    function getFormCenter() {
        return formCentro?.value || allowedCenters[0] || "vs";
    }

    function getCurrentId() {
        return idInput.value || "";
    }

    function isEditing() {
        return !!getCurrentId();
    }

    function updateOrderFieldState() {
        const manual = manualToggle.checked;
        orderInput.readOnly = !manual;

        if (!manual) {
            if (isEditing()) return;
            const filtered = getItemsByCenter(cache, getFormCenter());
            orderInput.value = getNextOrder(filtered);
        }
    }

    function resetForm() {
        form.reset();
        idInput.value = "";
        manualToggle.checked = false;

        if (formCentro) {
            formCentro.value = getFilterCenter();
        }

        formTitle.textContent = "Nuevo tutorial";
        renderFileCurrentBox(videoActualBox, null, "video");
        updateOrderFieldState();
        clearStatus(statusBox);
    }

    manualToggle?.addEventListener("change", updateOrderFieldState);

    formCentro?.addEventListener("change", () => {
        if (!isEditing()) updateOrderFieldState();
    });

    filterCentro?.addEventListener("change", () => {
        if (!isEditing() && formCentro) {
            formCentro.value = getFilterCenter();
            updateOrderFieldState();
        }
        load();
    });

    cancelBtn?.addEventListener("click", resetForm);

    async function load() {
        list.innerHTML = `<div class="admin-empty">Cargando tutoriales...</div>`;

        try {
            const res = await fetch(`${API}/maestria/admin/tutoriales/list?centro=${encodeURIComponent(getFilterCenter())}`, {
                headers: getAuthHeaders(),
                credentials: "include"
            });

            const data = await safeJson(res);

            if (!res.ok || !data.ok) {
                if (handleProtectedResponse(res, data)) return;
                throw new Error(data.message || "No se pudo cargar.");
            }

            cache = Array.isArray(data.items) ? data.items : [];

            if (cache.length === 0) {
                list.innerHTML = `<div class="admin-empty">No hay tutoriales registrados para ${escapeHtml(getCenterLabel(getFilterCenter()))}.</div>`;
                updateOrderFieldState();
                return;
            }

            const sorted = sortByOrderAndTitle(cache, "titulo");
            list.innerHTML = sorted.map(item => `
                <article class="admin-item">
                    <div class="admin-item-top">
                        <div>
                            <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                            <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activo" : "Inactivo"}</span>
                        </div>
                        <div><span class="admin-badge">Orden: ${escapeHtml(item.orden_visual ?? 0)}</span></div>
                    </div>
                    <h3>${escapeHtml(item.titulo)}</h3>
                    ${item.descripcion ? `<p><strong>Descripción:</strong> ${escapeHtml(item.descripcion)}</p>` : ""}
                    ${item.video_nombre_original ? `<p><strong>Video:</strong> ${escapeHtml(item.video_nombre_original)}</p>` : ""}
                    ${item.enlace_video ? `<p><strong>Enlace:</strong> ${escapeHtml(item.enlace_video)}</p>` : ""}
                    <div class="admin-item-actions">
                        <button class="btn-warning" onclick='window.editMaestriaTutorial(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Editar</button>
                        <button class="btn-danger" onclick="window.deleteMaestriaTutorial(${item.id})">Eliminar</button>
                    </div>
                </article>
            `).join("");

            updateOrderFieldState();
        } catch (error) {
            console.error(error);
            list.innerHTML = `<div class="admin-empty">Error al cargar tutoriales.</div>`;
            showStatus(statusBox, error.message, "error");
        }
    }

    window.editMaestriaTutorial = function (item) {
        if (!ensureAllowedCenter(item.centro)) {
            showStatus(statusBox, "No tienes permisos para editar ese centro.", "error");
            return;
        }

        idInput.value = item.id;
        formCentro.value = item.centro || getFilterCenter();
        document.getElementById("maestria-tutorial-titulo").value = item.titulo || "";
        document.getElementById("maestria-tutorial-descripcion").value = item.descripcion || "";
        document.getElementById("maestria-tutorial-enlace").value = item.enlace_video || "";
        orderInput.value = item.orden_visual ?? 0;
        document.getElementById("maestria-tutorial-activo").value = String(!!item.activo);
        manualToggle.checked = false;
        renderFileCurrentBox(videoActualBox, item, "video");
        updateOrderFieldState();

        formTitle.textContent = "Editar tutorial";
        window.scrollTo({ top: 0, behavior: "smooth" });
        showStatus(statusBox, "Editando tutorial seleccionado.", "info");
    };

    window.deleteMaestriaTutorial = async function (id) {
        const ok = confirm("¿Seguro que deseas eliminar este tutorial?");
        if (!ok) return;

        try {
            const res = await fetch(`${API}/maestria/admin/tutoriales/${id}`, {
                method: "DELETE",
                headers: getAuthHeaders(),
                credentials: "include"
            });

            const data = await safeJson(res);

            if (!res.ok || !data.ok) {
                if (handleProtectedResponse(res, data)) return;
                throw new Error(data.message || "No se pudo eliminar.");
            }

            showStatus(statusBox, "Tutorial eliminado correctamente.", "success");
            load();
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
            const titulo = document.getElementById("maestria-tutorial-titulo").value.trim();
            const enlace = document.getElementById("maestria-tutorial-enlace").value.trim();
            const video = videoInput.files[0];
            const centro = getFormCenter();

            if (!ensureAllowedCenter(centro)) throw new Error("No tienes permisos para usar ese centro.");
            if (!titulo) throw new Error("El título es obligatorio.");
            if (!video && !enlace && !getCurrentId()) {
                throw new Error("Debes subir un video o proporcionar un enlace.");
            }

            const selectedOrder = manualToggle.checked
                ? Number(orderInput.value || getNextOrder(getItemsByCenter(cache, getFormCenter())))
                : (isEditing() ? Number(orderInput.value || 0) : getNextOrder(getItemsByCenter(cache, getFormCenter())));

            const formData = new FormData();
            formData.append("centro", centro);
            formData.append("titulo", titulo);
            formData.append("descripcion", document.getElementById("maestria-tutorial-descripcion").value.trim());
            formData.append("enlace_video", enlace);
            formData.append("orden_visual", Number(selectedOrder));
            formData.append("activo", document.getElementById("maestria-tutorial-activo").value === "true");

            if (video) {
                formData.append("video", video);
            }

            const id = getCurrentId();
            const res = await fetch(
                id ? `${API}/maestria/admin/tutoriales/${id}` : `${API}/maestria/admin/tutoriales`,
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
                throw new Error(data.message || "No se pudo guardar.");
            }

            showStatus(statusBox, id ? "Tutorial actualizado correctamente." : "Tutorial creado correctamente.", "success");
            resetForm();
            load();
        } catch (error) {
            console.error(error);
            showStatus(statusBox, error.message, "error");
        }
    });

    applyCenterRestrictions([filterCentro, formCentro]);

    if (formCentro && filterCentro) {
        formCentro.value = filterCentro.value;
    }

    updateOrderFieldState();
    load();
})();