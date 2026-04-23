const API_BASE = `${window.location.origin}/informatica-api`.replace(/\/+$/, "");
const FILES_BASE = `${window.location.origin}/informatica-uploads`.replace(/\/+$/, "");

let calendarEvents = [];
let currentCalendarYear = null;
let currentCalendarMonth = null;
let tutorialesCache = [];
let tutorialSeleccionadoId = null;
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

function parseDateValue(fecha) {
    if (!fecha) return null;

    const date = new Date(fecha);
    if (!Number.isNaN(date.getTime())) {
        return date;
    }

    const fallback = new Date(`${fecha}T00:00:00`);
    if (!Number.isNaN(fallback.getTime())) {
        return fallback;
    }

    return null;
}

function formatFechaCorta(fecha) {
    const date = parseDateValue(fecha);
    if (!date) return "Sin fecha";

    return date.toLocaleDateString("es-HN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function getMonthShort(fecha) {
    const date = parseDateValue(fecha);
    if (!date) return "---";

    return date.toLocaleString("es-HN", { month: "short" }).replace(".", "").toUpperCase();
}

function getDay(fecha) {
    const date = parseDateValue(fecha);
    if (!date) return "--";

    return String(date.getDate()).padStart(2, "0");
}

function normalizeLink(link) {
    if (!link) return "";
    return String(link).trim();
}

function buildPublicUploadUrl(filePath = "") {
    if (!filePath) return "";
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) return filePath;

    const normalized = String(filePath).replace(/^\/uploads/, "").replace(/^\/+/, "");
    return `${FILES_BASE}/${normalized}`;
}

function getClosestUpcomingDate(items) {
    if (!Array.isArray(items) || items.length === 0) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validDates = items
        .map(item => parseDateValue(item.fecha))
        .filter(date => date !== null)
        .sort((a, b) => a - b);

    const upcoming = validDates.find(date => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d >= today;
    });

    return upcoming || validDates[0] || null;
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

