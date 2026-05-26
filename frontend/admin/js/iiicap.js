const {
    API,
    UPLOADS_BASE: FILES_BASE,

    adminUser,

    requireAuth,
    logout,

    getAuthHeaders,

    getAllowedCenters,
    ensureAllowedCenter,
    applyCenterRestrictions,

    escapeHtml,
    safeJson,

    showStatus,
    clearStatus,

    getCenterLabel,

    sortByOrder,

    getItemsByCenter,
    getNextOrder,

    handleProtectedResponse
} = window.AdminCore;

const {
    createTextModule,
    createUploadModule
} = window.AdminCrud;

const {
    setupImagePreview,
    clearImagePreview
} = window.AdminUpload;

if (!requireAuth()) {
    throw new Error("No autorizado");
}

window.AdminLayout.initSidebar();

const allowedCenters = getAllowedCenters(adminUser);

document.getElementById("logout-btn")
    ?.addEventListener("click", logout);

function getImageUrl(fileUrl) {

    if (!fileUrl) {
        return "../assets/images/docente1.jpg";
    }

    if (
        fileUrl.startsWith("http://")
        || fileUrl.startsWith("https://")
    ) {
        return fileUrl;
    }

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

    return map[
        String(tipo || "").toLowerCase()
    ] || (
        tipo
            ? String(tipo).toUpperCase()
            : "Archivo"
    );

}

/* =========================
   INFO GENERAL
========================= */

const infoCentroSelect =
    document.getElementById("iiicap-info-centro");

