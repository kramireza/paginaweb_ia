const {
    API,

    requireAuth,
    logout,

    adminUser,

    getAuthHeaders,
    safeJson,

    escapeHtml,

    showStatus,
    clearStatus,

    applyCenterRestrictions,
    getAllowedCenters,

    getItemsByCenter,
    getNextOrder,

    getCenterLabel,

    sortByOrder,

    ensureAllowedCenter,

    handleProtectedResponse
} = window.AdminCore;

const {
    createTextModule
} = window.AdminCrud;

if (!requireAuth()) {
    throw new Error("No autorizado");
}

window.AdminLayout.initSidebar("panel-form");

const allowedCenters =
    getAllowedCenters(adminUser);

document.getElementById("logout-btn")
    ?.addEventListener("click", logout);

function validateAvisoForm() {

    const titulo =
        document.getElementById("titulo")
            .value
            .trim();

    const resumen =
        document.getElementById("resumen")
            .value
            .trim();

    const fecha =
        document.getElementById("fecha_publicacion")
            .value
            .trim();

    const enlace =
        document.getElementById("enlace")
            .value
            .trim();

    if (!titulo) {
        throw new Error(
            "El título es obligatorio."
        );
    }

    if (titulo.length < 3) {
        throw new Error(
            "El título debe tener al menos 3 caracteres."
        );
    }

    if (!resumen) {
        throw new Error(
            "El resumen es obligatorio."
        );
    }

    if (resumen.length < 10) {
        throw new Error(
            "El resumen debe tener al menos 10 caracteres."
        );
    }

    if (
        fecha
        && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ) {
        throw new Error(
            "La fecha de publicación no tiene un formato válido."
        );
    }

    if (
        enlace
        && /\s/.test(enlace)
    ) {
        throw new Error(
            "El enlace no debe contener espacios."
        );
    }

}

function buildAvisoPayload(selectedOrder) {

    return {

        centro:
            document.getElementById("centro")
                .value,

        titulo:
            document.getElementById("titulo")
                .value
                .trim(),

        categoria:
            document.getElementById("categoria")
                .value
                .trim(),

        resumen:
            document.getElementById("resumen")
                .value
                .trim(),

        contenido:
            document.getElementById("contenido")
                .value
                .trim(),

        fecha_publicacion:
            document.getElementById("fecha_publicacion")
                .value,

        orden_visual:
            Number(selectedOrder),

        enlace:
            document.getElementById("enlace")
                .value
                .trim(),

        destacado:
            document.getElementById("destacado")
                .checked,

        activo:
            document.getElementById("activo")
                .checked

    };

}

function fillAvisoForm(item) {

    document.getElementById("titulo")
        .value = item.titulo || "";

    document.getElementById("categoria")
        .value = item.categoria || "";

    document.getElementById("resumen")
        .value = item.resumen || "";

    document.getElementById("contenido")
        .value = item.contenido || "";

    document.getElementById("fecha_publicacion")
        .value = item.fecha_publicacion || "";

    document.getElementById("orden_visual")
        .value = item.orden_visual ?? 0;

    document.getElementById("enlace")
        .value = item.enlace || "";

    document.getElementById("destacado")
        .checked = !!item.destacado;

    document.getElementById("activo")
        .checked = !!item.activo;

}

function renderAvisoItem(item) {

    return `
        <article class="admin-item ${item.destacado ? "featured" : ""}">

            <div class="admin-item-top">

                <div>

                    <span class="admin-badge">
                        ${escapeHtml(
                            getCenterLabel(item.centro)
                        )}
                    </span>

                    <span class="admin-badge">
                        ${escapeHtml(
                            item.categoria || "General"
                        )}
                    </span>

                    ${item.destacado
                        ? `
                            <span class="admin-badge">
                                Destacado
                            </span>
                        `
                        : ""
                    }

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

            <p>
                <strong>Fecha:</strong>
                ${escapeHtml(
                    item.fecha_publicacion || "Sin fecha"
                )}
            </p>

            <p>
                <strong>Resumen:</strong>
                ${escapeHtml(item.resumen || "")}
            </p>

            ${item.contenido
                ? `
                    <p>
                        <strong>Contenido:</strong>
                        ${escapeHtml(item.contenido)}
                    </p>
                `
                : ""
            }

            ${item.enlace
                ? `
                    <p>
                        <strong>Enlace:</strong>
                        ${escapeHtml(item.enlace)}
                    </p>
                `
                : ""
            }

            <div class="admin-item-actions">

                <button
                    class="btn-warning"
                    onclick='edit_aviso-form(${JSON.stringify(item).replace(/'/g, "&apos;")})'
                >
                    Editar
                </button>

                <button
                    class="btn-danger"
                    onclick="delete_aviso-form(${item.id})"
                >
                    Eliminar
                </button>

            </div>

        </article>
    `;

}

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

    sortByOrder,

    getCenterLabel,

    handleProtectedResponse,

    formId: "aviso-form",

    listId: "avisos-list",

    statusBoxId: "status-box",

    formTitleId: "form-title",

    cancelBtnId: "cancel-edit-btn",

    filterCentroId: "filter-centro",

    formCentroId: "centro",

    idInputId: "aviso-id",

    orderInputId: "orden_visual",

    manualToggleId: "manual-order-toggle",

    endpointList:
        "/avisos/admin/list",

    endpointCreate:
        "/avisos/admin",

    endpointUpdateBase:
        "/avisos/admin",

    endpointDeleteBase:
        "/avisos/admin",

    validate:
        validateAvisoForm,

    buildPayload:
        buildAvisoPayload,

    fillForm:
        fillAvisoForm,

    renderItem:
        renderAvisoItem,

    emptyMessage: centro =>
        `No hay avisos registrados para ${escapeHtml(getCenterLabel(centro))}.`,

    titleDefault:
        "Nuevo aviso",

    titleField:
        "titulo"

});