function updateCenterBanner() {
    const center = getActiveCenter();
    const label = document.getElementById("active-center-label");

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

function scheduleHomeVisitTracking() {
    if (metricsTrackTimeout) {
        clearTimeout(metricsTrackTimeout);
    }

    metricsTrackTimeout = setTimeout(() => {
        const center = getActiveCenter();

        if (!center) return;
        if (center === lastTrackedCenter) return;

        lastTrackedCenter = center;
        trackPageVisit("index", center);
    }, 250);
}

function renderMiniCalendar(items) {
    const calendarContainer = document.getElementById("mini-calendar-container");
    if (!calendarContainer) return;

    calendarEvents = Array.isArray(items) ? items : [];

    if (currentCalendarYear === null || currentCalendarMonth === null) {
        const baseDate = getClosestUpcomingDate(calendarEvents) || new Date();
        currentCalendarYear = baseDate.getFullYear();
        currentCalendarMonth = baseDate.getMonth();
    }

    const today = new Date();
    const year = currentCalendarYear;
    const month = currentCalendarMonth;

    const monthName = new Date(year, month, 1).toLocaleString("es-HN", { month: "long" });
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    let startWeekDay = firstDay.getDay();
    startWeekDay = startWeekDay === 0 ? 6 : startWeekDay - 1;

    const markedDays = new Map();

    calendarEvents.forEach(item => {
        const d = parseDateValue(item.fecha);
        if (!d) return;

        if (d.getFullYear() === year && d.getMonth() === month) {
            const day = d.getDate();
            if (!markedDays.has(day)) {
                markedDays.set(day, []);
            }
            markedDays.get(day).push(item);
        }
    });

    let cells = "";

    for (let i = 0; i < startWeekDay; i++) {
        cells += `<div class="calendar-day empty"></div>`;
    }

    for (let day = 1; day <= totalDays; day++) {
        const dayEvents = markedDays.get(day) || [];
        const isMarked = dayEvents.length > 0;
        const isToday =
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear();

        const tooltipText = dayEvents.map(event => `${event.titulo}`).join(" • ");

        cells += `
            <div
                class="calendar-day ${isMarked ? "marked" : ""} ${isToday ? "today" : ""}"
                title="${escapeHtml(tooltipText)}"
            >
                ${day}
            </div>
        `;
    }

    const monthEvents = calendarEvents
        .filter(item => {
            const d = parseDateValue(item.fecha);
            return d && d.getFullYear() === year && d.getMonth() === month;
        })
        .sort((a, b) => {
            const da = parseDateValue(a.fecha);
            const db = parseDateValue(b.fecha);
            return da - db;
        });

    calendarContainer.innerHTML = `
        <div class="mini-calendar-card">
            <div class="mini-calendar-header">
                <div class="mini-calendar-title-block">
                    <h3>Calendario académico</h3>
                    <span>${escapeHtml(monthName.charAt(0).toUpperCase() + monthName.slice(1))} ${year}</span>
                </div>

                <div class="mini-calendar-nav">
                    <button type="button" class="calendar-nav-btn" id="calendar-prev-btn" aria-label="Mes anterior">◀</button>
                    <button type="button" class="calendar-nav-btn" id="calendar-next-btn" aria-label="Mes siguiente">▶</button>
                </div>
            </div>

            <div class="calendar-weekdays">
                <div>L</div>
                <div>M</div>
                <div>M</div>
                <div>J</div>
                <div>V</div>
                <div>S</div>
                <div>D</div>
            </div>

            <div class="calendar-grid">
                ${cells}
            </div>

            <div class="calendar-legend">
                <span class="legend-dot"></span>
                <span>Fechas importantes marcadas</span>
            </div>

            <div class="calendar-events-preview">
                <h4>Fechas de este mes</h4>
                ${
                    monthEvents.length > 0
                        ? monthEvents.map(event => `
                            <div class="calendar-event-item">
                                <span class="calendar-event-date">${escapeHtml(getDay(event.fecha))} ${escapeHtml(getMonthShort(event.fecha))}</span>
                                <span class="calendar-event-title">${escapeHtml(event.titulo)}</span>
                            </div>
                        `).join("")
                        : `<p class="calendar-no-events">No hay fechas importantes registradas para este mes.</p>`
                }
            </div>
        </div>
    `;

    const prevBtn = document.getElementById("calendar-prev-btn");
    const nextBtn = document.getElementById("calendar-next-btn");

    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            currentCalendarMonth--;

            if (currentCalendarMonth < 0) {
                currentCalendarMonth = 11;
                currentCalendarYear--;
            }

            renderMiniCalendar(calendarEvents);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            currentCalendarMonth++;

            if (currentCalendarMonth > 11) {
                currentCalendarMonth = 0;
                currentCalendarYear++;
            }

            renderMiniCalendar(calendarEvents);
        });
    }
}

function getResourceTypeLabel(tipo) {
    const map = {
        pdf: "PDF",
        docx: "DOCX",
        xlsx: "XLSX",
        pptx: "PPTX",
        zip: "ZIP",
        png: "PNG",
        jpg: "JPG",
        jpeg: "JPG"
    };

    return map[String(tipo || "").toLowerCase()] || "Recurso";
}

function getResourceIcon(tipo) {
    const normalized = String(tipo || "").toLowerCase();

    if (normalized === "pdf") return "📄";
    if (normalized === "docx") return "📝";
    if (normalized === "xlsx") return "📊";
    if (normalized === "pptx") return "📽️";
    if (normalized === "zip") return "🗜️";
    if (normalized === "png" || normalized === "jpg" || normalized === "jpeg") return "🖼️";
    return "📁";
}

function getResourceCenterLabel(centro) {
    const map = {
        global: "Global",
        vs: "UNAH-VS",
        cu: "Ciudad Universitaria",
        danli: "UNAH Danlí"
    };

    return map[String(centro || "").toLowerCase()] || "Recurso";
}

function getTutorialCenterLabel(centro) {
    return getResourceCenterLabel(centro);
}

