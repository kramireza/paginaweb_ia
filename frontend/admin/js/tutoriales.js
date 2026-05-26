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

if (!requireAuth()) {
    throw new Error("No autorizado");
}

window.AdminLayout.initSidebar();

const form = document.getElementById("tutorial-form");

const list = document.getElementById("tutoriales-list");

const statusBox = document.getElementById("status-box");

const formTitle = document.getElementById("form-title");

const cancelEditBtn = document.getElementById("cancel-edit-btn");

const logoutBtn = document.getElementById("logout-btn");

const centroSelect = document.getElementById("centro");

const filterCentroSelect = document.getElementById("filter-centro");

const videoActualBox = document.getElementById("video-actual-box");

logoutBtn?.addEventListener("click", logout);

const allowedCenters = getAllowedCenters(adminUser);

applyCenterRestrictions([
    centroSelect,
    filterCentroSelect
]);

function buildVideoUrl(filePath = "") {

    if (!filePath) return "";

    const normalized = String(filePath)
        .replace(/^\/informatica-uploads/, "")
        .replace(/^\/uploads/, "")
        .replace(/^\/+/, "");

    return `${FILES_BASE}/${normalized}`;

}

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

function getVideoTypeLabel(tipo) {
    const map = {
        mp4: "MP4",
        webm: "WEBM",
        ogg: "OGG"
    };

    return map[String(tipo || "").toLowerCase()] || (tipo ? String(tipo).toUpperCase() : "Video");
}

function renderCurrentFile(item) {
    if (!item || (!item.video_url && !item.video_nombre_original)) {
        videoActualBox.innerHTML = "";
        videoActualBox.classList.add("hidden");
        return;
    }

    videoActualBox.innerHTML = `
        <div class="admin-file-card">
            <strong>Video actual:</strong>
            <div class="admin-file-meta">
                <span>${escapeHtml(item.video_nombre_original || "Video cargado")}</span>
                ${item.tipo_video ? `<span class="admin-badge">${escapeHtml(getVideoTypeLabel(item.tipo_video))}</span>` : ""}
            </div>
            ${item.video_url ? `<a href="${buildFileUrl(item.video_url)}" target="_blank" rel="noopener noreferrer">Ver video actual</a>` : ""}
        </div>
    `;

    videoActualBox.classList.remove("hidden");
}

function resetForm() {
    form.reset();
    document.getElementById("tutorial-id").value = "";
    document.getElementById("orden_visual").value = 0;
    document.getElementById("activo").value = "true";

    if (centroSelect) {
        centroSelect.value = getSelectedFilterCenter();
    }

    formTitle.textContent = "Nuevo tutorial";
    renderCurrentFile({
        box: videoActualBox,
        item: null,
        kind: "video",
        uploadsBase: FILES_BASE,
        escapeHtml,
        getFileTypeLabel: getVideoTypeLabel
    });
    clearStatus();
}

cancelEditBtn?.addEventListener("click", resetForm);

filterCentroSelect?.addEventListener("change", () => {
    if (!document.getElementById("tutorial-id").value && centroSelect) {
        centroSelect.value = getSelectedFilterCenter();
    }
    loadTutoriales();
});

