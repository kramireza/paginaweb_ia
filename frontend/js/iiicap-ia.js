const API_BASE = `${window.location.origin}/informatica-api`.replace(/\/+$/, "");
const FILES_BASE = `${window.location.origin}/informatica-uploads`.replace(/\/+$/, "");

let lastTrackedCenter = null;
let metricsTrackTimeout = null;

function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function safeJson(response) {
    const text = await response.text();

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`La respuesta no es JSON válido. Respuesta recibida: ${text.slice(0, 160)}`);
    }
}

function getImageUrl(fileUrl) {
    if (!fileUrl) return "../assets/images/docente1.jpg";
    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) return fileUrl;

    const normalized = String(fileUrl)
        .replace(/^\/informatica-uploads/, "")
        .replace(/^\/uploads/, "")
        .replace(/^\/+/, "");

    return `${FILES_BASE}/${normalized}`;
}

function getFileUrl(fileUrl) {
    if (!fileUrl) return "";
    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) return fileUrl;

    const normalized = String(fileUrl)
        .replace(/^\/informatica-uploads/, "")
        .replace(/^\/uploads/, "")
        .replace(/^\/+/, "");

    return `${FILES_BASE}/${normalized}`;
}

function getActiveCenter() {
    if (window.IA_CENTER && typeof window.IA_CENTER.getActiveCenter === "function") {
        return window.IA_CENTER.getActiveCenter();
    }
    return null;
}

function getCenterMeta(center) {
    if (window.IA_CENTER && typeof window.IA_CENTER.getCenterMeta === "function") {
        return window.IA_CENTER.getCenterMeta(center);
    }

    return {
        shortName: "Sin seleccionar",
        fullName: "Sin centro"
    };
}

function formatFecha(fecha) {
    if (!fecha) return "Sin fecha";
    const date = new Date(`${fecha}T00:00:00`);
    if (Number.isNaN(date.getTime())) return fecha;

    return date.toLocaleDateString("es-HN", {
        year: "numeric",
        month: "long",
        day: "2-digit"
    });
}

function updateCenterTexts() {
    const center = getActiveCenter();
    if (!center) return;

    const meta = getCenterMeta(center);

    document.querySelectorAll("[data-center-name]").forEach(el => {
        el.textContent = meta.shortName;
    });

    document.querySelectorAll("[data-center-fullname]").forEach(el => {
        el.textContent = meta.fullName;
    });

    document.querySelectorAll("[data-center-city]").forEach(el => {
        el.textContent = meta.city;
    });
}

async function trackPageVisit(pageKey, center) {
    try {
        await fetch(`${API_BASE}/metrics/visit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                page_key: pageKey,
                centro: center || null,
                path: window.location.pathname + window.location.search
            })
        });
    } catch (error) {
        console.error("Error registrando visita:", error);
    }
}

function scheduleIiicapVisitTracking() {
    if (metricsTrackTimeout) {
        clearTimeout(metricsTrackTimeout);
    }

    metricsTrackTimeout = setTimeout(() => {
        const center = getActiveCenter();

        if (!center) return;
        if (center === lastTrackedCenter) return;

        lastTrackedCenter = center;
        trackPageVisit("iiicap", center);
    }, 250);
}

async function loadIiicapInfo() {
    const container = document.getElementById("iiicap-info-container");
    if (!container) return;

    const center = getActiveCenter();

    if (!center) {
        container.innerHTML = `
            <div class="iiicap-empty">
                Primero selecciona tu centro para ver la información del instituto.
            </div>
        `;
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/iiicap/info?centro=${encodeURIComponent(center)}`);
        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            throw new Error(data.message || "No se pudo cargar la información del instituto.");
        }

        if (!data.item) {
            container.innerHTML = `
                <article class="iiicap-info-card">
                    <h2>IIICAP-IA</h2>
                    <p>
                        Aún no se ha registrado una descripción general para este centro.
                        Puedes agregarla desde el panel administrativo para mostrar aquí la finalidad,
                        alcance y enfoque del instituto.
                    </p>
                </article>
            `;
            return;
        }

        const item = data.item;

        container.innerHTML = `
            <article class="iiicap-info-card">
                <h2>${escapeHtml(item.titulo || "IIICAP-IA")}</h2>
                <p>${escapeHtml(item.descripcion || "").replace(/\n/g, "<br>")}</p>
            </article>
        `;
    } catch (error) {
        console.error("Error cargando info IIICAP-IA:", error);
        container.innerHTML = `
            <div class="iiicap-empty">
                No se pudo cargar la información del instituto. Revisa la ruta
                <strong>/informatica-api/iiicap/info?centro=${escapeHtml(center || "")}</strong>.
            </div>
        `;
    }
}