function getEmbedUrl(link) {
    const url = normalizeLink(link);
    if (!url) return "";

    if (url.includes("youtube.com/watch?v=")) {
        const videoId = url.split("watch?v=")[1].split("&")[0];
        return `https://www.youtube.com/embed/${videoId}`;
    }

    if (url.includes("youtu.be/")) {
        const videoId = url.split("youtu.be/")[1].split("?")[0];
        return `https://www.youtube.com/embed/${videoId}`;
    }

    if (url.includes("youtube.com/embed/")) {
        return url;
    }

    if (url.includes("vimeo.com/") && !url.includes("player.vimeo.com/video/")) {
        const videoId = url.split("vimeo.com/")[1].split("?")[0];
        return `https://player.vimeo.com/video/${videoId}`;
    }

    if (url.includes("player.vimeo.com/video/")) {
        return url;
    }

    return url;
}

function isEmbeddableUrl(link) {
    const url = getEmbedUrl(link);
    if (!url) return false;

    return (
        url.includes("youtube.com/embed/") ||
        url.includes("player.vimeo.com/video/")
    );
}

function renderTutorialPlayer(item) {
    if (!item) {
        return `
            <div class="tutorial-player-placeholder">
                Selecciona un tutorial para comenzar.
            </div>
        `;
    }

    const embedUrl = getEmbedUrl(item.enlace_video);
    const videoFileUrl = item.video_url ? buildPublicUploadUrl(item.video_url) : "";

    let mediaHtml = `
        <div class="tutorial-player-placeholder">
            Este tutorial no tiene una fuente de video válida.
        </div>
    `;

    if (videoFileUrl) {
        mediaHtml = `
            <video class="tutorial-main-video" controls preload="metadata">
                <source src="${escapeHtml(videoFileUrl)}" type="video/${escapeHtml(item.tipo_video || "mp4")}">
                Tu navegador no soporta la reproducción de video.
            </video>
        `;
    } else if (embedUrl && isEmbeddableUrl(item.enlace_video)) {
        mediaHtml = `
            <div class="tutorial-embed-wrap">
                <iframe
                    src="${escapeHtml(embedUrl)}"
                    title="${escapeHtml(item.titulo)}"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                ></iframe>
            </div>
        `;
    } else if (embedUrl) {
        mediaHtml = `
            <div class="tutorial-player-placeholder">
                Este tutorial usa un enlace externo que no puede embeberse automáticamente.
                <br><br>
                <a href="${escapeHtml(embedUrl)}" target="_blank" rel="noopener noreferrer" class="download-btn secondary">Abrir tutorial</a>
            </div>
        `;
    }

    return `
        <div class="tutorial-player-media">
            ${mediaHtml}
        </div>

        <div class="tutorial-player-meta">
            <div class="tutorial-player-badges">
                <span class="tutorial-mini-badge">${escapeHtml(getTutorialCenterLabel(item.centro))}</span>
                ${item.tipo_video ? `<span class="tutorial-mini-badge soft">${escapeHtml(String(item.tipo_video).toUpperCase())}</span>` : ""}
                ${item.enlace_video ? `<span class="tutorial-mini-badge soft">Enlace</span>` : ""}
            </div>

            <h3>${escapeHtml(item.titulo)}</h3>
            <p>${escapeHtml(item.descripcion || "Tutorial disponible para consulta de la comunidad académica.")}</p>
        </div>
    `;
}

