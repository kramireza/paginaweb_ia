const API = `${window.location.origin}/informatica-api`.replace(/\/+$/, "");
const FILES_BASE = `${window.location.origin}/informatica-uploads`.replace(/\/+$/, "");

let lastTrackedCenter = null;
let metricsTrackTimeout = null;

function getCentro() {
    if (window.IA_CENTER && typeof window.IA_CENTER.getActiveCenter === "function") {
        return window.IA_CENTER.getActiveCenter() || "vs";
    }

    const params = new URLSearchParams(window.location.search);
    return params.get("centro") || "vs";
}

async function fetchData(url) {
    const res = await fetch(url);
    return await res.json();
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatFecha(fecha) {
    if (!fecha) return "";
    const date = new Date(`${fecha}T00:00:00`);
    if (isNaN(date.getTime())) return fecha;

    return date.toLocaleDateString("es-HN", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

function getCenterLabel(centro) {
    const map = {
        vs: "UNAH-VS",
        cu: "Ciudad Universitaria",
        danli: "UNAH Danlí"
    };
    return map[centro] || centro?.toUpperCase() || "Centro";
}

function renderCards(id, items, builder) {
    const container = document.getElementById(id);

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="m-empty">
                <p>No hay información disponible en este apartado para el centro seleccionado.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(builder).join("");
}

function renderCenterName(centro) {
    const nameEl = document.getElementById("maestria-center-name");
    if (nameEl) {
        nameEl.textContent = getCenterLabel(centro);
    }
}

function getFileUrl(path) {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://")) return path;

    const normalized = String(path)
        .replace(/^\/informatica-uploads/, "")
        .replace(/^\/uploads/, "")
        .replace(/^\/+/, "");

    return `${FILES_BASE}/${normalized}`;
}

function normalizeYouTubeUrl(url) {
    if (!url) return null;

    try {
        const parsed = new URL(url);

        if (parsed.hostname.includes("youtube.com")) {
            const videoId = parsed.searchParams.get("v");
            if (videoId) {
                return `https://www.youtube.com/embed/${videoId}`;
            }
        }

        if (parsed.hostname.includes("youtu.be")) {
            const videoId = parsed.pathname.replace("/", "").trim();
            if (videoId) {
                return `https://www.youtube.com/embed/${videoId}`;
            }
        }

        return null;
    } catch {
        return null;
    }
}

async function trackPageVisit(pageKey, center) {
    try {
        await fetch(`${API}/metrics/visit`, {
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

function scheduleMaestriaVisitTracking() {
    if (metricsTrackTimeout) {
        clearTimeout(metricsTrackTimeout);
    }

    metricsTrackTimeout = setTimeout(() => {
        const center = getCentro();

        if (!center) return;
        if (center === lastTrackedCenter) return;

        lastTrackedCenter = center;
        trackPageVisit("maestria", center);
    }, 250);
}

function renderTutorialPlayer(item) {
    const player = document.getElementById("maestria-tutorial-player");
    if (!player) return;

    if (!item) {
        player.innerHTML = `
            <div class="m-empty">
                <p>No hay tutoriales disponibles para reproducir.</p>
            </div>
        `;
        return;
    }

    const youtubeEmbed = normalizeYouTubeUrl(item.enlace_video);

    if (youtubeEmbed) {
        player.innerHTML = `
            <iframe
                src="${escapeHtml(youtubeEmbed)}"
                title="${escapeHtml(item.titulo)}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen>
            </iframe>
            <h3>${escapeHtml(item.titulo)}</h3>
            ${item.descripcion ? `<p>${escapeHtml(item.descripcion)}</p>` : ""}
        `;
        return;
    }

    if (item.video_url) {
        player.innerHTML = `
            <video controls preload="metadata">
                <source src="${getFileUrl(item.video_url)}">
                Tu navegador no soporta la reproducción de video.
            </video>
            <h3>${escapeHtml(item.titulo)}</h3>
            ${item.descripcion ? `<p>${escapeHtml(item.descripcion)}</p>` : ""}
        `;
        return;
    }

    if (item.enlace_video) {
        player.innerHTML = `
            <div class="m-card">
                <h3>${escapeHtml(item.titulo)}</h3>
                ${item.descripcion ? `<p>${escapeHtml(item.descripcion)}</p>` : ""}
                <div class="m-actions">
                    <a class="m-btn m-btn-primary" href="${escapeHtml(item.enlace_video)}" target="_blank" rel="noopener noreferrer">
                        Abrir tutorial
                    </a>
                </div>
            </div>
        `;
        return;
    }

    player.innerHTML = `
        <div class="m-empty">
            <p>No hay contenido reproducible disponible para este tutorial.</p>
        </div>
    `;
}

function renderTutorialList(items) {
    const container = document.getElementById("maestria-tutoriales");

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="m-empty">
                <p>No hay tutoriales disponibles en este momento.</p>
            </div>
        `;
        renderTutorialPlayer(null);
        return;
    }

    container.innerHTML = items.map((item, index) => `
        <article class="m-tutorial-item ${index === 0 ? "active" : ""}" data-tutorial-index="${index}">
            <div class="m-badge-row">
                <span class="m-badge">Tutorial</span>
                ${item.tipo_video ? `<span class="m-badge">${escapeHtml(String(item.tipo_video).toUpperCase())}</span>` : ""}
            </div>
            <h4>${escapeHtml(item.titulo)}</h4>
            <p>${escapeHtml(item.descripcion || "Material audiovisual de apoyo.")}</p>
        </article>
    `).join("");

    renderTutorialPlayer(items[0]);

    container.querySelectorAll(".m-tutorial-item").forEach(card => {
        card.addEventListener("click", () => {
            const index = Number(card.dataset.tutorialIndex || 0);
            container.querySelectorAll(".m-tutorial-item").forEach(i => i.classList.remove("active"));
            card.classList.add("active");
            renderTutorialPlayer(items[index]);
        });
    });
}

async function loadMaestria() {
    const centro = getCentro();
    renderCenterName(centro);

    try {
        const [
            info,
            avisos,
            fechas,
            encargados,
            reglamentos,
            recursos,
            tutoriales
        ] = await Promise.all([
            fetchData(`${API}/maestria/info?centro=${centro}`),
            fetchData(`${API}/maestria/avisos?centro=${centro}`),
            fetchData(`${API}/maestria/fechas?centro=${centro}`),
            fetchData(`${API}/maestria/encargados?centro=${centro}`),
            fetchData(`${API}/maestria/reglamentos?centro=${centro}`),
            fetchData(`${API}/maestria/recursos?centro=${centro}`),
            fetchData(`${API}/maestria/tutoriales?centro=${centro}`)
        ]);

        if (info.ok && info.item) {
            document.getElementById("maestria-info").innerHTML = `
                <h1>${escapeHtml(info.item.titulo)}</h1>
                <p>${escapeHtml(info.item.descripcion).replace(/\n/g, "<br>")}</p>
            `;

            const finalBox = document.getElementById("maestria-final-box");
            if (finalBox) {
                finalBox.innerHTML = `
                    <h2>${escapeHtml(info.item.mensaje_final_titulo || "Formación avanzada para fortalecer el desarrollo profesional")}</h2>
                    <p>${escapeHtml(info.item.mensaje_final_descripcion || "La maestría está orientada a potenciar competencias estratégicas, analíticas y tecnológicas para responder a las necesidades actuales del entorno académico y profesional.").replace(/\n/g, "<br>")}</p>
                `;
            }
        }

        const avisosItems = Array.isArray(avisos.items) ? avisos.items : [];
        const destacadoContainer = document.getElementById("maestria-aviso-destacado");

        if (avisosItems.length > 0) {
            const principal = avisosItems.find(item => item.destacado) || avisosItems[0];
            const secundarios = avisosItems.filter(item => item.id !== principal.id);

            destacadoContainer.innerHTML = `
                <div class="maestria-aviso-destacado">
                    <div class="m-card m-highlight">
                        <div class="m-badge-row">
                            <span class="m-badge">${escapeHtml(principal.categoria || "Aviso principal")}</span>
                            ${principal.fecha_publicacion ? `<span class="m-badge">${escapeHtml(formatFecha(principal.fecha_publicacion))}</span>` : ""}
                        </div>
                        <h3>${escapeHtml(principal.titulo)}</h3>
                        <p>${escapeHtml(principal.resumen || "")}</p>
                        ${principal.contenido ? `<p>${escapeHtml(principal.contenido)}</p>` : ""}
                        ${principal.enlace ? `
                            <div class="m-actions">
                                <a class="m-btn m-btn-primary" href="${escapeHtml(principal.enlace)}" target="_blank" rel="noopener noreferrer">
                                    Ver más
                                </a>
                            </div>
                        ` : ""}
                    </div>
                </div>
            `;

            renderCards("maestria-avisos", secundarios, item => `
                <div class="m-card">
                    <div class="m-badge-row">
                        <span class="m-badge">${escapeHtml(item.categoria || "Aviso")}</span>
                        ${item.fecha_publicacion ? `<span class="m-badge">${escapeHtml(formatFecha(item.fecha_publicacion))}</span>` : ""}
                    </div>
                    <h3>${escapeHtml(item.titulo)}</h3>
                    <p>${escapeHtml(item.resumen || "")}</p>
                    ${item.enlace ? `
                        <div class="m-actions">
                            <a class="m-btn m-btn-secondary" href="${escapeHtml(item.enlace)}" target="_blank" rel="noopener noreferrer">
                                Consultar
                            </a>
                        </div>
                    ` : ""}
                </div>
            `);
        } else {
            destacadoContainer.innerHTML = "";
            renderCards("maestria-avisos", [], () => "");
        }

        renderCards("maestria-fechas", fechas.items, item => `
            <div class="m-card">
                <div class="m-badge-row">
                    <span class="m-badge">Fecha importante</span>
                    <span class="m-date">${escapeHtml(formatFecha(item.fecha))}</span>
                </div>
                <h3>${escapeHtml(item.titulo)}</h3>
                <p>${escapeHtml(item.descripcion || "")}</p>
            </div>
        `);

        renderCards("maestria-encargados", encargados.items, item => `
            <div class="m-card m-person-card">
                <img src="${item.foto_url ? getFileUrl(item.foto_url) : "../assets/images/docente1.jpg"}" alt="${escapeHtml(item.nombre)}">
                <div class="m-person-info">
                    <h3>${escapeHtml(item.nombre)}</h3>
                    ${item.cargo ? `<p><strong>Cargo:</strong> ${escapeHtml(item.cargo)}</p>` : ""}
                    ${item.descripcion ? `<p>${escapeHtml(item.descripcion)}</p>` : ""}
                    ${item.correo ? `<p><strong>Correo:</strong> ${escapeHtml(item.correo)}</p>` : ""}
                    ${item.telefono ? `<p><strong>Teléfono:</strong> ${escapeHtml(item.telefono)}</p>` : ""}
                </div>
            </div>
        `);

        renderCards("maestria-reglamentos", reglamentos.items, item => `
            <div class="m-card">
                <div class="m-badge-row">
                    <span class="m-badge">Reglamento</span>
                </div>
                <h3>${escapeHtml(item.titulo)}</h3>
                <p>${escapeHtml(item.fragmento || "")}</p>
                ${item.enlace ? `
                    <div class="m-actions">
                        <a class="m-btn m-btn-secondary" href="${escapeHtml(item.enlace)}" target="_blank" rel="noopener noreferrer">
                            Consultar más
                        </a>
                    </div>
                ` : ""}
            </div>
        `);

        renderCards("maestria-recursos", recursos.items, item => `
            <div class="m-card">
                <div class="m-badge-row">
                    <span class="m-badge">Recurso</span>
                    ${item.tipo_archivo ? `<span class="m-badge m-file-type">${escapeHtml(String(item.tipo_archivo).toUpperCase())}</span>` : ""}
                </div>
                <h3>${escapeHtml(item.titulo)}</h3>
                ${item.descripcion ? `<p>${escapeHtml(item.descripcion)}</p>` : ""}
                <div class="m-actions">
                    ${item.archivo_url ? `
                        <a class="m-btn m-btn-primary" href="${getFileUrl(item.archivo_url)}" target="_blank" rel="noopener noreferrer">
                            Descargar
                        </a>
                    ` : ""}
                    ${item.enlace_externo ? `
                        <a class="m-btn m-btn-secondary" href="${escapeHtml(item.enlace_externo)}" target="_blank" rel="noopener noreferrer">
                            Abrir enlace
                        </a>
                    ` : ""}
                </div>
            </div>
        `);

        renderTutorialList(Array.isArray(tutoriales.items) ? tutoriales.items : []);

    } catch (error) {
        console.error("Error cargando Maestría:", error);

        document.getElementById("maestria-info").innerHTML = `
            <h1>Maestría</h1>
            <p>No se pudo cargar la información en este momento. Verifica que el backend esté encendido y que las rutas de Maestría estén funcionando correctamente.</p>
        `;

        const sections = [
            "maestria-aviso-destacado",
            "maestria-avisos",
            "maestria-fechas",
            "maestria-encargados",
            "maestria-reglamentos",
            "maestria-recursos",
            "maestria-tutoriales"
        ];

        sections.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = `
                    <div class="m-empty">
                        <p>No se pudo cargar esta sección en este momento.</p>
                    </div>
                `;
            }
        });

        renderTutorialPlayer(null);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadMaestria();
    scheduleMaestriaVisitTracking();
});