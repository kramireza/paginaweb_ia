const API = `${window.location.origin}/informatica-api`.replace(/\/+$/, "");

const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const msg = document.getElementById("msg");

function showMessage(text, type = "error") {
    if (!msg) return;
    msg.textContent = text;
    msg.className = `admin-login-message ${type}`;
}

function clearMessage() {
    if (!msg) return;
    msg.textContent = "";
    msg.className = "admin-login-message";
}

async function parseJsonSafely(response) {
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
        return null;
    }

    try {
        return await response.json();
    } catch (error) {
        return null;
    }
}

loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();

    const username = usernameInput?.value.trim() || "";
    const password = passwordInput?.value || "";

    if (!username || !password) {
        showMessage("Ingresa usuario y contraseña.", "error");
        return;
    }

    try {
        loginBtn.disabled = true;
        loginBtn.textContent = "Ingresando...";
        showMessage("Validando credenciales...", "info");

        const res = await fetch(`${API}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ username, password })
        });

        const data = await parseJsonSafely(res);

        if (!res.ok || !data?.ok) {
            throw new Error(data?.message || "No se pudo iniciar sesión.");
        }

        const adminUser = {
            ...(data.admin || {}),
            mustChangePassword: !!data.mustChangePassword
        };

        if (data.token) {
            localStorage.setItem("token", data.token);
        }

        localStorage.setItem("adminUser", JSON.stringify(adminUser));

        if (data.mustChangePassword === true) {
            showMessage("Debes cambiar tu contraseña antes de continuar.", "info");
            window.location.href = "change-password.html";
            return;
        }

        showMessage("Acceso correcto. Redirigiendo...", "success");
        window.location.href = "dashboard.html";
    } catch (error) {
        console.error("Error en login:", error);
        showMessage(error.message || "Ocurrió un error al iniciar sesión.", "error");
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = "Entrar";
    }
});