function renderTutorialPlaylist(items) {
    const container = document.getElementById("tutoriales-playlist-container");
    if (!container) return;

    if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = `
            <div class="tutorial-player-card">
                <div class="tutorial-player-placeholder">
                    No hay tutoriales disponibles para este centro.
                </div>
            </div>
            <div class="tutorial-list-card">
                <div class="tutorial-list-empty">Cuando se agreguen tutoriales desde el panel administrativo, aparecerán aquí.</div>
            </div>
        `;
        return;
    }

    tutorialesCache = items;

    if (!tutorialSeleccionadoId || !items.some(item => item.id === tutorialSeleccionadoId)) {
        tutorialSeleccionadoId = items[0].id;
    }

    const selected = items.find(item => item.id === tutorialSeleccionadoId) || items[0];

    container.innerHTML = `
        <div class="tutorial-player-card">
            ${renderTutorialPlayer(selected)}
        </div>

        <div class="tutorial-list-card">
            <div class="tutorial-list-header">
                <h3>Lista de tutoriales</h3>
                <span>${items.length} disponibles</span>
            </div>

            <div class="tutorial-list-items">
                ${items.map(item => `
                    <button
                        type="button"
                        class="tutorial-list-item ${item.id === tutorialSeleccionadoId ? "active" : ""}"
                        data-tutorial-id="${item.id}"
                    >
                        <div class="tutorial-list-item-top">
                            <span class="tutorial-list-icon">${item.video_url ? "🎬" : "▶️"}</span>
                            <div class="tutorial-list-item-text">
                                <strong>${escapeHtml(item.titulo)}</strong>
                                <span>${escapeHtml(getTutorialCenterLabel(item.centro))}</span>
                            </div>
                        </div>
                        ${item.descripcion ? `<p>${escapeHtml(item.descripcion)}</p>` : ""}
                    </button>
                `).join("")}
            </div>
        </div>
    `;

    document.querySelectorAll("[data-tutorial-id]").forEach(button => {
        button.addEventListener("click", () => {
            tutorialSeleccionadoId = Number(button.getAttribute("data-tutorial-id"));
            renderTutorialPlaylist(tutorialesCache);
        });
    });
}

