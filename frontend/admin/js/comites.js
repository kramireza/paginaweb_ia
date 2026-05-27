const {
    API,
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
    createTextModule
} = window.AdminCrud;

if (!requireAuth()) {
    throw new Error("No autorizado");
}

window.AdminLayout.initSidebarPanels();

const allowedCenters = getAllowedCenters(adminUser);

const comitesModule =
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

        sortByOrder,

        getItemsByCenter,
        getNextOrder,

        formId:
            "comite-form",

        listId:
            "comites-list",

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
            "comite-id",

        orderInputId:
            "orden_visual",

        manualToggleId:
            "manual-order-toggle",

        endpointList:
            "/comites/admin/list",

        endpointCreate:
            "/comites/admin",

        endpointUpdateBase:
            "/comites/admin",

        endpointDeleteBase:
            "/comites/admin",

        titleDefault:
            "Nuevo comité",

        titleEdit:
            "Editar comité",

        titleField:
            "nombre",

        emptyMessage: centro =>
            `No hay comités registrados para ${escapeHtml(getCenterLabel(centro))}.`,

        validate() {

            const nombre =
                document.getElementById("nombre")
                    .value
                    .trim();

            const descripcion =
                document.getElementById("descripcion")
                    .value
                    .trim();

            if (!nombre) {

                throw new Error(
                    "El nombre del comité es obligatorio."
                );

            }

            if (nombre.length < 3) {

                throw new Error(
                    "El nombre del comité debe tener al menos 3 caracteres."
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

        },

        buildPayload({
            centro,
            selectedOrder
        }) {

            return {
                centro,

                nombre:
                    document.getElementById("nombre")
                        .value
                        .trim(),

                descripcion:
                    document.getElementById("descripcion")
                        .value
                        .trim(),

                encargados:
                    document.getElementById("encargados")
                        .value
                        .trim(),

                orden_visual:
                    Number(selectedOrder),

                activo:
                    document.getElementById("activo")
                        .value === "true"
            };

        },

        fillForm(item) {

            document.getElementById("comite-id")
                .value =
                item.id || "";

            document.getElementById("centro")
                .value =
                item.centro || "vs";

            document.getElementById("nombre")
                .value =
                item.nombre || "";

            document.getElementById("descripcion")
                .value =
                item.descripcion || "";

            document.getElementById("encargados")
                .value =
                item.encargados || "";

            document.getElementById("orden_visual")
                .value =
                item.orden_visual ?? 0;

            document.getElementById("activo")
                .value =
                String(!!item.activo);

            const manualToggle =
                document.getElementById("manual-order-toggle");

            if (manualToggle) {
                manualToggle.checked = false;
            }

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
                        ${escapeHtml(item.nombre)}
                    </h3>

                    <p>
                        <strong>Descripción:</strong>
                        ${escapeHtml(item.descripcion || "")}
                    </p>

                    ${item.encargados
                        ? `
                            <p>
                                <strong>Encargados:</strong>
                                ${escapeHtml(item.encargados)}
                            </p>
                        `
                        : ""
                    }

                    <div class="admin-item-actions">

                        <button
                            class="btn-warning"
                            onclick='comitesModule.edit(${JSON.stringify(item).replace(/'/g, "&apos;")})'
                        >
                            Editar
                        </button>

                        <button
                            class="btn-danger"
                            onclick="comitesModule.remove(${item.id})"
                        >
                            Eliminar
                        </button>

                    </div>

                </article>
            `;

        }

    });

comitesModule.load();