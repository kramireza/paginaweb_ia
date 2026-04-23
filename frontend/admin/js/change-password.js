const API = `${window.location.origin}/informatica-api`;

const form = document.getElementById("change-password-form");
const btn = document.getElementById("change-password-btn");
const msg = document.getElementById("msg");

function showMessage(text, type = "error") {
    if (!msg) return;
    msg.textContent = text;
    msg.className = `admin-login-message ${type}`;
}

const token = localStorage.getItem("token");

if (!token) {
    window.location.href = "login.html";
}

form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        showMessage("Completa todos los campos.", "error");
        return;
    }

    try {
        btn.disabled = true;
        btn.textContent = "Actualizando...";
        showMessage("Actualizando contraseña...", "info");

        const res = await fetch(`${API}/auth/change-password`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                currentPassword,
                newPassword,
                confirmPassword
            })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            throw new Error(data.message || "No se pudo actualizar la contraseña.");
        }

        localStorage.removeItem("token");
        localStorage.removeItem("adminUser");

        showMessage("Contraseña actualizada. Inicia sesión nuevamente.", "success");

        setTimeout(() => {
            window.location.href = "login.html";
        }, 1200);
    } catch (error) {
        console.error(error);
        showMessage(error.message || "Error al actualizar la contraseña.", "error");
    } finally {
        btn.disabled = false;
        btn.textContent = "Actualizar contraseña";
    }
});