async function loadAvisos() {
    const mainContainer = document.getElementById("main-aviso");
    const sideContainer = document.getElementById("side-avisos");

    if (!mainContainer || !sideContainer) return;

    const center = getActiveCenter();

    if (!center) {
        mainContainer.innerHTML = `
            <article class="featured-news-main">
                <div class="featured-label-row">
                    <span class="news-badge principal">Seleccione un centro</span>
                    <span class="news-date">Pendiente</span>
                </div>
                <h3>Primero selecciona tu centro.</h3>
                <p>El portal mostrará únicamente los avisos correspondientes a la sede seleccionada.</p>
            </article>
        `;

        sideContainer.innerHTML = `
            <article class="side-news-card">
                <div class="featured-label-row">
                    <span class="news-badge secundario">Información</span>
                </div>
                <h3>Contenido filtrado por sede</h3>
                <p>Selecciona UNAH-VS, Ciudad Universitaria o UNAH Danlí para continuar.</p>
            </article>
        `;
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/avisos?centro=${encodeURIComponent(center)}`);
        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            throw new Error(data.message || "No se pudieron cargar los avisos.");
        }

        if (!Array.isArray(data.items) || data.items.length === 0) {
            mainContainer.innerHTML = `
                <article class="featured-news-main">
                    <div class="featured-label-row">
                        <span class="news-badge principal">Sin avisos</span>
                        <span class="news-date">Sin registros</span>
                    </div>
                    <h3>No hay avisos publicados para este centro.</h3>
                    <p>Cuando se agreguen avisos desde el panel administrativo, aparecerán aquí.</p>
                </article>
            `;

            sideContainer.innerHTML = `
                <article class="side-news-card">
                    <div class="featured-label-row">
                        <span class="news-badge secundario">Información</span>
                    </div>
                    <h3>Sin avisos secundarios.</h3>
                    <p>No hay avisos adicionales disponibles en este momento para este centro.</p>
                </article>
            `;
            return;
        }

        const items = data.items;
        const principal = items.find(item => item.destacado) || items[0];
        const secundarios = items.filter(item => item.id !== principal.id).slice(0, 2);
        const principalLink = normalizeLink(principal.enlace);

        mainContainer.innerHTML = `
            <article class="featured-news-main">
                <div class="featured-label-row">
                    <span class="news-badge principal">${escapeHtml(principal.categoria || "Aviso destacado")}</span>
                    <span class="news-date">${escapeHtml(formatFechaCorta(principal.fecha_publicacion))}</span>
                </div>

                <h3>${escapeHtml(principal.titulo)}</h3>

                <p>${escapeHtml(principal.resumen || "")}</p>

                ${principal.contenido ? `<p>${escapeHtml(principal.contenido)}</p>` : ""}

                ${principalLink ? `<a href="${escapeHtml(principalLink)}" class="news-btn-main">Ver más</a>` : ""}
            </article>
        `;

        sideContainer.innerHTML = secundarios.length > 0
            ? secundarios.map(item => {
                const itemLink = normalizeLink(item.enlace);

                return `
                    <article class="side-news-card">
                        <div class="featured-label-row">
                            <span class="news-badge secundario">${escapeHtml(item.categoria || "General")}</span>
                        </div>
                        <h3>${escapeHtml(item.titulo)}</h3>
                        <p>${escapeHtml(item.resumen || "")}</p>
                        ${itemLink ? `<a href="${escapeHtml(itemLink)}">Ver más</a>` : ""}
                    </article>
                `;
            }).join("")
            : `
                <article class="side-news-card">
                    <div class="featured-label-row">
                        <span class="news-badge secundario">Información</span>
                    </div>
                    <h3>No hay avisos secundarios.</h3>
                    <p>Agrega más avisos desde el panel administrativo para mostrarlos aquí.</p>
                </article>
            `;
    } catch (error) {
        console.error("Error cargando avisos:", error);

        mainContainer.innerHTML = `
            <article class="featured-news-main">
                <div class="featured-label-row">
                    <span class="news-badge principal">Error</span>
                    <span class="news-date">No cargado</span>
                </div>
                <h3>No se pudieron cargar los avisos.</h3>
                <p>Revisa que el backend esté encendido y que la ruta <strong>/informatica-api/avisos?centro=${escapeHtml(center)}</strong> responda correctamente.</p>
            </article>
        `;

        sideContainer.innerHTML = `
            <article class="side-news-card">
                <div class="featured-label-row">
                    <span class="news-badge secundario">Error</span>
                </div>
                <h3>Error de carga</h3>
                <p>No fue posible obtener los avisos secundarios.</p>
            </article>
        `;
    }
}

async function loadReglamentos() {
    const container = document.getElementById("reglamentos-container");

    if (!container) return;

    const center = getActiveCenter();

    if (!center) {
        container.innerHTML = `
            <article class="reglamento-card">
                <div class="reglamento-header">
                    <span class="reglamento-badge">Seleccione un centro</span>
                </div>
                <h3>Primero selecciona tu centro.</h3>
                <p>Los fragmentos de reglamentos se mostrarán según la sede seleccionada.</p>
            </article>
        `;
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/avisos/reglamentos?centro=${encodeURIComponent(center)}`);
        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            throw new Error(data.message || "No se pudieron cargar los reglamentos.");
        }

        if (!Array.isArray(data.items) || data.items.length === 0) {
            container.innerHTML = `
                <article class="reglamento-card">
                    <div class="reglamento-header">
                        <span class="reglamento-badge">Sin registros</span>
                    </div>
                    <h3>No hay fragmentos de reglamentos publicados para este centro.</h3>
                    <p>Cuando se agreguen desde el panel administrativo, aparecerán aquí.</p>
                </article>
            `;
            return;
        }

        container.innerHTML = data.items.map(item => {
            const link = normalizeLink(item.enlace);

            return `
                <article class="reglamento-card">
                    <div class="reglamento-header">
                        <span class="reglamento-badge">Reglamento</span>
                        <span class="reglamento-order">Orden ${escapeHtml(item.orden_visual ?? 0)}</span>
                    </div>
                    <h3>${escapeHtml(item.titulo)}</h3>
                    <p>${escapeHtml(item.fragmento || "").replace(/\n/g, "<br>")}</p>
                    ${link ? `<a href="${escapeHtml(link)}" class="reglamento-link" target="_blank" rel="noopener noreferrer">Ver reglamento completo</a>` : ""}
                </article>
            `;
        }).join("");
    } catch (error) {
        console.error("Error cargando reglamentos:", error);

        container.innerHTML = `
            <article class="reglamento-card">
                <div class="reglamento-header">
                    <span class="reglamento-badge">Error</span>
                </div>
                <h3>No se pudieron cargar los fragmentos de reglamentos.</h3>
                <p>Revisa que el backend esté encendido y que la ruta <strong>/informatica-api/avisos/reglamentos?centro=${escapeHtml(center)}</strong> funcione correctamente.</p>
            </article>
        `;
    }
}

