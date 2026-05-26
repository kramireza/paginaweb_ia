const {
    API,
    adminUser,
    requireAuth,
    logout,
    safeJson,
    escapeHtml,
    getAuthHeaders,
    showStatus,
    clearStatus,
    handleProtectedResponse,
    getCenterLabel
} = window.AdminCore;

if (!requireAuth()) {
    throw new Error("No autorizado");
}

if (adminUser?.role !== "superadmin") {
    window.location.href = "./dashboard.html";
}

window.AdminLayout.initSidebarPanels();

document
    .getElementById("logout-btn")
    ?.addEventListener("click", logout);

const form = document.getElementById("admin-form");

const resetForm = document.getElementById("reset-form");

const listBox = document.getElementById("admins-list");

const statusBox = document.getElementById("status-box");

const resetStatusBox = document.getElementById("reset-status-box");

function formatDate(value) {

    if (!value) return "Sin registro";

    try {

        return new Date(value).toLocaleString("es-HN", {
            dateStyle: "medium",
            timeStyle: "short"
        });

    } catch (error) {

        return "Sin registro";

    }

}

function setResetTarget(id, label) {

    document.getElementById("reset_admin_id").value = id;

    document.getElementById("reset_admin_label").value = label;

    window.AdminLayout.activatePanel(
        "reset-password-panel"
    );
}

async function loadAdmins() {

    listBox.innerHTML = `
        <div class="admin-empty">
            Cargando admins...
        </div>
    `;

    try {

        const response = await fetch(`${API}/admins`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(response);

        if (!response.ok || !data.ok) {

            if (handleProtectedResponse(response, data)) {
                return;
            }

            throw new Error(
                data.message ||
                "No se pudieron cargar los admins"
            );
        }

        const items = Array.isArray(data.items)
            ? data.items
            : [];

        if (items.length === 0) {

            listBox.innerHTML = `
                <div class="admin-empty">
                    No hay admins registrados.
                </div>
            `;

            return;
        }

        listBox.innerHTML = items.map(item => `

            <article class="admin-item">

                <div class="admin-item-top">

                    <div>

                        <span class="admin-badge">
                            ${escapeHtml(item.role)}
                        </span>

                        <span class="admin-badge">
                            ${escapeHtml(item.cargo || "sin cargo")}
                        </span>

                        <span class="admin-badge">
                            ${escapeHtml(
                                getCenterLabel(item.assigned_center)
                            )}
                        </span>

                        <span class="
                            admin-badge
                            ${item.is_active ? "active" : "inactive"}
                        ">
                            ${item.is_active ? "Activo" : "Inactivo"}
                        </span>

                        <span class="
                            admin-badge
                            ${item.must_change_password ? "pending" : "active"}
                        ">
                            ${
                                item.must_change_password
                                    ? "Debe cambiar contraseña"
                                    : "Contraseña actualizada"
                            }
                        </span>

                    </div>

                </div>

                <h3>
                    ${escapeHtml(item.full_name)}
                </h3>

                <p>
                    <strong>Usuario:</strong>
                    ${escapeHtml(item.username)}
                </p>

                <p>
                    <strong>Último acceso:</strong>
                    ${escapeHtml(
                        formatDate(item.last_login_at) ||
                        "Sin registro"
                    )}
                </p>

                <p>
                    <strong>Creado:</strong>
                    ${escapeHtml(
                        formatDate(item.created_at)
                    )}
                </p>

                <div class="admin-item-actions">

                    <button
                        class="btn-warning"
                        onclick="prepareReset(
                            ${item.id},
                            '${escapeHtml(item.full_name)} (${escapeHtml(item.username)})'
                        )"
                    >
                        Resetear contraseña
                    </button>

                    <button
                        class="btn-danger"
                        onclick="deleteAdmin(${item.id})"
                    >
                        Eliminar
                    </button>

                </div>

            </article>

        `).join("");

    } catch (error) {

        console.error(error);

        listBox.innerHTML = `
            <div class="admin-empty">
                Error al cargar admins.
            </div>
        `;
    }
}

form?.addEventListener("submit", async (e) => {

    e.preventDefault();

    clearStatus(statusBox);

    const payload = {
        full_name:
            document
                .getElementById("full_name")
                .value
                .trim(),

        username:
            document
                .getElementById("username")
                .value
                .trim(),

        temporary_password:
            document
                .getElementById("temporary_password")
                .value
                .trim(),

        cargo:
            document
                .getElementById("cargo")
                .value,

        assigned_center:
            document
                .getElementById("assigned_center")
                .value,

        role:
            document
                .getElementById("role")
                .value
    };

    try {

        const response = await fetch(`${API}/admins`, {

            method: "POST",

            headers: getAuthHeaders(true),

            credentials: "include",

            body: JSON.stringify(payload)
        });

        const data = await safeJson(response);

        if (!response.ok || !data.ok) {

            if (handleProtectedResponse(response, data)) {
                return;
            }

            throw new Error(
                data.message ||
                "No se pudo crear el admin"
            );
        }

        showStatus(
            statusBox,
            "Admin creado correctamente.",
            "success"
        );

        form.reset();

        loadAdmins();

    } catch (error) {

        console.error(error);

        showStatus(
            statusBox,
            error.message,
            "error"
        );
    }
});

resetForm?.addEventListener("submit", async (e) => {

    e.preventDefault();

    clearStatus(resetStatusBox);

    const id =
        document
            .getElementById("reset_admin_id")
            .value;

    const temporary_password =
        document
            .getElementById("reset_temporary_password")
            .value
            .trim();

    if (!id) {

        showStatus(
            resetStatusBox,
            "Primero selecciona un admin del listado.",
            "error"
        );

        return;
    }

    try {

        const response = await fetch(
            `${API}/admins/${id}/reset-password`,
            {

                method: "PUT",

                headers: getAuthHeaders(true),

                credentials: "include",

                body: JSON.stringify({
                    temporary_password
                })
            }
        );

        const data = await safeJson(response);

        if (!response.ok || !data.ok) {

            if (handleProtectedResponse(response, data)) {
                return;
            }

            throw new Error(
                data.message ||
                "No se pudo resetear la contraseña"
            );
        }

        showStatus(
            resetStatusBox,
            "Contraseña reseteada correctamente.",
            "success"
        );

        resetForm.reset();

        document.getElementById("reset_admin_id").value = "";

        document.getElementById("reset_admin_label").value = "";

        loadAdmins();

    } catch (error) {

        console.error(error);

        showStatus(
            resetStatusBox,
            error.message,
            "error"
        );
    }
});

window.prepareReset = (id, label) => {

    setResetTarget(id, label);
};

window.deleteAdmin = async (id) => {

    if (!confirm(
        "¿Seguro que deseas eliminar este admin?"
    )) {
        return;
    }

    try {

        const response = await fetch(
            `${API}/admins/${id}`,
            {

                method: "DELETE",

                headers: getAuthHeaders(),

                credentials: "include"
            }
        );

        const data = await safeJson(response);

        if (!response.ok || !data.ok) {

            if (handleProtectedResponse(response, data)) {
                return;
            }

            throw new Error(
                data.message ||
                "No se pudo eliminar el admin"
            );
        }

        loadAdmins();

        alert("Admin eliminado correctamente.");

    } catch (error) {

        console.error(error);

        alert(
            error.message ||
            "Error al eliminar admin."
        );
    }
};

loadAdmins();