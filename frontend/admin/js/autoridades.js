if (!window.AdminCore.requireAuth()) {
    throw new Error("No autorizado");
}

window.AdminLayout.initSidebar("panel-form");

const {
    API,
    UPLOADS_BASE: FILES_BASE,

    adminUser,

    getAuthHeaders,
    safeJson,

    escapeHtml,

    showStatus,
    clearStatus,

    applyCenterRestrictions,
    getAllowedCenters,

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

const allowedCenters =
    getAllowedCenters(adminUser);

/* =========================
   ELEMENTOS AUTORIDADES
========================= */

const previewWrap =
    document.getElementById("preview-wrap");

const previewImage =
    document.getElementById("preview-image");

const fotoInput =
    document.getElementById("foto");

const cargoSelect =
    document.getElementById("cargo");

const ordenVisualInput =
    document.getElementById("orden_visual");

const manualOrderToggle =
    document.getElementById("manual-order-toggle");

const centroSelect =
    document.getElementById("centro");

const filterCentroSelect =
    document.getElementById("filter-centro");

/* =========================
   ELEMENTOS INFO GENERAL
========================= */

const autoridadesInfoForm =
    document.getElementById("autoridades-info-form");

const autoridadesInfoIdInput =
    document.getElementById("autoridades-info-id");

const autoridadesInfoCentroSelect =
    document.getElementById("autoridades-info-centro");

const autoridadesInfoTituloInput =
    document.getElementById("autoridades-info-titulo");

const autoridadesInfoDescripcionInput =
    document.getElementById("autoridades-info-descripcion");

const autoridadesInfoActivoInput =
    document.getElementById("autoridades-info-activo");

const autoridadesInfoStatusBox =
    document.getElementById("autoridades-info-status-box");

const autoridadesInfoCurrent =
    document.getElementById("autoridades-info-current");

const reloadAutoridadesInfoBtn =
    document.getElementById("reload-autoridades-info-btn");

document.getElementById("logout-btn")
    ?.addEventListener(
        "click",
        window.AdminCore.logout
    );

setupImagePreview({
    input: fotoInput,
    previewWrap,
    previewImage
});

const CARGO_ORDER_MAP = {
    "Presidencia": 1,
    "Vice-Presidencia": 2,
    "Secretaria General": 3,
    "Secretaria de Finanzas": 4,
    "Pro-Secretaria de Finanzas": 5,
    "Fiscalia": 6,
    "Secretaria de Accion Social": 7,
    "Pro-Secretaria de Accion Social": 8,
    "Secretaria de Publicidad": 9,
    "Pro-Secretaria de Publicidad": 10,
    "Secretaria del Interior": 11,
    "Pro-Secretaria del Interior": 12,
    "Secretaria de Relaciones Exteriores": 13,
    "Pro-Secretaria de Relaciones": 14,
    "Vocal": 15
};

function getCenterLabel(centro) {

    const map = {
        vs: "UNAH-VS",
        cu: "Ciudad Universitaria",
        danli: "UNAH Danlí"
    };

    return map[
        String(centro || "").toLowerCase()
    ] || "Sin centro";

}

function getCargoOrder(cargo) {

    return CARGO_ORDER_MAP[cargo]
        ?? 999;

}

function getSelectedFilterCenter() {

    return filterCentroSelect?.value
        || allowedCenters[0]
        || "vs";

}

function getSelectedInfoCenter() {

    return autoridadesInfoCentroSelect?.value
        || allowedCenters[0]
        || "vs";

}

function updateOrderFieldState() {

    const manual =
        manualOrderToggle.checked;

    ordenVisualInput.readOnly =
        !manual;

    if (!manual) {
        applySuggestedOrder();
    }

}

function applySuggestedOrder() {

    if (manualOrderToggle.checked) {
        return;
    }

    const cargo =
        cargoSelect.value;

    if (!cargo) {

        ordenVisualInput.value = 0;

        return;

    }

    ordenVisualInput.value =
        getCargoOrder(cargo);

}

cargoSelect?.addEventListener(
    "change",
    applySuggestedOrder
);

manualOrderToggle?.addEventListener(
    "change",
    updateOrderFieldState
);

function validateAutoridadForm() {

    const nombre =
        document.getElementById("nombre")
            .value
            .trim();

    const cargo =
        document.getElementById("cargo")
            .value
            .trim();

    const correo =
        document.getElementById("correo")
            .value
            .trim();

    if (!nombre) {
        throw new Error(
            "El nombre completo es obligatorio."
        );
    }

    if (nombre.length < 5) {
        throw new Error(
            "El nombre completo debe tener al menos 5 caracteres."
        );
    }

    if (!cargo) {
        throw new Error(
            "Debes seleccionar un cargo."
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

}

const autoridadesModule =
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
            "autoridad-form",

        listId:
            "autoridades-list",

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
            "autoridad-id",

        orderInputId:
            "orden_visual",

        uploadInputId:
            "foto",

        currentFileBoxId:
            "preview-wrap",

        endpointList:
            "/autoridades/admin/list",

        endpointCreate:
            "/autoridades/admin",

        endpointUpdateBase:
            "/autoridades/admin",

        endpointDeleteBase:
            "/autoridades/admin",

        uploadFieldName:
            "archivo",

        titleDefault:
            "Nueva autoridad",

        titleField:
            "nombre",

        getFileTypeLabel:
            () => "Imagen",

        emptyMessage: centro =>
            `No hay autoridades registradas para ${escapeHtml(getCenterLabel(centro))}.`,

        buildFormData({
            centro,
            uploadInput,
            orderInput
        }) {

            const selectedCargo =
                document.getElementById("cargo")
                    .value;

            const selectedOrder =
                manualOrderToggle.checked
                    ? Number(
                        orderInput.value
                        || getCargoOrder(selectedCargo)
                    )
                    : getCargoOrder(selectedCargo);

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
                selectedCargo
            );

            formData.append(
                "periodo",
                document.getElementById("periodo")
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
                selectedOrder
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

            document.getElementById("periodo")
                .value =
                item.periodo || "";

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
                item.orden_visual
                ?? getCargoOrder(item.cargo);

            document.getElementById("activo")
                .checked =
                !!item.activo;

            document.getElementById("manual-order-toggle")
                .checked = false;

            updateOrderFieldState();

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
                                        ${escapeHtml(item.orden_visual ?? getCargoOrder(item.cargo))}
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

                            ${item.periodo
                                ? `
                                    <p>
                                        <strong>Período:</strong>
                                        ${escapeHtml(item.periodo)}
                                    </p>
                                `
                                : ""
                            }

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
                                    onclick='autoridadesModule.edit(${JSON.stringify(item).replace(/'/g, "&apos;")})'
                                >
                                    Editar
                                </button>

                                <button
                                    class="btn-danger"
                                    onclick="autoridadesModule.remove(${item.id})"
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

function showInfoStatus(message, type = "info") {
    autoridadesInfoStatusBox.textContent = message;
    autoridadesInfoStatusBox.className = `admin-status show ${type}`;
}

function clearInfoStatus() {
    autoridadesInfoStatusBox.textContent = "";
    autoridadesInfoStatusBox.className = "admin-status";
}


function resetInfoForm(keepCenter = true) {
    autoridadesInfoForm.reset();
    autoridadesInfoIdInput.value = "";
    autoridadesInfoTituloInput.value = "Directiva estudiantil";
    autoridadesInfoActivoInput.checked = true;

    if (keepCenter && autoridadesInfoCentroSelect) {
        autoridadesInfoCentroSelect.value = getSelectedFilterCenter();
    }

    clearInfoStatus();
}

function validateInfoForm() {
    const titulo = autoridadesInfoTituloInput.value.trim();
    const descripcion = autoridadesInfoDescripcionInput.value.trim();

    if (!titulo) throw new Error("El título de la descripción general es obligatorio.");
    if (!descripcion) throw new Error("La descripción general es obligatoria.");
    if (descripcion.length < 20) throw new Error("La descripción general debe tener al menos 20 caracteres.");
}


async function loadAutoridadesInfo() {
    const centroActivo = getSelectedInfoCenter();

    autoridadesInfoCurrent.innerHTML = `<div class="admin-empty">Cargando información...</div>`;

    try {
        const res = await fetch(`${API}/autoridades/admin/info?centro=${encodeURIComponent(centroActivo)}`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (res.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudo cargar la información general.");
        }

        resetInfoForm(false);

        if (!data.item) {
            autoridadesInfoIdInput.value = "";
            autoridadesInfoTituloInput.value = "Directiva estudiantil";
            autoridadesInfoDescripcionInput.value = "";
            autoridadesInfoActivoInput.checked = true;

            autoridadesInfoCurrent.innerHTML = `
                <div class="admin-empty">
                    No hay descripción general registrada para ${escapeHtml(getCenterLabel(centroActivo))}. Puedes crearla desde este mismo formulario.
                </div>
            `;
            return;
        }

        const item = data.item;

        autoridadesInfoIdInput.value = item.id || "";
        autoridadesInfoTituloInput.value = item.titulo || "Directiva estudiantil";
        autoridadesInfoDescripcionInput.value = item.descripcion || "";
        autoridadesInfoActivoInput.checked = !!item.activo;

        autoridadesInfoCurrent.innerHTML = `
            <article class="admin-item">
                <div>
                    <div class="admin-item-top">
                        <div>
                            <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                            <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activo" : "Inactivo"}</span>
                        </div>
                    </div>

                    <h3>${escapeHtml(item.titulo || "Directiva estudiantil")}</h3>
                    <p><strong>Descripción:</strong> ${escapeHtml(item.descripcion || "")}</p>
                </div>
            </article>
        `;
    } catch (error) {
        console.error(error);
        autoridadesInfoCurrent.innerHTML = `<div class="admin-empty">Error al cargar la información general.</div>`;
        showInfoStatus(error.message, "error");
    }
}

autoridadesInfoForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearInfoStatus();

    try {
        validateInfoForm();

        const centro = getSelectedInfoCenter();

        if (!allowedCenters.includes(centro)) {
            throw new Error("No tienes permisos para usar ese centro.");
        }

        const payload = {
            centro,
            titulo: autoridadesInfoTituloInput.value.trim(),
            descripcion: autoridadesInfoDescripcionInput.value.trim(),
            activo: autoridadesInfoActivoInput.checked
        };

        const res = await fetch(`${API}/autoridades/admin/info`, {
            method: "POST",
            headers: getAuthHeaders(true),
            credentials: "include",
            body: JSON.stringify(payload)
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (res.status === 403 && String(data.message || "").toLowerCase().includes("contraseña")) {
                window.location.href = "./change-password.html";
                return;
            }
            throw new Error(data.message || "No se pudo guardar la descripción general.");
        }

        showInfoStatus("Descripción general guardada correctamente.", "success");
        loadAutoridadesInfo();
    } catch (error) {
        console.error(error);
        showInfoStatus(error.message, "error");
    }
});

applyCenterRestrictions([
    centroSelect,
    filterCentroSelect,
    autoridadesInfoCentroSelect
]);

if (centroSelect && filterCentroSelect) {
    centroSelect.value = filterCentroSelect.value;
}

if (autoridadesInfoCentroSelect && filterCentroSelect) {
    autoridadesInfoCentroSelect.value = filterCentroSelect.value;
}

updateOrderFieldState();
loadAutoridadesInfo();