async function loadRecursosDescargables() {
    const container = document.getElementById("recursos-descargables-container");

    if (!container) return;

    const center = getActiveCenter();

    if (!center) {
        container.innerHTML = `
            <article class="download-card">
                <div class="download-card-top">
                    <span class="download-badge">Seleccione un centro</span>
                </div>
                <h3>Primero selecciona tu centro.</h3>
                <p>Los recursos descargables se mostrarán según la sede seleccionada, incluyendo los recursos globales.</p>
            </article>
        `;
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/avisos/recursos?centro=${encodeURIComponent(center)}`);
        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            throw new Error(data.message || "No se pudieron cargar los recursos.");
        }

        if (!Array.isArray(data.items) || data.items.length === 0) {
            container.innerHTML = `
                <article class="download-card">
                    <div class="download-card-top">
                        <span class="download-badge">Sin recursos</span>
                    </div>
                    <h3>No hay recursos disponibles para este centro.</h3>
                    <p>Cuando se agreguen desde el panel administrativo, aparecerán aquí.</p>
                </article>
            `;
            return;
        }

        container.innerHTML = data.items.map(item => {
            const externalLink = normalizeLink(item.enlace_externo);
            const fileLink = item.archivo_url ? buildPublicUploadUrl(item.archivo_url) : "";

            return `
                <article class="download-card">
                    <div class="download-card-top">
                        <div class="download-badge-group">
                            <span class="download-badge">${escapeHtml(getResourceCenterLabel(item.centro))}</span>
                            ${item.tipo_archivo ? `<span class="download-badge soft">${escapeHtml(getResourceTypeLabel(item.tipo_archivo))}</span>` : ""}
                        </div>
                        <span class="download-icon">${escapeHtml(getResourceIcon(item.tipo_archivo))}</span>
                    </div>

                    <h3>${escapeHtml(item.titulo)}</h3>
                    <p>${escapeHtml(item.descripcion || "Recurso disponible para consulta o descarga.")}</p>

                    <div class="download-meta">
                        ${item.archivo_nombre_original ? `<span><strong>Archivo:</strong> ${escapeHtml(item.archivo_nombre_original)}</span>` : ""}
                    </div>

                    <div class="download-actions">
                        ${fileLink ? `<a href="${escapeHtml(fileLink)}" target="_blank" rel="noopener noreferrer" class="download-btn primary">Descargar archivo</a>` : ""}
                        ${externalLink ? `<a href="${escapeHtml(externalLink)}" target="_blank" rel="noopener noreferrer" class="download-btn secondary">Abrir enlace</a>` : ""}
                    </div>
                </article>
            `;
        }).join("");
    } catch (error) {
        console.error("Error cargando recursos descargables:", error);

        container.innerHTML = `
            <article class="download-card">
                <div class="download-card-top">
                    <span class="download-badge">Error</span>
                </div>
                <h3>No se pudieron cargar los recursos descargables.</h3>
                <p>Revisa que el backend esté encendido y que la ruta <strong>/informatica-api/avisos/recursos?centro=${escapeHtml(center)}</strong> funcione correctamente.</p>
            </article>
        `;
    }
}

async function loadTutoriales() {
    const container = document.getElementById("tutoriales-playlist-container");
    if (!container) return;

    const center = getActiveCenter();

    if (!center) {
        container.innerHTML = `
            <div class="tutorial-player-card">
                <div class="tutorial-player-placeholder">
                    Selecciona un centro para ver los tutoriales.
                </div>
            </div>
            <div class="tutorial-list-card">
                <div class="tutorial-list-empty">Los tutoriales se cargarán según la sede seleccionada, incluyendo los globales.</div>
            </div>
        `;
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/avisos/tutoriales?centro=${encodeURIComponent(center)}`);
        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            throw new Error(data.message || "No se pudieron cargar los tutoriales.");
        }

        renderTutorialPlaylist(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
        console.error("Error cargando tutoriales:", error);

        container.innerHTML = `
            <div class="tutorial-player-card">
                <div class="tutorial-player-placeholder">
                    No se pudieron cargar los tutoriales.
                </div>
            </div>
            <div class="tutorial-list-card">
                <div class="tutorial-list-empty">
                    Revisa que el backend esté encendido y que la ruta <strong>/informatica-api/avisos/tutoriales?centro=${escapeHtml(center)}</strong> funcione correctamente.
                </div>
            </div>
        `;
    }
}