async function loadIiicapEncargados() {
    const container = document.getElementById("iiicap-encargados-container");
    if (!container) return;

    const center = getActiveCenter();

    if (!center) {
        container.innerHTML = `
            <div class="iiicap-empty">
                Primero selecciona tu centro para ver los encargados del instituto.
            </div>
        `;
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/iiicap/encargados?centro=${encodeURIComponent(center)}`);
        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            throw new Error(data.message || "No se pudieron cargar los encargados.");
        }

        if (!Array.isArray(data.items) || data.items.length === 0) {
            container.innerHTML = `
                <div class="iiicap-empty">
                    No hay encargados registrados para este centro.
                </div>
            `;
            return;
        }

        container.innerHTML = data.items.map(item => `
            <article class="iiicap-person-card">
                <img src="${escapeHtml(getImageUrl(item.foto_url))}" alt="${escapeHtml(item.nombre)}">

                <div class="iiicap-person-info">
                    <h3>${escapeHtml(item.nombre)}</h3>
                    <p><strong>Cargo:</strong> ${escapeHtml(item.cargo || "Sin cargo")}</p>
                    ${item.descripcion ? `<p>${escapeHtml(item.descripcion)}</p>` : ""}
                    ${item.correo ? `<p><strong>Correo:</strong> ${escapeHtml(item.correo)}</p>` : ""}
                    ${item.telefono ? `<p><strong>Teléfono:</strong> ${escapeHtml(item.telefono)}</p>` : ""}
                </div>
            </article>
        `).join("");
    } catch (error) {
        console.error("Error cargando encargados IIICAP-IA:", error);
        container.innerHTML = `
            <div class="iiicap-empty">
                No se pudieron cargar los encargados del instituto. Revisa la ruta
                <strong>/informatica-api/iiicap/encargados?centro=${escapeHtml(center || "")}</strong>.
            </div>
        `;
    }
}

async function loadIiicapInvestigaciones() {
    const container = document.getElementById("iiicap-investigaciones-container");
    if (!container) return;

    const center = getActiveCenter();

    if (!center) {
        container.innerHTML = `
            <div class="iiicap-empty">
                Primero selecciona tu centro para ver las investigaciones del instituto.
            </div>
        `;
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/iiicap/investigaciones?centro=${encodeURIComponent(center)}`);
        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            throw new Error(data.message || "No se pudieron cargar las investigaciones.");
        }

        if (!Array.isArray(data.items) || data.items.length === 0) {
            container.innerHTML = `
                <div class="iiicap-empty">
                    No hay investigaciones registradas para este centro.
                </div>
            `;
            return;
        }

        container.innerHTML = data.items.map(item => `
            <article class="iiicap-investigacion-card">
                <div class="iiicap-investigacion-top">
                    <span class="iiicap-badge">Investigación</span>
                    <span class="iiicap-badge">${escapeHtml(formatFecha(item.fecha))}</span>
                </div>

                <h3>${escapeHtml(item.titulo)}</h3>
                <p>${escapeHtml(item.descripcion || "")}</p>

                <div class="iiicap-investigacion-actions">
                    ${item.archivo_url ? `<a class="download-btn primary" href="${escapeHtml(getFileUrl(item.archivo_url))}" target="_blank" rel="noopener noreferrer">Descargar archivo</a>` : ""}
                    ${item.enlace_externo ? `<a class="download-btn secondary" href="${escapeHtml(item.enlace_externo)}" target="_blank" rel="noopener noreferrer">Abrir enlace</a>` : ""}
                </div>
            </article>
        `).join("");
    } catch (error) {
        console.error("Error cargando investigaciones IIICAP-IA:", error);
        container.innerHTML = `
            <div class="iiicap-empty">
                No se pudieron cargar las investigaciones del instituto. Revisa la ruta
                <strong>/informatica-api/iiicap/investigaciones?centro=${escapeHtml(center || "")}</strong>.
            </div>
        `;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    updateCenterTexts();
    loadIiicapInfo();
    loadIiicapEncargados();
    loadIiicapInvestigaciones();
    scheduleIiicapVisitTracking();
});