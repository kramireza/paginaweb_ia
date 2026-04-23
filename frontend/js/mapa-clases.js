document.addEventListener('DOMContentLoaded', () => {

    const API_BASE = "http://localhost:4000/api";
    let lastTrackedCenter = null;
    let metricsTrackTimeout = null;

    const tooltip = document.getElementById('tooltip');
    const tooltipRequisito = document.getElementById('tooltip-requisito');
    const tooltipAbre = document.getElementById('tooltip-abre');
    const filas = document.querySelectorAll('.plan-estudios tbody tr');

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

    function scheduleMapaClasesVisitTracking() {
        if (metricsTrackTimeout) {
            clearTimeout(metricsTrackTimeout);
        }

        metricsTrackTimeout = setTimeout(() => {
            const center = getCentroActivo();

            if (!center) return;
            if (center === lastTrackedCenter) return;

            lastTrackedCenter = center;
            trackPageVisit("mapa_clases", center);
        }, 250);
    }

    /* ===============================
       🛑 Validaciones de seguridad
    =============================== */
    if (!tooltip || !tooltipRequisito || !tooltipAbre || filas.length === 0) {
        scheduleMapaClasesVisitTracking();
        return;
    }

    /* ===============================
       Tooltip
    =============================== */
    filas.forEach(row => {

        row.addEventListener('mouseenter', e => {
            const requisito = row.dataset.requisito || 'Sin requisito';
            const abre = row.dataset.abre || 'No abre ninguna clase';

            tooltipRequisito.textContent = requisito;
            tooltipAbre.textContent = abre;

            tooltip.style.display = 'block';
        });

        row.addEventListener('mousemove', e => {
            const offset = 15;
            const tooltipWidth = tooltip.offsetWidth;
            const tooltipHeight = tooltip.offsetHeight;

            let top = e.pageY + offset;
            let left = e.pageX + offset;

            // Evitar que el tooltip se salga de la pantalla
            if (left + tooltipWidth > window.innerWidth) {
                left = e.pageX - tooltipWidth - offset;
            }

            if (top + tooltipHeight > window.innerHeight) {
                top = e.pageY - tooltipHeight - offset;
            }

            tooltip.style.top = `${top}px`;
            tooltip.style.left = `${left}px`;
        });

        row.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });

    });

    /* ===============================
       Resaltar dependencias
    =============================== */
    const limpiarResaltado = () => {
        document.querySelectorAll('.requisito-dependiente')
            .forEach(el => el.classList.remove('requisito-dependiente'));
    };

    const resaltarRequisitos = (codigoClase) => {
        limpiarResaltado();

        filas.forEach(fila => {
            const requisitos = fila.dataset.requisito || '';
            const lista = requisitos.split(',').map(r => r.trim());

            if (lista.includes(codigoClase)) {
                fila.classList.add('requisito-dependiente');
            }
        });
    };

    filas.forEach(row => {
        row.addEventListener('click', () => {
            const clase = row.dataset.clase;
            if (clase) {
                resaltarRequisitos(clase);
            }
        });
    });

    scheduleMapaClasesVisitTracking();

});