const iiicapInfoModule =
    createTextModule({

        API,

        allowedCenters,

        getAuthHeaders,
        safeJson,

        showStatus,
        clearStatus,

        applyCenterRestrictions,
        ensureAllowedCenter,

        handleProtectedResponse,

        escapeHtml,
        getCenterLabel,

        formId:
            "iiicap-info-form",

        listId:
            "iiicap-info-current",

        statusBoxId:
            "iiicap-info-status-box",

        filterCentroId:
            "iiicap-info-centro",

        formCentroId:
            "iiicap-info-centro",

        idInputId:
            "iiicap-info-id",

        endpointList:
            "/iiicap/admin/info/list",

        endpointCreate:
            "/iiicap/admin/info",

        endpointUpdateBase:
            "/iiicap/admin/info",

        endpointDeleteBase:
            "/iiicap/admin/info",

        titleField:
            "titulo",

        emptyMessage: centro =>
            `No hay información registrada para ${escapeHtml(getCenterLabel(centro))}.`,

        validate() {

            const titulo =
                document.getElementById("iiicap-info-titulo")
                    .value
                    .trim();

            const descripcion =
                document.getElementById("iiicap-info-descripcion")
                    .value
                    .trim();

            if (!titulo) {

                throw new Error(
                    "El título es obligatorio."
                );

            }

            if (!descripcion) {

                throw new Error(
                    "La descripción es obligatoria."
                );

            }

            if (descripcion.length < 20) {

                throw new Error(
                    "La descripción debe tener al menos 20 caracteres."
                );

            }

        },

        buildPayload({ centro }) {

            return {
                centro,

                titulo:
                    document.getElementById("iiicap-info-titulo")
                        .value
                        .trim(),

                descripcion:
                    document.getElementById("iiicap-info-descripcion")
                        .value
                        .trim(),

                activo:
                    document.getElementById("iiicap-info-activo")
                        .checked
            };

        },

        fillForm(item) {

            document.getElementById("iiicap-info-id")
                .value =
                item.id || "";

            document.getElementById("iiicap-info-centro")
                .value =
                item.centro || "vs";

            document.getElementById("iiicap-info-titulo")
                .value =
                item.titulo || "IIICAP-IA";

            document.getElementById("iiicap-info-descripcion")
                .value =
                item.descripcion || "";

            document.getElementById("iiicap-info-activo")
                .checked =
                !!item.activo;

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

                    </div>

                    <h3>
                        ${escapeHtml(item.titulo || "IIICAP-IA")}
                    </h3>

                    <p>
                        <strong>Descripción:</strong>
                        ${escapeHtml(item.descripcion || "")}
                    </p>

                </article>
            `;

        }

    });

/* =========================
   ENCARGADOS
========================= */

setupImagePreview({
    input:
        document.getElementById("encargado-foto"),

    previewWrap:
        document.getElementById("encargado-preview-wrap"),

    previewImage:
        document.getElementById("encargado-preview-image")
});

const iiicapEncargadosModule =
    createUploadModule({

        API,
        FILES_BASE,

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

        formId:
            "encargado-form",

        listId:
            "encargados-list",

        statusBoxId:
            "encargado-status-box",

        formTitleId:
            "encargado-form-title",

        cancelBtnId:
            "cancel-encargado-edit-btn",

        filterCentroId:
            "filter-encargado-centro",

        formCentroId:
            "encargado-centro",

        idInputId:
            "encargado-id",

        orderInputId:
            "encargado-orden",

        manualToggleId:
            "encargado-manual-order-toggle",

        uploadInputId:
            "encargado-foto",

        endpointList:
            "/iiicap/admin/encargados/list",

        endpointCreate:
            "/iiicap/admin/encargados",

        endpointUpdateBase:
            "/iiicap/admin/encargados",

        endpointDeleteBase:
            "/iiicap/admin/encargados",

        uploadFieldName:
            "foto",

        titleDefault:
            "Nuevo encargado",

        titleField:
            "nombre",

        emptyMessage: centro =>
            `No hay encargados registrados para ${escapeHtml(getCenterLabel(centro))}.`,

        validate() {

            const nombre =
                document.getElementById("encargado-nombre")
                    .value
                    .trim();

            const cargo =
                document.getElementById("encargado-cargo")
                    .value
                    .trim();

            const correo =
                document.getElementById("encargado-correo")
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

            if (!cargo) {

                throw new Error(
                    "El cargo es obligatorio."
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
                document.getElementById("encargado-nombre")
                    .value
                    .trim()
            );

            formData.append(
                "cargo",
                document.getElementById("encargado-cargo")
                    .value
                    .trim()
            );

            formData.append(
                "correo",
                document.getElementById("encargado-correo")
                    .value
                    .trim()
            );

            formData.append(
                "telefono",
                document.getElementById("encargado-telefono")
                    ?.value
                    ?.trim() || ""
            );

            formData.append(
                "descripcion",
                document.getElementById("encargado-descripcion")
                    .value
                    .trim()
            );

            formData.append(
                "orden_visual",
                Number(selectedOrder)
            );

            formData.append(
                "activo",
                document.getElementById("encargado-activo")
                    .checked
            );

            formData.append(
                "foto_actual",
                document.getElementById("encargado-foto-actual")
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

            document.getElementById("encargado-id")
                .value =
                item.id || "";

            document.getElementById("encargado-foto-actual")
                .value =
                item.foto_url || "";

            document.getElementById("encargado-centro")
                .value =
                item.centro || "vs";

            document.getElementById("encargado-nombre")
                .value =
                item.nombre || "";

            document.getElementById("encargado-cargo")
                .value =
                item.cargo || "";

            document.getElementById("encargado-correo")
                .value =
                item.correo || "";

            const telefonoInput =
                document.getElementById("encargado-telefono");

            if (telefonoInput) {

                telefonoInput.value =
                    item.telefono || "";

            }

            document.getElementById("encargado-descripcion")
                .value =
                item.descripcion || "";

            document.getElementById("encargado-orden")
                .value =
                item.orden_visual ?? 0;

            document.getElementById("encargado-activo")
                .checked =
                !!item.activo;

            document.getElementById("encargado-manual-order-toggle")
                .checked = false;

            if (item.foto_url) {

                document.getElementById("encargado-preview-image")
                    .src =
                    getImageUrl(item.foto_url);

                document.getElementById("encargado-preview-wrap")
                    .style.display =
                    "block";

            } else {

                clearImagePreview({
                    previewWrap:
                        document.getElementById("encargado-preview-wrap"),

                    previewImage:
                        document.getElementById("encargado-preview-image")
                });

            }

        },

        resetExtras() {

            document.getElementById("encargado-foto-actual")
                .value = "";

            clearImagePreview({
                previewWrap:
                    document.getElementById("encargado-preview-wrap"),

                previewImage:
                    document.getElementById("encargado-preview-image")
            });

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

                                    <span class="admin-badge">
                                        Orden:
                                        ${escapeHtml(item.orden_visual ?? 0)}
                                    </span>

                                </div>

                            </div>

                            <h3>
                                ${escapeHtml(item.nombre)}
                            </h3>

                            <p>
                                <strong>Cargo:</strong>
                                ${escapeHtml(item.cargo || "Sin cargo")}
                            </p>

                            ${item.correo
                                ? `
                                    <p>
                                        <strong>Correo:</strong>
                                        ${escapeHtml(item.correo)}
                                    </p>
                                `
                                : ""
                            }

                            ${item.telefono
                                ? `
                                    <p>
                                        <strong>Teléfono:</strong>
                                        ${escapeHtml(item.telefono)}
                                    </p>
                                `
                                : ""
                            }

                            ${item.descripcion
                                ? `
                                    <p>
                                        <strong>Descripción:</strong>
                                        ${escapeHtml(item.descripcion)}
                                    </p>
                                `
                                : ""
                            }

                            <div class="admin-item-actions">

                                <button
                                    class="btn-warning"
                                    onclick='iiicapEncargadosModule.edit(${JSON.stringify(item).replace(/'/g, "&apos;")})'
                                >
                                    Editar
                                </button>

                                <button
                                    class="btn-danger"
                                    onclick="iiicapEncargadosModule.remove(${item.id})"
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
   INVESTIGACIONES
========================= */

const iiicapInvestigacionesModule =
    createUploadModule({

        API,
        FILES_BASE,

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

        renderCurrentFile:
            window.AdminUpload.renderCurrentFile,

        formId:
            "investigacion-form",

        listId:
            "investigaciones-list",

        statusBoxId:
            "investigacion-status-box",

        formTitleId:
            "investigacion-form-title",

        cancelBtnId:
            "cancel-investigacion-edit-btn",

        filterCentroId:
            "filter-investigacion-centro",

        formCentroId:
            "investigacion-centro",

        idInputId:
            "investigacion-id",

        orderInputId:
            "investigacion-orden",

        manualToggleId:
            "investigacion-manual-order-toggle",

        uploadInputId:
            "investigacion-archivo",

        currentFileBoxId:
            "investigacion-archivo-actual-box",

        endpointList:
            "/iiicap/admin/investigaciones/list",

        endpointCreate:
            "/iiicap/admin/investigaciones",

        endpointUpdateBase:
            "/iiicap/admin/investigaciones",

        endpointDeleteBase:
            "/iiicap/admin/investigaciones",

        uploadFieldName:
            "archivo",

        titleDefault:
            "Nueva investigación",

        titleField:
            "titulo",

        getFileTypeLabel,

        emptyMessage: centro =>
            `No hay investigaciones registradas para ${escapeHtml(getCenterLabel(centro))}.`,

        validate() {

            const titulo =
                document.getElementById("investigacion-titulo")
                    .value
                    .trim();

            const descripcion =
                document.getElementById("investigacion-descripcion")
                    .value
                    .trim();

            const fecha =
                document.getElementById("investigacion-fecha")
                    .value
                    .trim();

            const enlace =
                document.getElementById("investigacion-enlace")
                    .value
                    .trim();

            const archivo =
                document.getElementById("investigacion-archivo")
                    .files[0];

            const currentId =
                document.getElementById("investigacion-id")
                    .value;

            if (!titulo) {

                throw new Error(
                    "El título es obligatorio."
                );

            }

            if (!descripcion) {

                throw new Error(
                    "La descripción es obligatoria."
                );

            }

            if (descripcion.length < 10) {

                throw new Error(
                    "La descripción debe tener al menos 10 caracteres."
                );

            }

            if (!fecha) {

                throw new Error(
                    "La fecha es obligatoria."
                );

            }

            if (
                !archivo
                && !enlace
                && !currentId
            ) {

                throw new Error(
                    "Debes subir un archivo o proporcionar un enlace externo."
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
                document.getElementById("investigacion-titulo")
                    .value
                    .trim()
            );

            formData.append(
                "descripcion",
                document.getElementById("investigacion-descripcion")
                    .value
                    .trim()
            );

            formData.append(
                "fecha",
                document.getElementById("investigacion-fecha")
                    .value
                    .trim()
            );

            formData.append(
                "enlace_externo",
                document.getElementById("investigacion-enlace")
                    .value
                    .trim()
            );

            formData.append(
                "autor",
                document.getElementById("investigacion-autor")
                    ?.value
                    ?.trim() || ""
            );

            formData.append(
                "anio",
                document.getElementById("investigacion-anio")
                    ?.value || ""
            );

            formData.append(
                "orden_visual",
                Number(selectedOrder)
            );

            formData.append(
                "activo",
                document.getElementById("investigacion-activo")
                    .checked
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

            document.getElementById("investigacion-id")
                .value =
                item.id || "";

            document.getElementById("investigacion-centro")
                .value =
                item.centro || "vs";

            document.getElementById("investigacion-titulo")
                .value =
                item.titulo || "";

            document.getElementById("investigacion-descripcion")
                .value =
                item.descripcion || "";

            document.getElementById("investigacion-fecha")
                .value =
                item.fecha || "";

            document.getElementById("investigacion-enlace")
                .value =
                item.enlace_externo || "";

            const autorInput =
                document.getElementById("investigacion-autor");

            if (autorInput) {

                autorInput.value =
                    item.autor || "";

            }

            const anioInput =
                document.getElementById("investigacion-anio");

            if (anioInput) {

                anioInput.value =
                    item.anio || "";

            }

            document.getElementById("investigacion-orden")
                .value =
                item.orden_visual ?? 0;

            document.getElementById("investigacion-activo")
                .checked =
                !!item.activo;

            document.getElementById("investigacion-manual-order-toggle")
                .checked = false;

            window.AdminUpload.renderCurrentFile({
                box:
                    document.getElementById("investigacion-archivo-actual-box"),

                item,

                kind:
                    "archivo",

                uploadsBase:
                    FILES_BASE,

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

                            <span class="admin-badge">
                                Orden:
                                ${escapeHtml(item.orden_visual ?? 0)}
                            </span>

                        </div>

                    </div>

                    <h3>
                        ${escapeHtml(item.titulo)}
                    </h3>

                    <p>
                        <strong>Fecha:</strong>
                        ${escapeHtml(item.fecha || "Sin fecha")}
                    </p>

                    <p>
                        <strong>Descripción:</strong>
                        ${escapeHtml(item.descripcion || "")}
                    </p>

                    ${item.archivo_nombre_original
                        ? `
                            <p>
                                <strong>Archivo:</strong>
                                ${escapeHtml(item.archivo_nombre_original)}
                            </p>
                        `
                        : ""
                    }

                    ${item.enlace_externo
                        ? `
                            <p>
                                <strong>Enlace:</strong>

                                <a
                                    href="${escapeHtml(item.enlace_externo)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    ${escapeHtml(item.enlace_externo)}
                                </a>
                            </p>
                        `
                        : ""
                    }

                    <div class="admin-item-actions">

                        <button
                            class="btn-warning"
                            onclick='iiicapInvestigacionesModule.edit(${JSON.stringify(item).replace(/'/g, "&apos;")})'
                        >
                            Editar
                        </button>

                        <button
                            class="btn-danger"
                            onclick="iiicapInvestigacionesModule.remove(${item.id})"
                        >
                            Eliminar
                        </button>

                    </div>

                </article>
            `;

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

iiicapInfoModule.load();
iiicapEncargadosModule.load();
iiicapInvestigacionesModule.load();