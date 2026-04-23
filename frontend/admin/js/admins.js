const API = `${window.location.origin}/informatica-api`.replace(/\/+$/, "");
const token = localStorage.getItem("token");
const adminUserRaw = localStorage.getItem("adminUser");

if (!token) {
    window.location.href = "login.html";
}

let adminUser = null;
try {
    adminUser = adminUserRaw ? JSON.parse(adminUserRaw) : null;
} catch (error) {
    adminUser = null;
}

if (!adminUser || adminUser.mustChangePassword === true) {
    window.location.href = "change-password.html";
}

if (!adminUser || adminUser.role !== "superadmin") {
    window.location.href = "dashboard.html";
}

document.getElementById("logout-btn")?.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("adminUser");
    window.location.href = "./login.html";
});

const form = document.getElementById("admin-form");
const resetForm = document.getElementById("reset-form");
const listBox = document.getElementById("admins-list");
const statusBox = document.getElementById("status-box");
const resetStatusBox = document.getElementById("reset-status-box");

function showStatus(el, message, type = "info") {
    el.textContent = message;
    el.className = `admin-status show ${type}`;
}

function clearStatus(el) {
    el.textContent = "";
    el.className = "admin-status";
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

function getCenterLabel(center) {
    const map = {
        vs: "UNAH-VS",
        cu: "Ciudad Universitaria",
        danli: "UNAH Danlí",
        global: "Global"
    };
    return map[String(center || "").toLowerCase()] || center || "Sin centro";
}

function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    return date.toLocaleString("es-HN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

async function safeJson(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error("Respuesta inválida del servidor");
    }
}

function handleProtectedError(errorMessage) {
    const text = String(errorMessage || "");
    if (text.toLowerCase().includes("contraseña") || text.includes("PASSWORD_CHANGE_REQUIRED")) {
        window.location.href = "change-password.html";
        return true;
    }
    return false;
}

function getAuthHeaders(includeJson = false) {
    const headers = {};

    if (includeJson) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

function setResetTarget(id, label) {
    document.getElementById("reset_admin_id").value = id;
    document.getElementById("reset_admin_label").value = label;
}

async function loadAdmins() {
    listBox.innerHTML = `<div class="admin-empty">Cargando admins...</div>`;

    try {
        const response = await fetch(`${API}/admins`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            if (handleProtectedError(data.message)) return;
            throw new Error(data.message || "No se pudieron cargar los admins");
        }

        const items = Array.isArray(data.items) ? data.items : [];

        if (items.length === 0) {
            listBox.innerHTML = `<div class="admin-empty">No hay admins registrados.</div>`;
            return;
        }

        listBox.innerHTML = items.map(item => `
            <article class="admin-item">
                <div class="admin-item-top">
                    <div>
                        <span class="admin-badge">${escapeHtml(item.role)}</span>
                        <span class="admin-badge">${escapeHtml(item.cargo || "sin cargo")}</span>
                        <span class="admin-badge">${escapeHtml(getCenterLabel(item.assigned_center))}</span>
                        <span class="admin-badge ${item.is_active ? "active" : "inactive"}">
                            ${item.is_active ? "Activo" : "Inactivo"}
                        </span>
                        <span class="admin-badge ${item.must_change_password ? "pending" : "active"}">
                            ${item.must_change_password ? "Debe cambiar contraseña" : "Contraseña actualizada"}
                        </span>
                    </div>
                </div>

                <h3>${escapeHtml(item.full_name)}</h3>
                <p><strong>Usuario:</strong> ${escapeHtml(item.username)}</p>
                <p><strong>Último acceso:</strong> ${escapeHtml(formatDate(item.last_login_at) || "Sin registro")}</p>
                <p><strong>Creado:</strong> ${escapeHtml(formatDate(item.created_at))}</p>

                <div class="admin-item-actions">
                    <button class="btn-warning" onclick="prepareReset(${item.id}, '${escapeHtml(item.full_name)} (${escapeHtml(item.username)})')">
                        Resetear contraseña
                    </button>
                    <button class="btn-danger" onclick="deleteAdmin(${item.id})">
                        Eliminar
                    </button>
                </div>
            </article>
        `).join("");
    } catch (error) {
        console.error(error);
        listBox.innerHTML = `<div class="admin-empty">Error al cargar admins.</div>`;
    }
}

form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus(statusBox);

    const payload = {
        full_name: document.getElementById("full_name").value.trim(),
        username: document.getElementById("username").value.trim(),
        temporary_password: document.getElementById("temporary_password").value.trim(),
        cargo: document.getElementById("cargo").value,
        assigned_center: document.getElementById("assigned_center").value,
        role: document.getElementById("role").value
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
            if (handleProtectedError(data.message)) return;
            throw new Error(data.message || "No se pudo crear el admin");
        }

        showStatus(statusBox, "Admin creado correctamente.", "success");
        form.reset();
        loadAdmins();
    } catch (error) {
        console.error(error);
        showStatus(statusBox, error.message, "error");
    }
});

resetForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus(resetStatusBox);

    const id = document.getElementById("reset_admin_id").value;
    const temporary_password = document.getElementById("reset_temporary_password").value.trim();

    if (!id) {
        showStatus(resetStatusBox, "Primero selecciona un admin del listado.", "error");
        return;
    }

    try {
        const response = await fetch(`${API}/admins/${id}/reset-password`, {
            method: "PUT",
            headers: getAuthHeaders(true),
            credentials: "include",
            body: JSON.stringify({ temporary_password })
        });

        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            if (handleProtectedError(data.message)) return;
            throw new Error(data.message || "No se pudo resetear la contraseña");
        }

        showStatus(resetStatusBox, "Contraseña reseteada correctamente.", "success");
        resetForm.reset();
        document.getElementById("reset_admin_id").value = "";
        document.getElementById("reset_admin_label").value = "";
        loadAdmins();
    } catch (error) {
        console.error(error);
        showStatus(resetStatusBox, error.message, "error");
    }
});

window.prepareReset = (id, label) => {
    setResetTarget(id, label);
};

window.deleteAdmin = async (id) => {
    if (!confirm("¿Seguro que deseas eliminar este admin?")) return;

    try {
        const response = await fetch(`${API}/admins/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            if (handleProtectedError(data.message)) return;
            throw new Error(data.message || "No se pudo eliminar el admin");
        }

        loadAdmins();
        alert("Admin eliminado correctamente.");
    } catch (error) {
        console.error(error);
        alert(error.message || "Error al eliminar admin.");
    }
};

loadAdmins();