async function loadTutoriales() {
    list.innerHTML = `<div class="admin-empty">Cargando tutoriales...</div>`;

    const centroActivo = getSelectedFilterCenter();

    try {
        const res = await fetch(`${API}/avisos/admin/tutoriales/list?centro=${encodeURIComponent(centroActivo)}`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (handleProtectedResponse(res, data)) {
                return;
            }
            throw new Error(data.message || "No se pudieron cargar los tutoriales.");
        }

        const items = Array.isArray(data.items) ? data.items : [];

        if (items.length === 0) {
            list.innerHTML = `<div class="admin-empty">No hay tutoriales registrados para ${escapeHtml(getCenterLabel(centroActivo))}.</div>`;
            return;
        }

        const sortedItems = sortByOrder(
            items,
            "titulo"
        );

        list.innerHTML = sortedItems.map(item => `
            <article class="admin-item">
                <div>
                    <div class="admin-item-top">
                        <div>
                            <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                            <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activo" : "Inactivo"}</span>
                            <span class="admin-badge">Orden: ${escapeHtml(item.orden_visual ?? 0)}</span>
                            ${item.tipo_video ? `<span class="admin-badge">${escapeHtml(getVideoTypeLabel(item.tipo_video))}</span>` : ""}
                        </div>
                    </div>

                    <h3>${escapeHtml(item.titulo)}</h3>
                    ${item.descripcion ? `<p><strong>Descripción:</strong> ${escapeHtml(item.descripcion)}</p>` : ""}
                    ${item.video_nombre_original ? `<p><strong>Video:</strong> ${escapeHtml(item.video_nombre_original)}</p>` : ""}
                    ${item.video_url ? `<p><strong>Archivo:</strong> <a href="${buildFileUrl(item.video_url)}" target="_blank" rel="noopener noreferrer">Abrir video</a></p>` : ""}
                    ${item.enlace_video ? `<p><strong>Enlace:</strong> <a href="${escapeHtml(item.enlace_video)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.enlace_video)}</a></p>` : ""}

                    <div class="admin-item-actions">
                        <button class="btn-warning admin-edit-btn" data-item="${encodeURIComponent(JSON.stringify(item))}">Editar</button>
                        <button class="btn-danger admin-delete-btn" data-id="${item.id}">Eliminar</button>
                    </div>
                </div>
            </article>
        `).join("");

        document.querySelectorAll(".admin-edit-btn").forEach(button => {
            button.addEventListener("click", () => {
                const raw = button.getAttribute("data-item");
                const item = JSON.parse(decodeURIComponent(raw));
                editTutorial(item);
            });
        });

        document.querySelectorAll(".admin-delete-btn").forEach(button => {
            button.addEventListener("click", () => {
                const id = button.getAttribute("data-id");
                deleteTutorial(id);
            });
        });
    } catch (error) {
        console.error(error);
        list.innerHTML = `<div class="admin-empty">Error al cargar tutoriales.</div>`;
        showStatus(error.message, "error");
    }
}

function editTutorial(item) {
    if (!allowedCenters.includes(String(item.centro || "").toLowerCase())) {
        showStatus("No tienes permisos para editar ese centro.", "error");
        return;
    }

    document.getElementById("tutorial-id").value = item.id;
    document.getElementById("centro").value = item.centro || getSelectedFilterCenter();
    document.getElementById("titulo").value = item.titulo || "";
    document.getElementById("descripcion").value = item.descripcion || "";
    document.getElementById("enlace_video").value = item.enlace_video || "";
    document.getElementById("orden_visual").value = item.orden_visual ?? 0;
    document.getElementById("activo").value = String(!!item.activo);

    formTitle.textContent = "Editar tutorial";
    renderCurrentFile({
        box: videoActualBox,
        item,
        kind: "video",
        uploadsBase: FILES_BASE,
        escapeHtml,
        getFileTypeLabel: getVideoTypeLabel
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    showStatus("Editando tutorial seleccionado.", "info");
}

async function deleteTutorial(id) {
    const ok = confirm("¿Seguro que deseas eliminar este tutorial?");
    if (!ok) return;

    try {
        const res = await fetch(`${API}/avisos/admin/tutoriales/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (handleProtectedResponse(res, data)) {
                return;
            }
            throw new Error(data.message || "No se pudo eliminar el tutorial.");
        }

        showStatus("Tutorial eliminado correctamente.", "success");
        loadTutoriales();
        resetForm();
    } catch (error) {
        console.error(error);
        showStatus(error.message, "error");
    }
}

form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus();

    const id = document.getElementById("tutorial-id").value;
    const videoInput = document.getElementById("video");
    const centro = getSelectedFormCenter();

    if (!ensureAllowedCenter(centro)) {
        showStatus("No tienes permisos para usar ese centro.", "error");
        return;
    }

    const formData = new FormData();
    formData.append("centro", centro);
    formData.append("titulo", document.getElementById("titulo").value.trim());
    formData.append("descripcion", document.getElementById("descripcion").value.trim());
    formData.append("enlace_video", document.getElementById("enlace_video").value.trim());
    formData.append("orden_visual", document.getElementById("orden_visual").value || 0);
    formData.append("activo", document.getElementById("activo").value);

    if (videoInput.files[0]) {
        formData.append("video", videoInput.files[0]);
    }

    try {
        const res = await fetch(
            id ? `${API}/avisos/admin/tutoriales/${id}` : `${API}/avisos/admin/tutoriales`,
            {
                method: id ? "PUT" : "POST",
                headers: getAuthHeaders(),
                credentials: "include",
                body: formData
            }
        );

        const data = await safeJson(res);

        if (!res.ok || !data.ok) {
            if (handleProtectedResponse(res, data)) {
                return;
            }
            throw new Error(data.message || "No se pudo guardar el tutorial.");
        }

        showStatus(id ? "Tutorial actualizado correctamente." : "Tutorial creado correctamente.", "success");
        resetForm();
        loadTutoriales();
    } catch (error) {
        console.error(error);
        showStatus(error.message, "error");
    }
});

if (centroSelect && filterCentroSelect) {
    centroSelect.value = filterCentroSelect.value;
}

loadTutoriales();