async function loadFechas() {
    const container = document.getElementById("fechas-container");

    if (!container) return;

    const center = getActiveCenter();

    if (!center) {
        container.innerHTML = `
            <article class="date-card">
                <div class="date-box">
                    <span class="day">--</span>
                    <span class="month">---</span>
                </div>
                <div class="date-info">
                    <h3>Selecciona un centro para ver sus fechas importantes.</h3>
                    <p>El contenido académico y administrativo se cargará según la sede seleccionada.</p>
                </div>
            </article>
        `;
        renderMiniCalendar([]);
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/fechas?centro=${encodeURIComponent(center)}`);
        const data = await safeJson(response);

        if (!response.ok || !data.ok) {
            throw new Error(data.message || "No se pudieron cargar las fechas.");
        }

        if (!Array.isArray(data.items) || data.items.length === 0) {
            container.innerHTML = `
                <article class="date-card">
                    <div class="date-box">
                        <span class="day">--</span>
                        <span class="month">---</span>
                    </div>
                    <div class="date-info">
                        <h3>No hay fechas importantes registradas para este centro.</h3>
                        <p>Agrega fechas desde el panel administrativo para mostrarlas aquí.</p>
                    </div>
                </article>
            `;
            renderMiniCalendar([]);
            return;
        }

        container.innerHTML = data.items.map(item => `
            <article class="date-card">
                <div class="date-box">
                    <span class="day">${escapeHtml(getDay(item.fecha))}</span>
                    <span class="month">${escapeHtml(getMonthShort(item.fecha))}</span>
                </div>
                <div class="date-info">
                    <h3>${escapeHtml(item.titulo)}</h3>
                    <p>${escapeHtml(item.descripcion || "")}</p>
                </div>
            </article>
        `).join("");

        currentCalendarYear = null;
        currentCalendarMonth = null;
        renderMiniCalendar(data.items);
    } catch (error) {
        console.error("Error cargando fechas:", error);

        container.innerHTML = `
            <article class="date-card">
                <div class="date-box">
                    <span class="day">!!</span>
                    <span class="month">ERR</span>
                </div>
                <div class="date-info">
                    <h3>No se pudieron cargar las fechas importantes.</h3>
                    <p>Revisa que el backend esté encendido y que la ruta <strong>/informatica-api/fechas?centro=${escapeHtml(center)}</strong> funcione correctamente.</p>
                </div>
            </article>
        `;

        renderMiniCalendar([]);
    }
}

function setupCenterChangeReload() {
    const cards = document.querySelectorAll("[data-center-card]");
    cards.forEach(card => {
        card.addEventListener("click", () => {
            setTimeout(() => {
                updateCenterBanner();
                loadAvisos();
                loadReglamentos();
                loadRecursosDescargables();
                loadTutoriales();
                loadFechas();
                scheduleHomeVisitTracking();
            }, 100);
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    updateCenterBanner();
    loadAvisos();
    loadReglamentos();
    loadRecursosDescargables();
    loadTutoriales();
    loadFechas();
    setupCenterChangeReload();
    scheduleHomeVisitTracking();
});