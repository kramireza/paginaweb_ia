const API = `${window.location.origin}/informatica-api`;
const token = localStorage.getItem("token");

const form = document.getElementById("reglamento-form");
const list = document.getElementById("reglamentos-list");
const statusBox = document.getElementById("status-box");
const formTitle = document.getElementById("form-title");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const logoutBtn = document.getElementById("logout-btn");
const centroSelect = document.getElementById("centro");
const filterCentroSelect = document.getElementById("filter-centro");

if (!token) {
    window.location.href = "./login.html";
}

logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "./login.html";
});

function getSelectedFilterCenter() {
    return filterCentroSelect?.value || "vs";
}

function getSelectedFormCenter() {
    return centroSelect?.value || "vs";
}

function getCenterLabel(centro) {
    const map = {
        vs: "UNAH-VS",
        cu: "Ciudad Universitaria",
        danli: "UNAH Danlí"
    };

    return map[String(centro || "").toLowerCase()] || "Sin centro";
}

function showStatus(message, type = "info") {
    statusBox.textContent = message;
    statusBox.className = `admin-status show ${type}`;
}

function clearStatus() {
    statusBox.textContent = "";
    statusBox.className = "admin-status";
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function resetForm() {
    form.reset();
    document.getElementById("reglamento-id").value = "";
    document.getElementById("activo").checked = true;
    document.getElementById("orden_visual").value = 0;

    if (centroSelect && filterCentroSelect) {
        centroSelect.value = getSelectedFilterCenter();
    }

    formTitle.textContent = "Nuevo fragmento";
    clearStatus();
}

cancelEditBtn?.addEventListener("click", resetForm);

filterCentroSelect?.addEventListener("change", () => {
    if (!document.getElementById("reglamento-id").value && centroSelect) {
        centroSelect.value = getSelectedFilterCenter();
    }
    loadReglamentos();
});

async function loadReglamentos() {
    list.innerHTML = `<div class="admin-empty">Cargando fragmentos...</div>`;

    const centroActivo = getSelectedFilterCenter();

    try {
        const res = await fetch(`${API}/avisos/admin/reglamentos/list?centro=${encodeURIComponent(centroActivo)}`, {
            headers: { Authorization: "Bearer " + token }
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            throw new Error(data.message || "No se pudieron cargar los fragmentos.");
        }

        if (!Array.isArray(data.items) || data.items.length === 0) {
            list.innerHTML = `<div class="admin-empty">No hay fragmentos de reglamentos registrados para ${escapeHtml(getCenterLabel(centroActivo))}.</div>`;
            return;
        }

        const sortedItems = [...data.items].sort((a, b) => Number(a.orden_visual || 0) - Number(b.orden_visual || 0));

        list.innerHTML = sortedItems.map(item => `
            <article class="admin-item">
                <div>
                    <div class="admin-item-top">
                        <div>
                            <span class="admin-badge">${escapeHtml(getCenterLabel(item.centro))}</span>
                            <span class="admin-badge ${item.activo ? "active" : "inactive"}">${item.activo ? "Activo" : "Inactivo"}</span>
                            <span class="admin-badge">Orden: ${escapeHtml(item.orden_visual ?? 0)}</span>
                        </div>
                    </div>

                    <h3>${escapeHtml(item.titulo)}</h3>
                    <p><strong>Fragmento:</strong> ${escapeHtml(item.fragmento || "")}</p>
                    ${item.enlace ? `<p><strong>Enlace:</strong> <a href="${escapeHtml(item.enlace)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.enlace)}</a></p>` : ""}

                    <div class="admin-item-actions">
                        <button class="btn-warning" onclick='editReglamento(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Editar</button>
                        <button class="btn-danger" onclick="deleteReglamento(${item.id})">Eliminar</button>
                    </div>
                </div>
            </article>
        `).join("");
    } catch (error) {
        console.error(error);
        list.innerHTML = `<div class="admin-empty">Error al cargar fragmentos.</div>`;
        showStatus(error.message, "error");
    }
}

window.editReglamento = function (item) {
    document.getElementById("reglamento-id").value = item.id;
    document.getElementById("centro").value = item.centro || getSelectedFilterCenter();
    document.getElementById("titulo").value = item.titulo || "";
    document.getElementById("fragmento").value = item.fragmento || "";
    document.getElementById("enlace").value = item.enlace || "";
    document.getElementById("orden_visual").value = item.orden_visual ?? 0;
    document.getElementById("activo").checked = !!item.activo;

    formTitle.textContent = "Editar fragmento";
    window.scrollTo({ top: 0, behavior: "smooth" });
    showStatus("Editando fragmento seleccionado.", "info");
};

window.deleteReglamento = async function (id) {
    const ok = confirm("¿Seguro que deseas eliminar este fragmento?");
    if (!ok) return;

    try {
        const res = await fetch(`${API}/avisos/admin/reglamentos/${id}`, {
            method: "DELETE",
            headers: { Authorization: "Bearer " + token }
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            throw new Error(data.message || "No se pudo eliminar el fragmento.");
        }

        showStatus("Fragmento eliminado correctamente.", "success");
        loadReglamentos();
        resetForm();
    } catch (error) {
        console.error(error);
        showStatus(error.message, "error");
    }
};

form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus();

    const id = document.getElementById("reglamento-id").value;

    const payload = {
        centro: getSelectedFormCenter(),
        titulo: document.getElementById("titulo").value.trim(),
        fragmento: document.getElementById("fragmento").value.trim(),
        enlace: document.getElementById("enlace").value.trim(),
        orden_visual: document.getElementById("orden_visual").value || 0,
        activo: document.getElementById("activo").checked
    };

    try {
        const res = await fetch(
            id ? `${API}/avisos/admin/reglamentos/${id}` : `${API}/avisos/admin/reglamentos`,
            {
                method: id ? "PUT" : "POST",
                headers: {
                    Authorization: "Bearer " + token,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            }
        );

        const data = await res.json();

        if (!res.ok || !data.ok) {
            throw new Error(data.message || "No se pudo guardar el fragmento.");
        }

        showStatus(id ? "Fragmento actualizado correctamente." : "Fragmento creado correctamente.", "success");
        resetForm();
        loadReglamentos();
    } catch (error) {
        console.error(error);
        showStatus(error.message, "error");
    }
});

if (centroSelect && filterCentroSelect) {
    centroSelect.value = filterCentroSelect.value;
}

loadReglamentos();