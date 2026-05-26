const AdminCrud = (() => {

    function createTextModule(config) {

        const {
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

            formId,
            listId,
            statusBoxId,
            formTitleId,
            cancelBtnId,
            filterCentroId,
            formCentroId,
            idInputId,
            orderInputId,
            manualToggleId,
            endpointList,
            endpointCreate,
            endpointUpdateBase,
            endpointDeleteBase,
            validate,
            buildPayload,
            fillForm,
            renderItem,
            emptyMessage,
            titleDefault,
            titleField = "titulo"
        } = config;

        const form = document.getElementById(formId);
        const list = document.getElementById(listId);
        const statusBox = document.getElementById(statusBoxId);
        const formTitle = document.getElementById(formTitleId);
        const cancelBtn = document.getElementById(cancelBtnId);
        const filterCentro = document.getElementById(filterCentroId);
        const formCentro = document.getElementById(formCentroId);
        const idInput = document.getElementById(idInputId);
        const orderInput = document.getElementById(orderInputId);
        const manualToggle = document.getElementById(manualToggleId);

        let cache = [];

        function getFilterCenter() {
            return filterCentro?.value || allowedCenters[0] || "vs";
        }

        function getFormCenter() {
            return formCentro?.value || allowedCenters[0] || "vs";
        }

        function getCurrentId() {
            return idInput.value || "";
        }

        function isEditing() {
            return !!getCurrentId();
        }

        function updateOrderFieldState() {

            const manual = manualToggle.checked;

            orderInput.readOnly = !manual;

            if (!manual) {

                if (isEditing()) return;

                const filtered = getItemsByCenter(
                    cache,
                    getFormCenter()
                );

                orderInput.value = getNextOrder(filtered);

            }

        }

        function resetForm() {

            form.reset();

            idInput.value = "";

            manualToggle.checked = false;

            if (formCentro) {
                formCentro.value = getFilterCenter();
            }

            formTitle.textContent = titleDefault;

            updateOrderFieldState();

            clearStatus(statusBox);

        }

        async function load() {

            list.innerHTML =
                `<div class="admin-empty">Cargando...</div>`;

            try {

                const res = await fetch(
                    `${API}${endpointList}?centro=${encodeURIComponent(getFilterCenter())}`,
                    {
                        headers: getAuthHeaders(),
                        credentials: "include"
                    }
                );

                const data = await safeJson(res);

                if (!res.ok || !data.ok) {

                    if (handleProtectedResponse(res, data)) return;

                    throw new Error(
                        data.message
                        || "No se pudo cargar."
                    );

                }

                cache = Array.isArray(data.items)
                    ? data.items
                    : [];

                if (cache.length === 0) {

                    list.innerHTML = `
                        <div class="admin-empty">
                            ${emptyMessage(getFilterCenter())}
                        </div>
                    `;

                    updateOrderFieldState();

                    return;

                }

                const sorted = sortByOrder(
                    cache,
                    titleField
                );

                list.innerHTML =
                    sorted.map(renderItem).join("");

                updateOrderFieldState();

            } catch (error) {

                console.error(error);

                list.innerHTML =
                    `<div class="admin-empty">Error al cargar datos.</div>`;

                showStatus(
                    statusBox,
                    error.message,
                    "error"
                );

            }

        }

        window[`edit_${formId}`] = function(item) {

            if (!ensureAllowedCenter(item.centro)) {

                showStatus(
                    statusBox,
                    "No tienes permisos para editar ese centro.",
                    "error"
                );

                return;

            }

            idInput.value = item.id;

            formCentro.value =
                item.centro || getFilterCenter();

            fillForm(item);

            manualToggle.checked = false;

            updateOrderFieldState();

            formTitle.textContent =
                `Editar ${titleDefault
                    .replace("Nuevo ", "")
                    .replace("Nueva ", "")}`;

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

            showStatus(
                statusBox,
                "Editando registro seleccionado.",
                "info"
            );

        };

        window[`delete_${formId}`] = async function(id) {

            const ok = confirm(
                "¿Seguro que deseas eliminar este registro?"
            );

            if (!ok) return;

            try {

                const res = await fetch(
                    `${API}${endpointDeleteBase}/${id}`,
                    {
                        method: "DELETE",
                        headers: getAuthHeaders(),
                        credentials: "include"
                    }
                );

                const data = await safeJson(res);

                if (!res.ok || !data.ok) {

                    if (handleProtectedResponse(res, data)) return;

                    throw new Error(
                        data.message
                        || "No se pudo eliminar."
                    );

                }

                showStatus(
                    statusBox,
                    "Registro eliminado correctamente.",
                    "success"
                );

                load();

                resetForm();

            } catch (error) {

                console.error(error);

                showStatus(
                    statusBox,
                    error.message,
                    "error"
                );

            }

        };

        cancelBtn?.addEventListener(
            "click",
            resetForm
        );

        manualToggle?.addEventListener(
            "change",
            updateOrderFieldState
        );

        formCentro?.addEventListener("change", () => {

            if (!isEditing()) {
                updateOrderFieldState();
            }

        });

        filterCentro?.addEventListener("change", () => {

            if (!isEditing() && formCentro) {

                formCentro.value = getFilterCenter();

                updateOrderFieldState();

            }

            load();

        });

        form?.addEventListener("submit", async (e) => {

            e.preventDefault();

            clearStatus(statusBox);

            try {

                validate();

                const id = getCurrentId();

                const centro = getFormCenter();

                if (!ensureAllowedCenter(centro)) {

                    throw new Error(
                        "No tienes permisos para usar ese centro."
                    );

                }

                const selectedOrder =
                    manualToggle.checked
                        ? Number(
                            orderInput.value
                            || getNextOrder(
                                getItemsByCenter(
                                    cache,
                                    centro
                                )
                            )
                        )
                        : (
                            isEditing()
                                ? Number(orderInput.value || 0)
                                : getNextOrder(
                                    getItemsByCenter(
                                        cache,
                                        centro
                                    )
                                )
                        );

                const payload =
                    buildPayload(selectedOrder);

                const res = await fetch(
                    id
                        ? `${API}${endpointUpdateBase}/${id}`
                        : `${API}${endpointCreate}`,
                    {
                        method: id ? "PUT" : "POST",
                        headers: getAuthHeaders(true),
                        credentials: "include",
                        body: JSON.stringify(payload)
                    }
                );

                const data = await safeJson(res);

                if (!res.ok || !data.ok) {

                    if (handleProtectedResponse(res, data)) return;

                    throw new Error(
                        data.message
                        || "No se pudo guardar."
                    );

                }

                showStatus(
                    statusBox,
                    id
                        ? "Registro actualizado correctamente."
                        : "Registro creado correctamente.",
                    "success"
                );

                resetForm();

                load();

            } catch (error) {

                console.error(error);

                showStatus(
                    statusBox,
                    error.message,
                    "error"
                );

            }

        });

        applyCenterRestrictions([
            filterCentro,
            formCentro
        ]);

        if (formCentro && filterCentro) {
            formCentro.value = filterCentro.value;
        }

        updateOrderFieldState();

        load();

        return {
            load,
            resetForm,
            getCache: () => cache
        };

    }

    return {
        createTextModule
    };

})();

window.AdminCrud = AdminCrud;