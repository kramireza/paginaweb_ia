const {
    API,
    UPLOADS_BASE: FILES_BASE,

    adminUser,

    requireAuth,
    logout,

    getAuthHeaders,

    getAllowedCenters,
    applyCenterRestrictions,
    ensureAllowedCenter,

    escapeHtml,
    safeJson,

    showStatus,
    clearStatus,

    getCenterLabel,

    sortByOrder,

    handleProtectedResponse
} = window.AdminCore;

const {
    renderCurrentFile
} = window.AdminUpload;

const {
    createUploadModule
} = window.AdminCrud;

if (!requireAuth()) {
    throw new Error("No autorizado");
}

window.AdminLayout.initSidebar();

document.getElementById("logout-btn")
    ?.addEventListener("click", logout);

const allowedCenters =
    getAllowedCenters(adminUser);

const statusBox =
    document.getElementById("status-box");

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

const recursosModule =
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

        getCenterLabel,
        sortByOrder,

        handleProtectedResponse,

        renderCurrentFile,

        escapeHtml,

        formId:
            "recurso-form",

        listId:
            "recursos-list",

        statusBoxId:
            "status-box",

        formTitleId:
            "form-title",

        cancelBtnId:
            "cancel-edit-btn",

        formCentroId:
            "centro",

        filterCentroId:
            "filter-centro",

        idInputId:
            "recurso-id",

        orderInputId:
            "orden_visual",

        uploadInputId:
            "archivo",

        currentFileBoxId:
            "archivo-actual-box",

        endpointList:
            "/avisos/admin/recursos/list",

        endpointCreate:
            "/avisos/admin/recursos",

        endpointUpdateBase:
            "/avisos/admin/recursos",

        endpointDeleteBase:
            "/avisos/admin/recursos",

        uploadFieldName:
            "archivo",

        titleDefault:
            "Nuevo recurso",

        titleField:
            "titulo",

        getFileTypeLabel,

        emptyMessage: centro =>
            `No hay recursos registrados para ${escapeHtml(getCenterLabel(centro))}.`,

        buildFormData({
            centro,
            uploadInput,
            orderInput
        }) {

            const formData =
                new FormData();

            formData.append(
                "centro",
                centro
            );

            formData.append(
                "titulo",
                document.getElementById("titulo")
                    .value
                    .trim()
            );

            formData.append(
                "descripcion",
                document.getElementById("descripcion")
                    .value
                    .trim()
            );

            formData.append(
                "enlace_externo",
                document.getElementById("enlace_externo")
                    .value
                    .trim()
            );

            formData.append(
                "orden_visual",
                orderInput.value || 0
            );

            formData.append(
                "activo",
                document.getElementById("activo")
                    .value
            );

            if (uploadInput.files[0]) {

                formData.append(
                    "archivo",
                    uploadInput.files[0]
                );

            }

            return formData;

        },

        beforeSubmit({ id, uploadInput }) {

            if (id) {
                return true;
            }

            const enlace =
                document
                    .getElementById("enlace_externo")
                    .value
                    .trim();

            const tieneArchivo =
                uploadInput.files.length > 0;

            if (!tieneArchivo && !enlace) {

                showStatus(
                    statusBox,
                    "Debes subir un archivo o proporcionar un enlace externo.",
                    "error"
                );

                return false;

            }

            return true;

        },

        fillForm(item) {

            document.getElementById("titulo")
                .value =
                item.titulo || "";

            document.getElementById("descripcion")
                .value =
                item.descripcion || "";

            document.getElementById("enlace_externo")
                .value =
                item.enlace_externo || "";

            document.getElementById("orden_visual")
                .value =
                item.orden_visual ?? 0;

            document.getElementById("activo")
                .value =
                String(!!item.activo);

        },

        renderItem(item) {

            const normalizedUrl =
                item.archivo_url
                    ? `${FILES_BASE}/${String(item.archivo_url)
                        .replace(/^\/informatica-uploads/, "")
                        .replace(/^\/uploads/, "")
                        .replace(/^\/+/, "")}`
                    : "";

            return `
                <article class="admin-item">

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

                                ${item.tipo_archivo
                                    ? `
                                        <span class="admin-badge">
                                            ${escapeHtml(getFileTypeLabel(item.tipo_archivo))}
                                        </span>
                                    `
                                    : ""
                                }

                            </div>

                        </div>

                        <h3>
                            ${escapeHtml(item.titulo)}
                        </h3>

                        ${item.descripcion
                            ? `
                                <p>
                                    <strong>Descripción:</strong>
                                    ${escapeHtml(item.descripcion)}
                                </p>
                            `
                            : ""
                        }

                        ${item.archivo_nombre_original
                            ? `
                                <p>
                                    <strong>Archivo:</strong>
                                    ${escapeHtml(item.archivo_nombre_original)}
                                </p>
                            `
                            : ""
                        }

                        ${normalizedUrl
                            ? `
                                <p>
                                    <strong>Archivo URL:</strong>

                                    <a
                                        href="${normalizedUrl}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Abrir archivo
                                    </a>
                                </p>
                            `
                            : ""
                        }

                        ${item.enlace_externo
                            ? `
                                <p>
                                    <strong>Enlace externo:</strong>

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
                                onclick='recursosModule.edit(${JSON.stringify(item).replace(/'/g, "&apos;")})'
                            >
                                Editar
                            </button>

                            <button
                                class="btn-danger"
                                onclick="recursosModule.remove(${item.id})"
                            >
                                Eliminar
                            </button>

                        </div>

                    </div>

                </article>
            `;

        }

    });