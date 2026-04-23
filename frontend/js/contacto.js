const CONTACT_EMAILS = {
    jefatura: "jorge.fuentes@unah.edu.hn",
    coordinacion: "coordinacion.infovs@unah.edu.hn",
    directiva: "asociacion.iavs@unah.edu.hn"
};

const CONTACT_LABELS = {
    jefatura: "Jefatura",
    coordinacion: "Coordinación",
    directiva: "Directiva"
};

const API_BASE = `${window.location.origin}/informatica-api`.replace(/\/+$/, "");

let lastTrackedCenter = null;
let metricsTrackTimeout = null;

function getCentroActivo() {
    if (window.IA_CENTER && typeof window.IA_CENTER.getActiveCenter === "function") {
        return window.IA_CENTER.getActiveCenter() || "vs";
    }

    const params = new URLSearchParams(window.location.search);
    return params.get("centro") || localStorage.getItem("ia_centro") || "vs";
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

function scheduleContactoVisitTracking() {
    if (metricsTrackTimeout) {
        clearTimeout(metricsTrackTimeout);
    }

    metricsTrackTimeout = setTimeout(() => {
        const center = getCentroActivo();

        if (!center) return;
        if (center === lastTrackedCenter) return;

        lastTrackedCenter = center;
        trackPageVisit("contacto", center);
    }, 250);
}

function showStatus(message, type = "info") {
    const box = document.getElementById("contacto-status");
    if (!box) return;

    box.textContent = message;
    box.className = `contacto-status show ${type}`;
}

function clearStatus() {
    const box = document.getElementById("contacto-status");
    if (!box) return;

    box.textContent = "";
    box.className = "contacto-status";
}

function updateDestinoPreview() {
    const destinatarioSelect = document.getElementById("destinatario");
    const preview = document.getElementById("contacto-destino-preview");

    if (!destinatarioSelect || !preview) return;

    const selected = destinatarioSelect.value;

    if (!selected || !CONTACT_EMAILS[selected]) {
        preview.textContent = "Selecciona un destinatario para visualizar el correo al que se enviará tu consulta.";
        return;
    }

    preview.innerHTML = `
        Tu consulta será enviada a <strong>${CONTACT_LABELS[selected]}</strong>:
        <br>
        <strong>${CONTACT_EMAILS[selected]}</strong>
    `;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

async function handleContactoSubmit(event) {
    event.preventDefault();
    clearStatus();

    const submitBtn = document.getElementById("contacto-submit-btn");

    const nombre = document.getElementById("nombre-completo")?.value.trim() || "";
    const email = document.getElementById("email")?.value.trim() || "";
    const telefono = document.getElementById("telefono")?.value.trim() || "";
    const destinatario = document.getElementById("destinatario")?.value || "";
    const asunto = document.getElementById("asunto")?.value.trim() || "";
    const mensaje = document.getElementById("mensaje")?.value.trim() || "";
    const centro = getCentroActivo();

    if (!nombre || nombre.length < 5) {
        showStatus("Ingresa un nombre completo válido.", "error");
        return;
    }

    if (!email || !isValidEmail(email)) {
        showStatus("Ingresa un correo electrónico válido.", "error");
        return;
    }

    if (!telefono || telefono.length < 8) {
        showStatus("Ingresa un número de teléfono válido.", "error");
        return;
    }

    if (!destinatario || !CONTACT_EMAILS[destinatario]) {
        showStatus("Selecciona un destinatario válido.", "error");
        return;
    }

    if (!asunto || asunto.length < 4) {
        showStatus("Ingresa un asunto válido.", "error");
        return;
    }

    if (!mensaje || mensaje.length < 10) {
        showStatus("El mensaje debe tener al menos 10 caracteres.", "error");
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = "Enviando...";
        showStatus("Estamos enviando tu consulta, por favor espera...", "info");

        const response = await fetch(`${API_BASE}/contacto`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                centro,
                nombre,
                correo: email,
                telefono,
                destinatario,
                asunto,
                mensaje
            })
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
            throw new Error(data.message || "No se pudo enviar la consulta");
        }

        showStatus("Tu consulta fue enviada correctamente. También quedó registrada en el sistema.", "success");
        document.getElementById("contacto-form")?.reset();
        updateDestinoPreview();
    } catch (error) {
        console.error("Error enviando contacto:", error);
        showStatus(error.message || "Ocurrió un error al enviar tu consulta.", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Enviar consulta";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("contacto-form");
    const destinatarioSelect = document.getElementById("destinatario");

    destinatarioSelect?.addEventListener("change", updateDestinoPreview);
    form?.addEventListener("submit", handleContactoSubmit);

    updateDestinoPreview();
    scheduleContactoVisitTracking();
});