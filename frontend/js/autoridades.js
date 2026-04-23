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

function getImageUrl(fotoUrl) {
    if (!fotoUrl) return "../assets/images/Wilmer_Presidencia.png";
    if (fotoUrl.startsWith("http://") || fotoUrl.startsWith("https://")) return fotoUrl;

    const normalized = String(fotoUrl)
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
        shortName: "Sin seleccionar"
    };
}

function updateCenterBanner() {
    const center = getActiveCenter();
    const label = document.getElementById("autoridades-active-center");

    if (!label) return;

    if (!center) {
        label.textContent = "Sin seleccionar";
        return;
    }

    const meta = getCenterMeta(center);
    label.textContent = meta.shortName;
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

function scheduleAutoridadesVisitTracking() {
    if (metricsTrackTimeout) {
        clearTimeout(metricsTrackTimeout);
    }

    metricsTrackTimeout = setTimeout(() => {
        const center = getActiveCenter();

        if (!center) return;
        if (center === lastTrackedCenter) return;

        lastTrackedCenter = center;
        trackPageVisit("autoridades", center);
    }, 250);
}

function renderNoCenterState(container) {
    container.innerHTML = `
        <div class="Estudiantes-card">
            <img src="../assets/images/Wilmer_Presidencia.png" alt="Seleccione un centro">
            <div class="Estudiantes-info">
                <h2>Selecciona un centro para ver las autoridades estudiantiles.</h2>
                <p>Vuelve al inicio del portal y elige la sede correspondiente para cargar la información de representación estudiantil.</p>
            </div>
        </div>
    `;
}

function renderNoCenterInfo(container) {
    container.innerHTML = `
        <article class="directiva-info-card">
            <h2>Selecciona un centro para ver la información de la directiva.</h2>
            <p>Primero debes elegir una sede desde el inicio del portal para cargar la descripción institucional correspondiente.</p>
        </article>
    `;
}

async function loadAutoridadesInfo() {
    const container = document.getElementById("autoridades-info-container");

    if (!container) return;

    const center = getActiveCenter();

    if (!center) {
        renderNoCenterInfo(container);
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/autoridades/info?centro=${encodeURIComponent(center)}`);
        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            throw new Error(data.message || "No se pudo cargar la información de la directiva.");
        }

        if (!data.item) {
            container.innerHTML = `
                <article class="directiva-info-card">
                    <h2>Directiva estudiantil</h2>
                    <p>
                        Aún no se ha registrado una descripción general para este centro. Puedes agregarla desde el panel administrativo
                        para explicar qué es la directiva, cuál es su finalidad y cómo se elige.
                    </p>
                </article>
            `;
            return;
        }

        const item = data.item;

        container.innerHTML = `
            <article class="directiva-info-card">
                <h2>${escapeHtml(item.titulo || "Directiva estudiantil")}</h2>
                <p>${escapeHtml(item.descripcion || "").replace(/\n/g, "<br>")}</p>
            </article>
        `;
    } catch (error) {
        console.error("Error cargando información de la directiva:", error);

        container.innerHTML = `
            <article class="directiva-info-card">
                <h2>No se pudo cargar la información general de la directiva.</h2>
                <p>Revisa que el backend esté encendido y que la ruta <strong>/informatica-api/autoridades/info?centro=${escapeHtml(center || "")}</strong> funcione correctamente.</p>
            </article>
        `;
    }
}

async function loadAutoridades() {
    const container = document.getElementById("autoridades-container");

    if (!container) return;

    const center = getActiveCenter();

    if (!center) {
        renderNoCenterState(container);
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/autoridades?centro=${encodeURIComponent(center)}`);
        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            throw new Error(data.message || "No se pudieron cargar las autoridades.");
        }

        if (!Array.isArray(data.items) || data.items.length === 0) {
            container.innerHTML = `
                <div class="Estudiantes-card">
                    <img src="../assets/images/Wilmer_Presidencia.png" alt="Sin autoridades">
                    <div class="Estudiantes-info">
                        <h2>No hay autoridades registradas para este centro.</h2>
                        <p>Agrega autoridades desde el panel administrativo para mostrarlas aquí.</p>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = data.items.map(item => `
            <div class="Estudiantes-card">
                <img src="${escapeHtml(getImageUrl(item.foto_url))}" alt="${escapeHtml(item.nombre)}">
                <div class="Estudiantes-info">
                    <h2>${escapeHtml(item.nombre)}</h2>
                    <p>${escapeHtml(item.cargo || "")}</p>
                </div>
            </div>
        `).join("");
    } catch (error) {
        console.error("Error cargando autoridades:", error);

        container.innerHTML = `
            <div class="Estudiantes-card">
                <img src="../assets/images/Wilmer_Presidencia.png" alt="Error al cargar autoridades">
                <div class="Estudiantes-info">
                    <h2>No se pudieron cargar las autoridades.</h2>
                    <p>Revisa que el backend esté encendido y que la ruta <strong>/informatica-api/autoridades?centro=${escapeHtml(center || "")}</strong> funcione correctamente.</p>
                </div>
            </div>
        `;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    updateCenterBanner();
    loadAutoridadesInfo();
    loadAutoridades();
    scheduleAutoridadesVisitTracking();
});