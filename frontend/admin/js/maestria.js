const {
    API,
    UPLOADS_BASE,
    adminUser,

    requireAuth,
    getAuthHeaders,
    logout,

    getAllowedCenters,
    ensureAllowedCenter,
    applyCenterRestrictions,

    escapeHtml,
    safeJson,

    showStatus,
    clearStatus,

    getCenterLabel,
    getImageUrl,

    sortByOrder,

    getItemsByCenter,
    getNextOrder,

    handleProtectedResponse
} = AdminCore;

const {
    renderCurrentFile,
    setupImagePreview,
    clearImagePreview
} = AdminUpload;

const {
    createTextModule,
    createUploadModule
} = AdminCrud;

requireAuth();

/* =========================
   HELPERS LOCALES
========================= */

const allowedCenters = getAllowedCenters(adminUser);

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

    return map[String(tipo || "").toLowerCase()]
        || (tipo ? String(tipo).toUpperCase() : "Archivo");
}

function sortByOrderAndTitle(items, titleField = "titulo") {

    return sortByOrder(items, titleField);
}

document.getElementById("logout-btn")
    ?.addEventListener("click", logout);

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
   AVISOS
========================= */
createTextModule({
    API,
    allowedCenters,

    getAuthHeaders,
    safeJson,

    showStatus,
    clearStatus,

    applyCenterRestrictions,
    ensureAllowedCenter,

    getItemsByCenter,
    getNextOrder,

    handleProtectedResponse,

    escapeHtml,
    getCenterLabel,
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
    API,
    allowedCenters,

    getAuthHeaders,
    safeJson,

    showStatus,
    clearStatus,

    applyCenterRestrictions,
    ensureAllowedCenter,

    getItemsByCenter,
    getNextOrder,

    handleProtectedResponse,

    escapeHtml,
    getCenterLabel,
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
    API,
    allowedCenters,

    getAuthHeaders,
    safeJson,

    showStatus,
    clearStatus,

    applyCenterRestrictions,
    ensureAllowedCenter,

    getItemsByCenter,
    getNextOrder,

    handleProtectedResponse,

    escapeHtml,
    getCenterLabel,
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

setupImagePreview({
    input: document.getElementById("maestria-encargado-foto"),
    previewWrap: document.getElementById("maestria-encargado-preview-wrap"),
    previewImage: document.getElementById("maestria-encargado-preview-image")
});

const maestriaEncargadosModule =
    createUploadModule({

        API,
        FILES_BASE: UPLOADS_BASE,

        allowedCenters,

        getAuthHeaders,
        safeJson,

        showStatus,
        clearStatus,

        applyCenterRestrictions,
        ensureAllowedCenter,

        getItemsByCenter,
        getNextOrder,

        handleProtectedResponse,

        escapeHtml,
        getCenterLabel,
        getImageUrl,
        sortByOrder,

        renderCurrentFile,

        formId:
            "maestria-encargado-form",

        listId:
            "maestria-encargados-list",

        statusBoxId:
            "maestria-encargado-status-box",

        formTitleId:
            "maestria-encargado-form-title",

        cancelBtnId:
            "cancel-maestria-encargado-edit-btn",

        filterCentroId:
            "filter-maestria-encargado-centro",

        formCentroId:
            "maestria-encargado-centro",

        idInputId:
            "maestria-encargado-id",

        orderInputId:
            "maestria-encargado-orden",

        manualToggleId:
            "maestria-encargado-manual-order-toggle",

        uploadInputId:
            "maestria-encargado-foto",

        currentFileBoxId:
            "maestria-encargado-preview-wrap",

        endpointList:
            "/maestria/admin/encargados/list",

        endpointCreate:
            "/maestria/admin/encargados",

        endpointUpdateBase:
            "/maestria/admin/encargados",

        endpointDeleteBase:
            "/maestria/admin/encargados",

        uploadFieldName:
            "foto",

        titleDefault:
            "Nuevo encargado",

        titleField:
            "nombre",

        getFileTypeLabel:
            () => "Imagen",

        emptyMessage: centro =>
            `No hay encargados registrados para ${escapeHtml(getCenterLabel(centro))}.`,

        validate() {

            const nombre =
                document.getElementById("maestria-encargado-nombre")
                    .value
                    .trim();

            const correo =
                document.getElementById("maestria-encargado-correo")
                    .value
                    .trim();

            if (!nombre) {
                throw new Error(
                    "El nombre es obligatorio."
                );
            }

            if (nombre.length < 5) {
                throw new Error(
                    "El nombre debe tener al menos 5 caracteres."
                );
            }

            if (
                correo
                && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
            ) {
                throw new Error(
                    "El correo no tiene un formato válido."
                );
            }

        },

        buildFormData({
            centro,
            uploadInput,
            orderInput,
            selectedOrder
        }) {

            const formData =
                new FormData();

            formData.append(
                "centro",
                centro
            );

            formData.append(
                "nombre",
                document.getElementById("maestria-encargado-nombre")
                    .value
                    .trim()
            );

            formData.append(
                "cargo",
                document.getElementById("maestria-encargado-cargo")
                    .value
                    .trim()
            );

            formData.append(
                "correo",
                document.getElementById("maestria-encargado-correo")
                    .value
                    .trim()
            );

            formData.append(
                "telefono",
                document.getElementById("maestria-encargado-telefono")
                    .value
                    .trim()
            );

            formData.append(
                "descripcion",
                document.getElementById("maestria-encargado-descripcion")
                    .value
                    .trim()
            );

            formData.append(
                "orden_visual",
                Number(selectedOrder)
            );

            formData.append(
                "activo",
                document.getElementById("maestria-encargado-activo")
                    .value === "true"
            );

            formData.append(
                "foto_actual",
                document.getElementById("maestria-encargado-foto-actual")
                    .value
            );

            if (uploadInput.files[0]) {

                formData.append(
                    "foto",
                    uploadInput.files[0]
                );

            }

            return formData;

        },

        fillForm(item) {

            document.getElementById("maestria-encargado-foto-actual")
                .value =
                item.foto_url || "";

            document.getElementById("maestria-encargado-centro")
                .value =
                item.centro || "vs";

            document.getElementById("maestria-encargado-nombre")
                .value =
                item.nombre || "";

            document.getElementById("maestria-encargado-cargo")
                .value =
                item.cargo || "";

            document.getElementById("maestria-encargado-correo")
                .value =
                item.correo || "";

            document.getElementById("maestria-encargado-telefono")
                .value =
                item.telefono || "";

            document.getElementById("maestria-encargado-descripcion")
                .value =
                item.descripcion || "";

            document.getElementById("maestria-encargado-orden")
                .value =
                item.orden_visual ?? 0;

            document.getElementById("maestria-encargado-activo")
                .value =
                String(!!item.activo);

            document.getElementById("maestria-encargado-manual-order-toggle")
                .checked = false;

            if (item.foto_url) {

                document.getElementById("maestria-encargado-preview-image")
                    .src =
                    getImageUrl(item.foto_url);

                document.getElementById("maestria-encargado-preview-wrap")
                    .style.display =
                    "block";

            } else {

                clearImagePreview({
                    previewWrap: document.getElementById("maestria-encargado-preview-wrap"),
                    previewImage: document.getElementById("maestria-encargado-preview-image")
                });

            }

        },

        renderItem(item) {

            return `
                <article class="admin-item">

                    <div class="admin-item-layout">

                        <img
                            class="admin-photo"
                            src="${escapeHtml(getImageUrl(item.foto_url))}"
                            alt="${escapeHtml(item.nombre)}"
                        >

                        <div>

                            <div class="admin-item-top">

                                <div>

                                    <span class="admin-badge">
                                        ${escapeHtml(getCenterLabel(item.centro))}
                                    </span>

                                    <span class="admin-badge ${item.activo ? "active" : "inactive"}">
                                        ${item.activo ? "Activo" : "Inactivo"}
                                    </span>

                                </div>

                                <div>

                                    <span class="admin-badge">
                                        Orden:
                                        ${escapeHtml(item.orden_visual ?? 0)}
                                    </span>

                                </div>

                            </div>

                            <h3>
                                ${escapeHtml(item.nombre)}
                            </h3>

                            ${item.cargo
                                ? `<p><strong>Cargo:</strong> ${escapeHtml(item.cargo)}</p>`
                                : ""
                            }

                            ${item.correo
                                ? `<p><strong>Correo:</strong> ${escapeHtml(item.correo)}</p>`
                                : ""
                            }

                            ${item.telefono
                                ? `<p><strong>Teléfono:</strong> ${escapeHtml(item.telefono)}</p>`
                                : ""
                            }

                            ${item.descripcion
                                ? `<p><strong>Descripción:</strong> ${escapeHtml(item.descripcion)}</p>`
                                : ""
                            }

                            <div class="admin-item-actions">

                                <button
                                    class="btn-warning"
                                    onclick='maestriaEncargadosModule.edit(${JSON.stringify(item).replace(/'/g, "&apos;")})'
                                >
                                    Editar
                                </button>

                                <button
                                    class="btn-danger"
                                    onclick="maestriaEncargadosModule.remove(${item.id})"
                                >
                                    Eliminar
                                </button>

                            </div>

                        </div>

                    </div>

                </article>
            `;

        }

    });

/* =========================
   RECURSOS
========================= */

const maestriaRecursosModule =
    createUploadModule({

        API,
        FILES_BASE: UPLOADS_BASE,

        allowedCenters,

        getAuthHeaders,
        safeJson,

        showStatus,
        clearStatus,

        applyCenterRestrictions,
        ensureAllowedCenter,

        getItemsByCenter,
        getNextOrder,

        handleProtectedResponse,

        escapeHtml,
        getCenterLabel,
        sortByOrder,

        renderCurrentFile,

        formId:
            "maestria-recurso-form",

        listId:
            "maestria-recursos-list",

        statusBoxId:
            "maestria-recurso-status-box",

        formTitleId:
            "maestria-recurso-form-title",

        cancelBtnId:
            "cancel-maestria-recurso-edit-btn",

        filterCentroId:
            "filter-maestria-recurso-centro",

        formCentroId:
            "maestria-recurso-centro",

        idInputId:
            "maestria-recurso-id",

        orderInputId:
            "maestria-recurso-orden",

        manualToggleId:
            "maestria-recurso-manual-order-toggle",

        uploadInputId:
            "maestria-recurso-archivo",

        currentFileBoxId:
            "maestria-recurso-archivo-actual-box",

        endpointList:
            "/maestria/admin/recursos/list",

        endpointCreate:
            "/maestria/admin/recursos",

        endpointUpdateBase:
            "/maestria/admin/recursos",

        endpointDeleteBase:
            "/maestria/admin/recursos",

        uploadFieldName:
            "archivo",

        titleDefault:
            "Nuevo recurso",

        titleField:
            "titulo",

        getFileTypeLabel,

        emptyMessage: centro =>
            `No hay recursos registrados para ${escapeHtml(getCenterLabel(centro))}.`,

        validate() {

            const titulo =
                document.getElementById("maestria-recurso-titulo")
                    .value
                    .trim();

            const enlace =
                document.getElementById("maestria-recurso-enlace")
                    .value
                    .trim();

            const archivo =
                document.getElementById("maestria-recurso-archivo")
                    .files[0];

            const currentId =
                document.getElementById("maestria-recurso-id")
                    .value;

            if (!titulo) {

                throw new Error(
                    "El título es obligatorio."
                );

            }

            if (
                !archivo
                && !enlace
                && !currentId
            ) {

                throw new Error(
                    "Debes subir un archivo o proporcionar un enlace."
                );

            }

        },

        buildFormData({
            centro,
            uploadInput,
            selectedOrder
        }) {

            const formData =
                new FormData();

            formData.append(
                "centro",
                centro
            );

            formData.append(
                "titulo",
                document.getElementById("maestria-recurso-titulo")
                    .value
                    .trim()
            );

            formData.append(
                "descripcion",
                document.getElementById("maestria-recurso-descripcion")
                    .value
                    .trim()
            );

            formData.append(
                "enlace_externo",
                document.getElementById("maestria-recurso-enlace")
                    .value
                    .trim()
            );

            formData.append(
                "orden_visual",
                Number(selectedOrder)
            );

            formData.append(
                "activo",
                document.getElementById("maestria-recurso-activo")
                    .value === "true"
            );

            if (uploadInput.files[0]) {

                formData.append(
                    "archivo",
                    uploadInput.files[0]
                );

            }

            return formData;

        },

        fillForm(item) {

            document.getElementById("maestria-recurso-centro")
                .value =
                item.centro || "vs";

            document.getElementById("maestria-recurso-titulo")
                .value =
                item.titulo || "";

            document.getElementById("maestria-recurso-descripcion")
                .value =
                item.descripcion || "";

            document.getElementById("maestria-recurso-enlace")
                .value =
                item.enlace_externo || "";

            document.getElementById("maestria-recurso-orden")
                .value =
                item.orden_visual ?? 0;

            document.getElementById("maestria-recurso-activo")
                .value =
                String(!!item.activo);

            document.getElementById("maestria-recurso-manual-order-toggle")
                .checked = false;

            renderCurrentFile({
                box: document.getElementById("maestria-recurso-archivo-actual-box"),
                item,
                kind: "archivo",
                uploadsBase: UPLOADS_BASE,
                escapeHtml,
                getFileTypeLabel
            });

        },

        renderItem(item) {

            return `
                <article class="admin-item">

                    <div class="admin-item-top">

                        <div>

                            <span class="admin-badge">
                                ${escapeHtml(getCenterLabel(item.centro))}
                            </span>

                            <span class="admin-badge ${item.activo ? "active" : "inactive"}">
                                ${item.activo ? "Activo" : "Inactivo"}
                            </span>

                        </div>

                        <div>

                            <span class="admin-badge">
                                Orden:
                                ${escapeHtml(item.orden_visual ?? 0)}
                            </span>

                        </div>

                    </div>

                    <h3>
                        ${escapeHtml(item.titulo)}
                    </h3>

                    ${item.descripcion
                        ? `<p><strong>Descripción:</strong> ${escapeHtml(item.descripcion)}</p>`
                        : ""
                    }

                    ${item.archivo_nombre_original
                        ? `<p><strong>Archivo:</strong> ${escapeHtml(item.archivo_nombre_original)}</p>`
                        : ""
                    }

                    ${item.enlace_externo
                        ? `<p><strong>Enlace:</strong> ${escapeHtml(item.enlace_externo)}</p>`
                        : ""
                    }

                    <div class="admin-item-actions">

                        <button
                            class="btn-warning"
                            onclick='maestriaRecursosModule.edit(${JSON.stringify(item).replace(/'/g, "&apos;")})'
                        >
                            Editar
                        </button>

                        <button
                            class="btn-danger"
                            onclick="maestriaRecursosModule.remove(${item.id})"
                        >
                            Eliminar
                        </button>

                    </div>

                </article>
            `;

        }

    });

/* =========================
   TUTORIALES
========================= */

const maestriaTutorialesModule =
    createUploadModule({

        API,
        FILES_BASE: UPLOADS_BASE,

        allowedCenters,

        getAuthHeaders,
        safeJson,

        showStatus,
        clearStatus,

        applyCenterRestrictions,
        ensureAllowedCenter,

        getItemsByCenter,
        getNextOrder,

        handleProtectedResponse,

        escapeHtml,
        getCenterLabel,
        sortByOrder,

        renderCurrentFile,

        formId:
            "maestria-tutorial-form",

        listId:
            "maestria-tutoriales-list",

        statusBoxId:
            "maestria-tutorial-status-box",

        formTitleId:
            "maestria-tutorial-form-title",

        cancelBtnId:
            "cancel-maestria-tutorial-edit-btn",

        filterCentroId:
            "filter-maestria-tutorial-centro",

        formCentroId:
            "maestria-tutorial-centro",

        idInputId:
            "maestria-tutorial-id",

        orderInputId:
            "maestria-tutorial-orden",

        manualToggleId:
            "maestria-tutorial-manual-order-toggle",

        uploadInputId:
            "maestria-tutorial-video",

        currentFileBoxId:
            "maestria-tutorial-video-actual-box",

        endpointList:
            "/maestria/admin/tutoriales/list",

        endpointCreate:
            "/maestria/admin/tutoriales",

        endpointUpdateBase:
            "/maestria/admin/tutoriales",

        endpointDeleteBase:
            "/maestria/admin/tutoriales",

        uploadFieldName:
            "video",

        titleDefault:
            "Nuevo tutorial",

        titleField:
            "titulo",

        getFileTypeLabel,

        emptyMessage: centro =>
            `No hay tutoriales registrados para ${escapeHtml(getCenterLabel(centro))}.`,

        validate() {

            const titulo =
                document.getElementById("maestria-tutorial-titulo")
                    .value
                    .trim();

            const youtube =
                document.getElementById("maestria-tutorial-youtube")
                    .value
                    .trim();

            const video =
                document.getElementById("maestria-tutorial-video")
                    .files[0];

            const currentId =
                document.getElementById("maestria-tutorial-id")
                    .value;

            if (!titulo) {

                throw new Error(
                    "El título es obligatorio."
                );

            }

            if (
                !youtube
                && !video
                && !currentId
            ) {

                throw new Error(
                    "Debes subir un video o agregar un enlace de YouTube."
                );

            }

        },

        buildFormData({
            centro,
            uploadInput,
            selectedOrder
        }) {

            const formData =
                new FormData();

            formData.append(
                "centro",
                centro
            );

            formData.append(
                "titulo",
                document.getElementById("maestria-tutorial-titulo")
                    .value
                    .trim()
            );

            formData.append(
                "descripcion",
                document.getElementById("maestria-tutorial-descripcion")
                    .value
                    .trim()
            );

            formData.append(
                "youtube_url",
                document.getElementById("maestria-tutorial-youtube")
                    .value
                    .trim()
            );

            formData.append(
                "orden_visual",
                Number(selectedOrder)
            );

            formData.append(
                "activo",
                document.getElementById("maestria-tutorial-activo")
                    .value === "true"
            );

            if (uploadInput.files[0]) {

                formData.append(
                    "video",
                    uploadInput.files[0]
                );

            }

            return formData;

        },

        fillForm(item) {

            document.getElementById("maestria-tutorial-centro")
                .value =
                item.centro || "vs";

            document.getElementById("maestria-tutorial-titulo")
                .value =
                item.titulo || "";

            document.getElementById("maestria-tutorial-descripcion")
                .value =
                item.descripcion || "";

            document.getElementById("maestria-tutorial-youtube")
                .value =
                item.youtube_url || "";

            document.getElementById("maestria-tutorial-orden")
                .value =
                item.orden_visual ?? 0;

            document.getElementById("maestria-tutorial-activo")
                .value =
                String(!!item.activo);

            document.getElementById("maestria-tutorial-manual-order-toggle")
                .checked = false;

            renderCurrentFile({
                box: document.getElementById("maestria-tutorial-video-actual-box"),
                item,
                kind: "video",
                uploadsBase: UPLOADS_BASE,
                escapeHtml,
                getFileTypeLabel
            });

        },

        renderItem(item) {

            return `
                <article class="admin-item">

                    <div class="admin-item-top">

                        <div>

                            <span class="admin-badge">
                                ${escapeHtml(getCenterLabel(item.centro))}
                            </span>

                            <span class="admin-badge ${item.activo ? "active" : "inactive"}">
                                ${item.activo ? "Activo" : "Inactivo"}
                            </span>

                        </div>

                        <div>

                            <span class="admin-badge">
                                Orden:
                                ${escapeHtml(item.orden_visual ?? 0)}
                            </span>

                        </div>

                    </div>

                    <h3>
                        ${escapeHtml(item.titulo)}
                    </h3>

                    ${item.descripcion
                        ? `<p><strong>Descripción:</strong> ${escapeHtml(item.descripcion)}</p>`
                        : ""
                    }

                    ${item.video_nombre_original
                        ? `<p><strong>Video:</strong> ${escapeHtml(item.video_nombre_original)}</p>`
                        : ""
                    }

                    ${item.youtube_url
                        ? `<p><strong>YouTube:</strong> ${escapeHtml(item.youtube_url)}</p>`
                        : ""
                    }

                    <div class="admin-item-actions">

                        <button
                            class="btn-warning"
                            onclick='maestriaTutorialesModule.edit(${JSON.stringify(item).replace(/'/g, "&apos;")})'
                        >
                            Editar
                        </button>

                        <button
                            class="btn-danger"
                            onclick="maestriaTutorialesModule.remove(${item.id})"
                        >
                            Eliminar
                        </button>

                    </div>

                </article>
            `;

        }

    });

applyCenterRestrictions([
    infoCentroSelect
]);

loadMaestriaInfo();

AdminLayout.initSidebarPanels("panel-info");