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
    const label = document.getElementById("jefatura-active-center");

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

function scheduleJefaturaVisitTracking() {
    if (metricsTrackTimeout) {
        clearTimeout(metricsTrackTimeout);
    }

    metricsTrackTimeout = setTimeout(() => {
        const center = getActiveCenter();

        if (!center) return;
        if (center === lastTrackedCenter) return;

        lastTrackedCenter = center;
        trackPageVisit("jefatura", center);
    }, 250);
}

function renderNoCenterState(container) {
    container.innerHTML = `
        <div class="docente-card">
            <img src="../assets/images/docente1.jpg" alt="Seleccione un centro">
            <div class="docente-info">
                <h2>Selecciona un centro para ver jefatura y coordinación.</h2>
                <p>Vuelve al inicio del portal y elige la sede correspondiente para cargar la información institucional.</p>
            </div>
        </div>
    `;
}

function renderNoCenterUbicacion(container) {
    container.innerHTML = `
        <article class="ubicacion-card">
            <div class="ubicacion-image-wrap">
                <img src="../assets/images/docente1.jpg" alt="Seleccione un centro">
            </div>
            <div class="ubicacion-info">
                <h3>Selecciona un centro para ver la ubicación del departamento.</h3>
                <p>Primero debes elegir una sede desde el inicio del portal.</p>
            </div>
        </article>
    `;
}

async function loadJefatura() {
    const container = document.getElementById("jefatura-container");

    if (!container) return;

    const center = getActiveCenter();

    if (!center) {
        renderNoCenterState(container);
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/jefatura?centro=${encodeURIComponent(center)}`);
        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            throw new Error(data.message || "No se pudo cargar la jefatura.");
        }

        if (!Array.isArray(data.items) || data.items.length === 0) {
            container.innerHTML = `
                <div class="docente-card">
                    <img src="../assets/images/docente1.jpg" alt="Sin registros">
                    <div class="docente-info">
                        <h2>No hay registros de jefatura o coordinación para este centro.</h2>
                        <p>Agrega registros desde el panel administrativo para mostrarlos aquí.</p>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = data.items.map(item => `
            <div class="docente-card">
                <img src="${escapeHtml(getImageUrl(item.foto_url))}" alt="${escapeHtml(item.nombre)}">
                <div class="docente-info">
                    <h2>${escapeHtml(item.nombre)}</h2>
                    ${item.cargo ? `<p><strong>Cargo:</strong> ${escapeHtml(item.cargo)}</p>` : ""}
                    ${item.descripcion ? `<p>${escapeHtml(item.descripcion)}</p>` : ""}
                    ${item.correo ? `<p><strong>Correo:</strong> ${escapeHtml(item.correo)}</p>` : ""}
                    ${item.telefono ? `<p><strong>Teléfono:</strong> ${escapeHtml(item.telefono)}</p>` : ""}
                </div>
            </div>
        `).join("");
    } catch (error) {
        console.error("Error cargando jefatura:", error);

        container.innerHTML = `
            <div class="docente-card">
                <img src="../assets/images/docente1.jpg" alt="Error al cargar jefatura">
                <div class="docente-info">
                    <h2>No se pudo cargar la jefatura y coordinación.</h2>
                    <p>Revisa que el backend esté encendido y que la ruta <strong>/informatica-api/jefatura?centro=${escapeHtml(center || "")}</strong> funcione correctamente.</p>
                </div>
            </div>
        `;
    }
}

async function loadUbicacionDepartamento() {
    const container = document.getElementById("ubicacion-container");

    if (!container) return;

    const center = getActiveCenter();

    if (!center) {
        renderNoCenterUbicacion(container);
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/jefatura/ubicacion?centro=${encodeURIComponent(center)}`);
        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            throw new Error(data.message || "No se pudo cargar la ubicación del departamento.");
        }

        if (!data.item) {
            container.innerHTML = `
                <article class="ubicacion-card">
                    <div class="ubicacion-image-wrap">
                        <img src="../assets/images/docente1.jpg" alt="Sin ubicación registrada">
                    </div>
                    <div class="ubicacion-info">
                        <h3>No hay ubicación registrada para este centro.</h3>
                        <p>Puedes agregarla desde el panel administrativo para que se muestre en esta sección.</p>
                    </div>
                </article>
            `;
            return;
        }

        const item = data.item;

        container.innerHTML = `
            <article class="ubicacion-card">
                <div class="ubicacion-image-wrap">
                    <img src="${escapeHtml(getImageUrl(item.imagen_url))}" alt="${escapeHtml(item.titulo || "Ubicación del departamento")}">
                </div>
                <div class="ubicacion-info">
                    <h3>${escapeHtml(item.titulo || "Ubicación del departamento")}</h3>
                    ${item.descripcion ? `<p>${escapeHtml(item.descripcion)}</p>` : `<p>Información de ubicación disponible para este centro.</p>`}
                </div>
            </article>
        `;
    } catch (error) {
        console.error("Error cargando ubicación del departamento:", error);

        container.innerHTML = `
            <article class="ubicacion-card">
                <div class="ubicacion-image-wrap">
                    <img src="../assets/images/docente1.jpg" alt="Error de carga">
                </div>
                <div class="ubicacion-info">
                    <h3>No se pudo cargar la ubicación del departamento.</h3>
                    <p>Revisa que el backend esté encendido y que la ruta <strong>/informatica-api/jefatura/ubicacion?centro=${escapeHtml(center || "")}</strong> funcione correctamente.</p>
                </div>
            </article>
        `;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    updateCenterBanner();
    loadJefatura();
    loadUbicacionDepartamento();
    scheduleJefaturaVisitTracking();
});