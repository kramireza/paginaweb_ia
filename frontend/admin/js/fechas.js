const {
    API,

    adminUser,

    requireAuth,
    logout,

    getAuthHeaders,
    safeJson,

    showStatus,
    clearStatus,

    applyCenterRestrictions,
    getAllowedCenters,

    getItemsByCenter,
    getNextOrder,

    getCenterLabel,

    sortByOrder,

    ensureAllowedCenter,

    handleProtectedResponse,

    escapeHtml
} = window.AdminCore;

const {
    createTextModule
} = window.AdminCrud;

if (!requireAuth()) {
    throw new Error("No autorizado");
}

window.AdminLayout.initSidebar();

document.getElementById("logout-btn")
    ?.addEventListener("click", logout);

const allowedCenters =
    getAllowedCenters(adminUser);

const ordenVisualInput =
    document.getElementById("orden_visual");

const manualOrderToggle =
    document.getElementById("manual-order-toggle");

const centroSelect =
    document.getElementById("centro");

const filterCentroSelect =
    document.getElementById("filter-centro");

let fechasCache = [];

function getSelectedFilterCenter() {

    return filterCentroSelect?.value
        || allowedCenters[0]
        || "vs";

}

function getSelectedFormCenter() {

    return centroSelect?.value
        || allowedCenters[0]
        || "vs";

}

function updateOrderFieldState() {

    const manual =
        manualOrderToggle.checked;

    ordenVisualInput.readOnly =
        !manual;

    if (manual) return;

    const centroActivo =
        getSelectedFormCenter();

    const filtered =
        getItemsByCenter(
            fechasCache,
            centroActivo
        );

    ordenVisualInput.value =
        getNextOrder(filtered);

}

manualOrderToggle?.addEventListener(
    "change",
    updateOrderFieldState
);

centroSelect?.addEventListener(
    "change",
    updateOrderFieldState
);

function formatDate(fecha) {

    if (!fecha) return "Sin fecha";

    const date =
        new Date(`${fecha}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return fecha;
    }

    return date.toLocaleDateString(
        "es-HN",
        {
            year: "numeric",
            month: "long",
            day: "2-digit"
        }
    );

}

function validateFechaForm() {

    const titulo =
        document.getElementById("titulo")
            .value
            .trim();

    const descripcion =
        document.getElementById("descripcion")
            .value
            .trim();

    const fecha =
        document.getElementById("fecha")
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

    if (!descripcion) {
        throw new Error(
            "La descripción es obligatoria."
        );
    }

    if (descripcion.length < 8) {
        throw new Error(
            "La descripción debe tener al menos 8 caracteres."
        );
    }

    if (!fecha) {
        throw new Error(
            "La fecha es obligatoria."
        );
    }

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ) {
        throw new Error(
            "La fecha no tiene un formato válido."
        );
    }

}

function buildFechaPayload(selectedOrder) {

    return {

        centro:
            document.getElementById("centro")
                .value,

        titulo:
            document.getElementById("titulo")
                .value
                .trim(),

        descripcion:
            document.getElementById("descripcion")
                .value
                .trim(),

        fecha:
            document.getElementById("fecha")
                .value,

        orden_visual:
            Number(selectedOrder),

        activo:
            document.getElementById("activo")
                .checked

    };

}

function fillFechaForm(item) {

    document.getElementById("titulo")
        .value =
        item.titulo || "";

    document.getElementById("descripcion")
        .value =
        item.descripcion || "";

    document.getElementById("fecha")
        .value =
        item.fecha || "";

    document.getElementById("orden_visual")
        .value =
        item.orden_visual ?? 0;

    document.getElementById("activo")
        .checked =
        !!item.activo;

    document.getElementById("manual-order-toggle")
        .checked = false;

    updateOrderFieldState();

}

function renderFechaItem(item) {

    return `
        <article class="admin-item">

            <div class="admin-item-top">

                <div>

                    <span class="admin-badge">
                        ${escapeHtml(
                            getCenterLabel(item.centro)
                        )}
                    </span>

                    <span class="admin-badge ${item.activo ? "active" : "inactive"}">
                        ${item.activo ? "Activa" : "Inactiva"}
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
                ${escapeHtml(
                    formatDate(item.fecha)
                )}
            </p>

            <p>
                <strong>Descripción:</strong>
                ${escapeHtml(item.descripcion || "")}
            </p>

            <div class="admin-item-actions">

                <button
                    class="btn-warning"
                    onclick='edit_fecha_form(${JSON.stringify(item).replace(/'/g, "&apos;")})'
                >
                    Editar
                </button>

                <button
                    class="btn-danger"
                    onclick="delete_fecha_form(${item.id})"
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

    formId:
        "fecha-form",

    listId:
        "fechas-list",

    statusBoxId:
        "status-box",

    formTitleId:
        "form-title",

    cancelBtnId:
        "cancel-edit-btn",

    filterCentroId:
        "filter-centro",

    formCentroId:
        "centro",

    idInputId:
        "fecha-id",

    orderInputId:
        "orden_visual",

    manualToggleId:
        "manual-order-toggle",

    endpointList:
        "/fechas/admin/list",

    endpointCreate:
        "/fechas/admin",

    endpointUpdateBase:
        "/fechas/admin",

    endpointDeleteBase:
        "/fechas/admin",

    validate:
        validateFechaForm,

    buildPayload:
        buildFechaPayload,

    fillForm:
        fillFechaForm,

    renderItem:
        renderFechaItem,

    emptyMessage: centro =>
        `No hay fechas registradas para ${escapeHtml(getCenterLabel(centro))}.`,

    titleDefault:
        "Nueva fecha importante",

    titleField:
        "titulo",

    onAfterLoad(items) {

        fechasCache = items;

        updateOrderFieldState();

    }

});

applyCenterRestrictions([
    centroSelect,
    filterCentroSelect
]);

if (
    centroSelect
    && filterCentroSelect
) {

    centroSelect.value =
        filterCentroSelect.value;

}

updateOrderFieldState();