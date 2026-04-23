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
    if (!fotoUrl) return "../assets/images/docente1.jpg";
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
    const label = document.getElementById("docentes-active-center");

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

function scheduleDocentesVisitTracking() {
    if (metricsTrackTimeout) {
        clearTimeout(metricsTrackTimeout);
    }

    metricsTrackTimeout = setTimeout(() => {
        const center = getActiveCenter();

        if (!center) return;
        if (center === lastTrackedCenter) return;

        lastTrackedCenter = center;
        trackPageVisit("docentes", center);
    }, 250);
}

function renderNoCenterState(container) {
    container.innerHTML = `
        <div class="docente">
            <img src="../assets/images/docente1.jpg" alt="Seleccione un centro">
            <h2>Selecciona un centro para ver los docentes.</h2>
            <p>Vuelve al inicio del portal y elige la sede correspondiente para cargar la información académica.</p>
        </div>
    `;
}

async function loadDocentes() {
    const container = document.getElementById("docentes-container");

    if (!container) return;

    const center = getActiveCenter();

    if (!center) {
        renderNoCenterState(container);
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/docentes?centro=${encodeURIComponent(center)}`);
        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            throw new Error(data.message || "No se pudieron cargar los docentes.");
        }

        if (!Array.isArray(data.items) || data.items.length === 0) {
            container.innerHTML = `
                <div class="docente">
                    <img src="../assets/images/docente1.jpg" alt="Sin docentes">
                    <h2>No hay docentes registrados para este centro.</h2>
                    <p>Agrega docentes desde el panel administrativo para mostrarlos aquí.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = data.items.map(docente => `
            <div class="docente">
                <img src="${escapeHtml(getImageUrl(docente.foto_url))}" alt="${escapeHtml(docente.nombre)}">
                <h2>${escapeHtml(docente.nombre)}</h2>
                <p>${escapeHtml(docente.cargo || docente.descripcion || "")}</p>
            </div>
        `).join("");
    } catch (error) {
        console.error("Error cargando docentes:", error);

        container.innerHTML = `
            <div class="docente">
                <img src="../assets/images/docente1.jpg" alt="Error al cargar docentes">
                <h2>No se pudieron cargar los docentes.</h2>
                <p>Revisa que el backend esté encendido y que la ruta <strong>/informatica-api/docentes?centro=${escapeHtml(center || "")}</strong> funcione correctamente.</p>
            </div>
        `;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    updateCenterBanner();
    loadDocentes();
    scheduleDocentesVisitTracking();
});