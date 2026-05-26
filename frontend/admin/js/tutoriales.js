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

function getVideoTypeLabel(tipo) {

    const map = {
        mp4: "MP4",
        webm: "WEBM",
        ogg: "OGG"
    };

    return map[
        String(tipo || "").toLowerCase()
    ] || (
        tipo
            ? String(tipo).toUpperCase()
            : "Video"
    );

}

const tutorialesModule =
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
            "tutorial-form",

        listId:
            "tutoriales-list",

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
            "tutorial-id",

        orderInputId:
            "orden_visual",

        uploadInputId:
            "video",

        currentFileBoxId:
            "video-actual-box",

        endpointList:
            "/avisos/admin/tutoriales/list",

        endpointCreate:
            "/avisos/admin/tutoriales",

        endpointUpdateBase:
            "/avisos/admin/tutoriales",

        endpointDeleteBase:
            "/avisos/admin/tutoriales",

        uploadFieldName:
            "video",

        titleDefault:
            "Nuevo tutorial",

        titleField:
            "titulo",

        getFileTypeLabel:
            getVideoTypeLabel,

        emptyMessage: centro =>
            `No hay tutoriales registrados para ${escapeHtml(getCenterLabel(centro))}.`,

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
                "enlace_video",
                document.getElementById("enlace_video")
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
                    "video",
                    uploadInput.files[0]
                );

            }

            return formData;

        },

        fillForm(item) {

            document.getElementById("titulo")
                .value =
                item.titulo || "";

            document.getElementById("descripcion")
                .value =
                item.descripcion || "";

            document.getElementById("enlace_video")
                .value =
                item.enlace_video || "";

            document.getElementById("orden_visual")
                .value =
                item.orden_visual ?? 0;

            document.getElementById("activo")
                .value =
                String(!!item.activo);

        },

        renderItem(item) {

            const normalizedUrl =
                item.video_url
                    ? `${FILES_BASE}/${String(item.video_url)
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

                                ${item.tipo_video
                                    ? `
                                        <span class="admin-badge">
                                            ${escapeHtml(getVideoTypeLabel(item.tipo_video))}
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

                        ${item.video_nombre_original
                            ? `
                                <p>
                                    <strong>Video:</strong>
                                    ${escapeHtml(item.video_nombre_original)}
                                </p>
                            `
                            : ""
                        }

                        ${normalizedUrl
                            ? `
                                <p>
                                    <strong>Archivo:</strong>

                                    <a
                                        href="${normalizedUrl}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Abrir video
                                    </a>
                                </p>
                            `
                            : ""
                        }

                        ${item.enlace_video
                            ? `
                                <p>
                                    <strong>Enlace:</strong>

                                    <a
                                        href="${escapeHtml(item.enlace_video)}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        ${escapeHtml(item.enlace_video)}
                                    </a>
                                </p>
                            `
                            : ""
                        }

                        <div class="admin-item-actions">

                            <button
                                class="btn-warning"
                                onclick='tutorialesModule.edit(${JSON.stringify(item).replace(/'/g, "&apos;")})'
                            >
                                Editar
                            </button>

                            <button
                                class="btn-danger"
                                onclick="tutorialesModule.remove(${item.id})"
                            >
                                Eliminar
                            </button>

                        </div>

                    </div>

                </article>
            `;

        }

    });