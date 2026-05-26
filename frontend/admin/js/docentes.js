const {
    API,
    UPLOADS_BASE: FILES_BASE,

    adminUser,

    requireAuth,
    logout,

    getAuthHeaders,
    safeJson,

    escapeHtml,

    showStatus,
    clearStatus,

    applyCenterRestrictions,
    getAllowedCenters,

    getCenterLabel,
    getImageUrl,

    sortByOrder,

    ensureAllowedCenter,

    handleProtectedResponse
} = window.AdminCore;

const {
    renderCurrentFile,
    setupImagePreview,
    clearImagePreview
} = window.AdminUpload;

const {
    createUploadModule
} = window.AdminCrud;

if (!requireAuth()) {
    throw new Error("No autorizado");
}

window.AdminLayout.initSidebar("panel-form");

document.getElementById("logout-btn")
    ?.addEventListener("click", logout);

const allowedCenters =
    getAllowedCenters(adminUser);

const previewWrap =
    document.getElementById("preview-wrap");

const previewImage =
    document.getElementById("preview-image");

const fotoInput =
    document.getElementById("foto");

setupImagePreview({
    input: fotoInput,
    previewWrap,
    previewImage
});

function getImageTypeLabel(tipo) {

    const map = {
        png: "PNG",
        jpg: "JPG",
        jpeg: "JPG",
        webp: "WEBP"
    };

    return map[
        String(tipo || "").toLowerCase()
    ] || (
        tipo
            ? String(tipo).toUpperCase()
            : "Imagen"
    );

}

const docentesModule =
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
            "docente-form",

        listId:
            "docentes-list",

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
            "docente-id",

        orderInputId:
            "orden_visual",

        uploadInputId:
            "foto",

        currentFileBoxId:
            "preview-wrap",

        endpointList:
            "/docentes/admin/list",

        endpointCreate:
            "/docentes/admin",

        endpointUpdateBase:
            "/docentes/admin",

        endpointDeleteBase:
            "/docentes/admin",

        uploadFieldName:
            "archivo",

        titleDefault:
            "Nuevo docente",

        titleField:
            "nombre",

        getFileTypeLabel:
            getImageTypeLabel,

        emptyMessage: centro =>
            `No hay docentes registrados para ${escapeHtml(getCenterLabel(centro))}.`,

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
                "nombre",
                document.getElementById("nombre")
                    .value
                    .trim()
            );

            formData.append(
                "cargo",
                document.getElementById("cargo")
                    .value
                    .trim()
            );

            formData.append(
                "correo",
                document.getElementById("correo")
                    .value
                    .trim()
            );

            formData.append(
                "telefono",
                document.getElementById("telefono")
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
                "orden_visual",
                orderInput.value || 0
            );

            formData.append(
                "activo",
                document.getElementById("activo")
                    .checked
            );

            formData.append(
                "foto_actual",
                document.getElementById("foto_actual")
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

            document.getElementById("foto_actual")
                .value =
                item.foto_url || "";

            document.getElementById("nombre")
                .value =
                item.nombre || "";

            document.getElementById("cargo")
                .value =
                item.cargo || "";

            document.getElementById("correo")
                .value =
                item.correo || "";

            document.getElementById("telefono")
                .value =
                item.telefono || "";

            document.getElementById("descripcion")
                .value =
                item.descripcion || "";

            document.getElementById("orden_visual")
                .value =
                item.orden_visual ?? 0;

            document.getElementById("activo")
                .checked =
                !!item.activo;

            if (item.foto_url) {

                previewImage.src =
                    getImageUrl(item.foto_url);

                previewWrap.style.display =
                    "block";

            } else {

                clearImagePreview({
                    previewWrap,
                    previewImage
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
                                ${escapeHtml(item.cargo || "Sin especificar")}
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
                                    onclick='docentesModule.edit(${JSON.stringify(item).replace(/'/g, "&apos;")})'
                                >
                                    Editar
                                </button>

                                <button
                                    class="btn-danger"
                                    onclick="docentesModule.remove(${item.id})"
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