const AdminCore = (() => {

    /* =========================
       CONFIG
    ========================= */

    const API = `${window.location.origin}/informatica-api`.replace(/\/+$/, "");
    const UPLOADS_BASE = `${window.location.origin}/informatica-uploads`.replace(/\/+$/, "");

    function getToken() {
        return localStorage.getItem("token");
    }

    function getAdminUser() {

        try {
            return JSON.parse(localStorage.getItem("adminUser") || "null");
        } catch {
            return null;
        }

    }

    function setAdminUser(user) {

        localStorage.setItem(
            "adminUser",
            JSON.stringify(user)
        );

    }

    function clearAdminUser() {

        localStorage.removeItem("adminUser");

    }

    /* =========================
       AUTH
    ========================= */

    function requireAuth() {

        const token = getToken();
        const adminUser = getAdminUser();

        if (!token || !adminUser) {

            window.location.href = "./login.html";

            return false;

        }

        if (
            adminUser.must_change_password === true ||
            adminUser.mustChangePassword === true
        ) {

            window.location.href = "./change-password.html";

            return false;

        }

        return true;

    }

    async function validateSession() {

        try {

            const res = await fetch(`${API}/auth/me`, {
                headers: getAuthHeaders(),
                credentials: "include"
            });

            const data = await safeJson(res);

            if (!res.ok || !data.ok) {

                handleProtectedResponse(res, data);

                return false;

            }

            setAdminUser(data.admin);

            return true;

        } catch (error) {

            console.error(error);

            logout(false);

            return false;

        }

    }

    function getAuthHeaders(includeJson = false) {

        const headers = {};

        if (includeJson) {
            headers["Content-Type"] = "application/json";
        }

        const token = getToken();

        if (token) {
            headers.Authorization = "Bearer " + token;
        }

        return headers;
    }

    async function logout(notifyServer = true) {

        try {

            if (notifyServer) {

                await fetch(`${API}/auth/logout`, {
                    method: "POST",
                    headers: getAuthHeaders(),
                    credentials: "include"
                });

            }

        } catch (error) {

            console.error("Error al registrar logout:", error);

        } finally {

            localStorage.removeItem("token");
            clearAdminUser();

            window.location.href = "./login.html";

        }

    }

    /* =========================
       PERMISOS
    ========================= */

    function getAllowedCenters(user = getAdminUser()) {

        const role = String(user?.role || "").toLowerCase();
        const assigned = String(user?.assignedCenter || "").toLowerCase();

        if (role === "superadmin" || assigned === "global") {
            return ["vs", "cu", "danli"];
        }

        if (["vs", "cu", "danli"].includes(assigned)) {
            return [assigned];
        }

        return ["vs"];
    }

    function ensureAllowedCenter(center) {

        return getAllowedCenters().includes(
            String(center || "").toLowerCase()
        );
    }

    function applyCenterRestrictions(selects = []) {

        const allowedCenters = getAllowedCenters();

        selects.forEach(select => {

            if (!select) return;

            Array.from(select.options).forEach(option => {

                const allowed = allowedCenters.includes(option.value);

                option.hidden = !allowed;
                option.disabled = !allowed;
            });

            if (!allowedCenters.includes(select.value)) {
                select.value = allowedCenters[0];
            }
        });
    }

    /* =========================
       HELPERS
    ========================= */

    function escapeHtml(value) {

        if (value === null || value === undefined) return "";

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    async function safeJson(res) {

        const text = await res.text();

        try {

            return JSON.parse(text);

        } catch (error) {

            throw new Error(
                `La respuesta no es JSON válido. Respuesta recibida: ${text.slice(0, 150)}`
            );
        }
    }

    function showStatus(box, message, type = "info") {

        if (!box) return;

        box.textContent = message;
        box.className = `admin-status show ${type}`;
    }

    function clearStatus(box) {

        if (!box) return;

        box.textContent = "";
        box.className = "admin-status";
    }

    function getCenterLabel(centro) {

        const map = {
            vs: "UNAH-VS",
            cu: "Ciudad Universitaria",
            danli: "UNAH Danlí"
        };

        return map[String(centro || "").toLowerCase()] || "Sin centro";
    }

    function getImageUrl(fileUrl, fallback = "../assets/images/docente1.jpg") {

        if (!fileUrl) return fallback;

        if (
            fileUrl.startsWith("http://") ||
            fileUrl.startsWith("https://")
        ) {
            return fileUrl;
        }

        const normalized = String(fileUrl)
            .replace(/^\/informatica-uploads/, "")
            .replace(/^\/uploads/, "")
            .replace(/^\/+/, "");

        return `${UPLOADS_BASE}/${normalized}`;
    }

    function sortByOrder(items = [], field = "titulo") {

        return [...items].sort((a, b) => {

            const orderA = Number(a.orden_visual || 0);
            const orderB = Number(b.orden_visual || 0);

            if (orderA !== orderB) {
                return orderA - orderB;
            }

            return String(a[field] || "").localeCompare(
                String(b[field] || ""),
                "es",
                { sensitivity: "base" }
            );
        });
    }

    function getItemsByCenter(items, centro) {

        return (Array.isArray(items) ? items : []).filter(item =>
            String(item.centro || "").toLowerCase() ===
            String(centro || "").toLowerCase()
        );
    }

    function getNextOrder(items) {

        if (!Array.isArray(items) || items.length === 0) {
            return 1;
        }

        const maxOrder = Math.max(
            ...items.map(item => Number(item.orden_visual || 0))
        );

        return maxOrder + 1;
    }

    function handleProtectedResponse(res, data) {

        const message = String(data?.message || "").toLowerCase();

        if (res.status === 401) {

            logout(false);

            return true;

        }

        if (
            res.status === 403 &&
            (
                message.includes("usuario inactivo") ||
                message.includes("sesión") ||
                message.includes("token")
            )
        ) {

            logout(false);

            return true;

        }

        if (
            res.status === 403 &&
            message.includes("contraseña")
        ) {

            window.location.href = "./change-password.html";

            return true;

        }

        return false;

    }

    /* =========================
       PUBLIC API
    ========================= */

    return {

        API,
        UPLOADS_BASE,

        get adminUser() {
            return getAdminUser();
        },
        getToken,
        getAdminUser,

        requireAuth,
        validateSession,
        getAuthHeaders,
        logout,

        getAllowedCenters,
        ensureAllowedCenter,
        applyCenterRestrictions,

        escapeHtml,
        safeJson,

        showStatus,
        clearStatus,

        getCenterLabel,
        getImageUrl,

        sortByOrder,

        getItemsByCenter,
        getNextOrder,

        handleProtectedResponse
    };

})();

window.AdminCore = AdminCore;