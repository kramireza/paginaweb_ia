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

requireAuth();

window.AdminLayout.initSidebar(
    "panel-form"
);

const allowedCenters =
    getAllowedCenters(adminUser);

document.getElementById("logout-btn")
    ?.addEventListener("click", logout);

const reglamentosModule =
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
            "reglamento-form",

        listId:
            "reglamentos-list",

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
            "reglamento-id",

        orderInputId:
            "orden_visual",

        manualToggleId:
            "manual-order-toggle",

        endpointList:
            "/avisos/admin/reglamentos/list",

        endpointCreate:
            "/avisos/admin/reglamentos",

        endpointUpdateBase:
            "/avisos/admin/reglamentos",

        endpointDeleteBase:
            "/avisos/admin/reglamentos",

        titleDefault:
            "Nuevo fragmento",

        titleEdit:
            "Editar fragmento",

        titleField:
            "titulo",

        emptyMessage: centro =>
            `No hay fragmentos de reglamentos registrados para ${escapeHtml(getCenterLabel(centro))}.`,

        validate() {

            const titulo =
                document.getElementById("titulo")
                    .value
                    .trim();

            const fragmento =
                document.getElementById("fragmento")
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

            if (!fragmento) {

                throw new Error(
                    "El fragmento es obligatorio."
                );

            }

            if (fragmento.length < 10) {

                throw new Error(
                    "El fragmento debe tener al menos 10 caracteres."
                );

            }

            if (
                enlace
                && !/^https?:\/\/.+/i.test(enlace)
            ) {

                throw new Error(
                    "El enlace debe ser una URL válida."
                );

            }

        },

        buildPayload({
            centro,
            selectedOrder
        }) {

            return {
                centro,

                titulo:
                    document.getElementById("titulo")
                        .value
                        .trim(),

                fragmento:
                    document.getElementById("fragmento")
                        .value
                        .trim(),

                enlace:
                    document.getElementById("enlace")
                        .value
                        .trim(),

                orden_visual:
                    Number(selectedOrder),

                activo:
                    document.getElementById("activo")
                        .checked
            };

        },

        fillForm(item) {

            document.getElementById("reglamento-id")
                .value =
                item.id || "";

            document.getElementById("centro")
                .value =
                item.centro || "vs";

            document.getElementById("titulo")
                .value =
                item.titulo || "";

            document.getElementById("fragmento")
                .value =
                item.fragmento || "";

            document.getElementById("enlace")
                .value =
                item.enlace || "";

            document.getElementById("orden_visual")
                .value =
                item.orden_visual ?? 0;

            document.getElementById("activo")
                .checked =
                !!item.activo;

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
                        ${escapeHtml(item.titulo)}
                    </h3>

                    <p>
                        <strong>Fragmento:</strong>
                        ${escapeHtml(item.fragmento || "")}
                    </p>

                    ${item.enlace
                        ? `
                            <p>
                                <strong>Enlace:</strong>

                                <a
                                    href="${escapeHtml(item.enlace)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    ${escapeHtml(item.enlace)}
                                </a>
                            </p>
                        `
                        : ""
                    }

                    <div class="admin-item-actions">

                        <button
                            class="btn-warning"
                            onclick='reglamentosModule.edit(${JSON.stringify(item).replace(/'/g, "&apos;")})'
                        >
                            Editar
                        </button>

                        <button
                            class="btn-danger"
                            onclick="reglamentosModule.remove(${item.id})"
                        >
                            Eliminar
                        </button>

                    </div>

                </article>
            `;

        }

    });

reglamentosModule.load();