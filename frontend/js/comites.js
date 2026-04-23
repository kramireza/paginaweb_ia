const API_BASE = `${window.location.origin}/informatica-api`.replace(/\/+$/, "");

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
        shortName: "UNAH-VS",
        fullName: "Universidad Nacional Autónoma de Honduras - Valle de Sula",
        city: "San Pedro Sula"
    };
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

function scheduleComitesVisitTracking() {
    if (metricsTrackTimeout) {
        clearTimeout(metricsTrackTimeout);
    }

    metricsTrackTimeout = setTimeout(() => {
        const center = getActiveCenter();

        if (!center) return;
        if (center === lastTrackedCenter) return;

        lastTrackedCenter = center;
        trackPageVisit("comites", center);
    }, 250);
}

async function loadComites() {
    const container = document.getElementById("comites-container");
    if (!container) return;

    const center = getActiveCenter();

    if (!center) {
        container.innerHTML = `
            <div class="comite-empty">
                Primero selecciona tu centro para ver los comités y grupos correspondientes.
            </div>
        `;
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/comites?centro=${encodeURIComponent(center)}`);
        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            throw new Error(data.message || "No se pudieron cargar los comités.");
        }

        if (!Array.isArray(data.items) || data.items.length === 0) {
            container.innerHTML = `
                <div class="comite-empty">
                    No hay comités o grupos publicados para este centro en este momento.
                </div>
            `;
            return;
        }

        container.innerHTML = data.items.map(item => `
            <article class="comite-card">
                <div class="comite-card-top">
                    <span class="comite-badge">Comité / Grupo</span>
                    <span class="comite-badge">${escapeHtml(getCenterMeta(item.centro).shortName)}</span>
                </div>

                <h3>${escapeHtml(item.nombre)}</h3>
                <p>${escapeHtml(item.descripcion || "")}</p>

                <div class="comite-meta">
                    ${item.encargados ? `<span><strong>Encargados:</strong> ${escapeHtml(item.encargados)}</span>` : ""}
                </div>
            </article>
        `).join("");
    } catch (error) {
        console.error("Error cargando comités:", error);
        container.innerHTML = `
            <div class="comite-empty">
                No se pudieron cargar los comités y grupos. Revisa que el backend esté encendido y que la ruta
                <strong>/informatica-api/comites?centro=${escapeHtml(center)}</strong> funcione correctamente.
            </div>
        `;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    updateCenterTexts();
    loadComites();
    scheduleComitesVisitTracking();
});