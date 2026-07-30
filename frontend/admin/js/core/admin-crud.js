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

            if (!manualToggle || !orderInput) {
                return;
            }

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

            if (manualToggle) {
                manualToggle.checked = false;
            }

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

                const globalEditFunctionName =
                    `edit_${formId.replace(/[^a-zA-Z0-9_]/g, "_")}`;

                const globalDeleteFunctionName =
                    `delete_${formId.replace(/[^a-zA-Z0-9_]/g, "_")}`;

                window[globalEditFunctionName] = function(item) {

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

                    if (manualToggle) {
                        manualToggle.checked = false;
                    }

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

                window[globalDeleteFunctionName] = async function(id) {

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

                function edit(item) {

            window[globalEditFunctionName](item);

                }

                async function remove(id) {

                    await window[globalDeleteFunctionName](id);

                }

                return {
                    load,
                    resetForm,
                    getCache: () => cache,
                    edit,
                    remove
                };

    }

    function createUploadModule(config) {

        const {
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

            formId,
            listId,
            statusBoxId,
            formTitleId,
            cancelBtnId,

            formCentroId,
            filterCentroId,

            idInputId,
            orderInputId,

            uploadInputId,

            currentFileBoxId,

            endpointList,
            endpointCreate,
            endpointUpdateBase,
            endpointDeleteBase,

            uploadFieldName,

            titleDefault,

            titleField = "titulo",

            getFileTypeLabel,

            buildFormData,
            fillForm,
            renderItem,

            emptyMessage,

            onAfterLoad = null,
            beforeSubmit = null
        } = config;

        const form =
            document.getElementById(formId);

        const list =
            document.getElementById(listId);

        const statusBox =
            document.getElementById(statusBoxId);

        const formTitle =
            document.getElementById(formTitleId);

        const cancelBtn =
            document.getElementById(cancelBtnId);

        const centroSelect =
            document.getElementById(formCentroId);

        const filterCentroSelect =
            document.getElementById(filterCentroId);

        const idInput =
            document.getElementById(idInputId);

        const orderInput =
            document.getElementById(orderInputId);

        const uploadInput =
            document.getElementById(uploadInputId);

        const currentFileBox =
            document.getElementById(currentFileBoxId);

        applyCenterRestrictions([
            centroSelect,
            filterCentroSelect
        ]);

        function getSelectedFilterCenter() {

            return filterCentroSelect?.value
                || allowedCenters[0]
                || "global";

        }

        function getSelectedFormCenter() {

            return centroSelect?.value
                || allowedCenters[0]
                || "global";

        }

        function resetForm() {

            form.reset();

            idInput.value = "";

            orderInput.value = 0;

            if (centroSelect) {
                centroSelect.value =
                    getSelectedFilterCenter();
            }

            formTitle.textContent =
                titleDefault;

            renderCurrentFile({
                box: currentFileBox,
                item: null,
                kind: uploadFieldName,
                uploadsBase: FILES_BASE,
                escapeHtml,
                getFileTypeLabel
            });

            clearStatus(statusBox);

        }

        async function load() {

            list.innerHTML =
                `<div class="admin-empty">Cargando...</div>`;

            const centroActivo =
                getSelectedFilterCenter();

            try {

                const res = await fetch(
                    `${API}${endpointList}?centro=${encodeURIComponent(centroActivo)}`,
                    {
                        headers: getAuthHeaders(),
                        credentials: "include"
                    }
                );

                const data =
                    await safeJson(res);

                if (!res.ok || !data.ok) {

                    if (
                        handleProtectedResponse(res, data)
                    ) {
                        return;
                    }

                    throw new Error(
                        data.message
                        || "No se pudo cargar."
                    );

                }

                const items =
                    Array.isArray(data.items)
                        ? data.items
                        : [];

                if (items.length === 0) {

                    list.innerHTML = `
                        <div class="admin-empty">
                            ${emptyMessage(centroActivo)}
                        </div>
                    `;

                    return;

                }

                const sortedItems =
                    sortByOrder(
                        items,
                        titleField
                    );

                list.innerHTML =
                    sortedItems
                        .map(renderItem)
                        .join("");

                if (typeof onAfterLoad === "function") {
                    onAfterLoad(sortedItems);
                }

            } catch (error) {

                console.error(error);

                list.innerHTML =
                    `<div class="admin-empty">Error al cargar.</div>`;

                console.log("statusBox:", statusBox);
                console.log("mensaje:", error.message);

                showStatus(
                    statusBox,
                    error.message,
                    "error"
                );

            }

        }

        function edit(item) {

            if (
                !ensureAllowedCenter(
                    String(item.centro || "").toLowerCase()
                )
            ) {

                showStatus(
                    statusBox,
                    "No tienes permisos para editar ese centro.",
                    "error"
                );

                return;

            }

            idInput.value = item.id;

            centroSelect.value =
                item.centro
                || getSelectedFilterCenter();

            fillForm(item);

            formTitle.textContent =
                titleDefault.replace(
                    "Nuevo",
                    "Editar"
                );

            renderCurrentFile({
                box: currentFileBox,
                item,
                kind: uploadFieldName,
                uploadsBase: FILES_BASE,
                escapeHtml,
                getFileTypeLabel
            });

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

            showStatus(
                statusBox,
                "Editando registro seleccionado.",
                "info"
            );

        }

        async function remove(id) {

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

                const data =
                    await safeJson(res);

                if (!res.ok || !data.ok) {

                    if (
                        handleProtectedResponse(res, data)
                    ) {
                        return;
                    }

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

        }

        cancelBtn?.addEventListener(
            "click",
            resetForm
        );

        filterCentroSelect?.addEventListener(
            "change",
            () => {

                if (
                    !idInput.value
                    && centroSelect
                ) {

                    centroSelect.value =
                        getSelectedFilterCenter();

                }

                load();

            }
        );

        form?.addEventListener(
            "submit",
            async e => {

                e.preventDefault();

                clearStatus(statusBox);

                const id = idInput.value;

                const centro =
                    getSelectedFormCenter();

                if (!ensureAllowedCenter(centro)) {

                    showStatus(
                        statusBox,
                        "No tienes permisos para usar ese centro.",
                        "error"
                    );

                    return;

                }

                try {

                    const formData =
                        buildFormData({
                            id,
                            centro,
                            uploadInput,
                            orderInput
                        });

                            /*
                            * Validación para recursos:
                            * Si existe un campo enlace_externo y no se seleccionó
                            * un archivo, debe existir un enlace.
                            */

                            if (typeof beforeSubmit === "function") {

                                    const result = beforeSubmit({
                                        id,
                                        uploadInput,
                                        formData
                                    });

                                    if (result === false) {
                                        return;
                                    }

                                }

                    const res = await fetch(
                        id
                            ? `${API}${endpointUpdateBase}/${id}`
                            : `${API}${endpointCreate}`,
                        {
                            method:
                                id
                                    ? "PUT"
                                    : "POST",

                            headers:
                                getAuthHeaders(),

                            credentials:
                                "include",

                            body:
                                formData
                        }
                    );

                    const data =
                        await safeJson(res);

                    if (!res.ok || !data.ok) {

                        if (
                            handleProtectedResponse(
                                res,
                                data
                            )
                        ) {
                            return;
                        }

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

            }
        );

        if (
            centroSelect
            && filterCentroSelect
        ) {
            centroSelect.value =
                filterCentroSelect.value;
        }

        load();

        return {
            load,
            resetForm,
            edit,
            remove
        };

    }

    return {
        createTextModule,
        createUploadModule
    };

})();

window.AdminCrud = AdminCrud;