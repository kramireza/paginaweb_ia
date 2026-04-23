const CENTER_STORAGE_KEY = "ia_centro";
const VALID_CENTERS = ["vs", "cu", "danli"];

function getCurrentPathDepth() {
    const path = window.location.pathname.toLowerCase();
    return path.includes("/pages/") ? "../" : "./";
}

function getAdminLoginPath() {
    const path = window.location.pathname.toLowerCase();
    return path.includes("/pages/") ? "../admin/login.html" : "./admin/login.html";
}

function getCenterLandingPath() {
    const path = window.location.pathname.toLowerCase();
    return path.includes("/pages/") ? "../index.html" : "./index.html";
}

function normalizeCenter(value) {
    const center = String(value || "").trim().toLowerCase();
    return VALID_CENTERS.includes(center) ? center : null;
}

function getCenterFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return normalizeCenter(params.get("centro"));
}

function getCenterFromStorage() {
    return normalizeCenter(localStorage.getItem(CENTER_STORAGE_KEY));
}

function getActiveCenter() {
    return getCenterFromUrl() || getCenterFromStorage() || null;
}

function saveCenter(center) {
    const normalized = normalizeCenter(center);
    if (!normalized) return;
    localStorage.setItem(CENTER_STORAGE_KEY, normalized);
}

function updateUrlWithCenter(center, replace = true) {
    const normalized = normalizeCenter(center);
    if (!normalized) return;

    const url = new URL(window.location.href);
    url.searchParams.set("centro", normalized);

    if (replace) {
        window.history.replaceState({}, "", url.toString());
    } else {
        window.location.href = url.toString();
    }
}

function buildUrlWithCenter(href, center) {
    if (!href) return href;

    if (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("#")
    ) {
        return href;
    }

    const normalized = normalizeCenter(center);
    if (!normalized) return href;

    try {
        const url = new URL(href, window.location.href);
        url.searchParams.set("centro", normalized);
        return url.toString();
    } catch (error) {
        console.warn("No se pudo construir URL con centro:", href, error);
        return href;
    }
}

function getCenterMeta(center) {
    const map = {
        vs: {
            code: "vs",
            shortName: "UNAH-VS",
            fullName: "Universidad Nacional Autónoma de Honduras - Valle de Sula",
            city: "San Pedro Sula"
        },
        cu: {
            code: "cu",
            shortName: "Ciudad Universitaria",
            fullName: "Universidad Nacional Autónoma de Honduras - Ciudad Universitaria",
            city: "Tegucigalpa"
        },
        danli: {
            code: "danli",
            shortName: "UNAH Danlí",
            fullName: "Universidad Nacional Autónoma de Honduras - Danlí",
            city: "Danlí"
        }
    };

    return map[center] || map.vs;
}

async function loadComponent(selector, filePath) {
    const container = document.querySelector(selector);
    if (!container) {
        console.warn(`No se encontró el contenedor: ${selector}`);
        return false;
    }

    try {
        const response = await fetch(filePath);

        if (!response.ok) {
            throw new Error(`Error ${response.status} al cargar ${filePath}`);
        }

        const html = await response.text();
        container.innerHTML = html;
        return true;
    } catch (error) {
        console.error(`No se pudo cargar ${filePath}:`, error);
        return false;
    }
}

function initMobileMenu() {
    const mobileMenu = document.getElementById("mobile-menu");
    const navLinks = document.querySelector(".nav-links");

    if (!mobileMenu || !navLinks) return;

    mobileMenu.addEventListener("click", () => {
        navLinks.classList.toggle("active");
    });
}

function initCenterSelector() {
    const centerCards = document.querySelectorAll("[data-center-card]");

    centerCards.forEach(card => {
        card.addEventListener("click", () => {
            const center = normalizeCenter(card.dataset.centerCard);
            if (!center) return;

            saveCenter(center);
            const basePath = getCurrentPathDepth();
            const destination = new URL(`${basePath}pages/index.html`, window.location.href);
            destination.searchParams.set("centro", center);
            window.location.href = destination.toString();
        });
    });
}

function initFooterYear() {
    const yearSpan = document.getElementById("footer-current-year");
    if (!yearSpan) return;

    yearSpan.textContent = new Date().getFullYear();
}

function initWhatsAppModal() {
    const openBtn = document.getElementById("open-whatsapp-groups");
    const closeBtn = document.getElementById("close-whatsapp-modal");
    const modal = document.getElementById("whatsapp-modal");
    const overlay = modal ? modal.querySelector(".whatsapp-modal-overlay") : null;

    if (!openBtn || !closeBtn || !modal || !overlay) return;

    if (modal.dataset.initialized === "true") return;
    modal.dataset.initialized = "true";

    function openModal() {
        modal.classList.remove("hidden");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        modal.classList.add("hidden");
        document.body.style.overflow = "";
    }

    openBtn.addEventListener("click", openModal);
    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", closeModal);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !modal.classList.contains("hidden")) {
            closeModal();
        }
    });
}

function hideHomeLinkOnIndex() {
    const currentPage = window.location.pathname.toLowerCase();
    const isPagesIndex = currentPage.includes("/pages/index.html");

    if (!isPagesIndex) return;

    const homeItem = document.querySelector(".nav-home-item");
    if (homeItem) {
        homeItem.style.display = "none";
    }
}

function preserveCenterInLinks() {
    const activeCenter = getActiveCenter();
    if (!activeCenter) return;

    const links = document.querySelectorAll("a[data-keep-center='true']");

    links.forEach(link => {
        const originalHref = link.getAttribute("href");
        if (!originalHref) return;
        link.setAttribute("href", buildUrlWithCenter(originalHref, activeCenter));
    });
}

function applyCenterTextContent() {
    const activeCenter = getActiveCenter();
    if (!activeCenter) return;

    const meta = getCenterMeta(activeCenter);

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

function initNavbarCenterControls() {
    const activeCenter = getActiveCenter();
    const chip = document.getElementById("navbar-center-chip");
    const changeBtn = document.getElementById("navbar-change-center-btn");

    if (chip) {
        if (activeCenter) {
            chip.textContent = getCenterMeta(activeCenter).shortName;
            chip.style.display = "inline-flex";
        } else {
            chip.textContent = "Sin centro";
            chip.style.display = "inline-flex";
        }
    }

    if (changeBtn) {
        changeBtn.addEventListener("click", () => {
            window.location.href = getCenterLandingPath();
        });
    }
}

function initHiddenAdminAccess() {
    const logo = document.getElementById("navbar-logo");
    if (!logo) return;

    let clickCount = 0;
    let firstClickTime = 0;
    const requiredClicks = 6;
    const timeLimitMs = 2500;

    logo.addEventListener("click", () => {
        const now = Date.now();

        if (!firstClickTime || now - firstClickTime > timeLimitMs) {
            firstClickTime = now;
            clickCount = 0;
        }

        clickCount++;

        if (clickCount >= requiredClicks) {
            clickCount = 0;
            firstClickTime = 0;
            window.location.href = getAdminLoginPath();
        }
    });
}

function ensureCenterForProtectedPages() {
    const body = document.body;
    if (!body) return;

    const pageRequiresCenter = body.dataset.requireCenter === "true";
    if (!pageRequiresCenter) return;

    const activeCenter = getActiveCenter();
    if (!activeCenter) {
        window.location.href = getCenterLandingPath();
        return;
    }

    if (!getCenterFromUrl()) {
        updateUrlWithCenter(activeCenter, true);
    }
}

function normalizePathname(pathname) {
    return String(pathname || "")
        .toLowerCase()
        .replace(/\/+/g, "/");
}

function getCurrentPageFileName() {
    const pathname = normalizePathname(window.location.pathname);
    const parts = pathname.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "";
}

function initActiveNavLink() {
    const currentFile = getCurrentPageFileName();

    if (!currentFile || currentFile === "index.html") {
        return;
    }

    const navLinks = document.querySelectorAll(".nav-links a");

    navLinks.forEach(link => {
        link.classList.remove("active-page");
        link.removeAttribute("aria-current");

        const rawHref = link.getAttribute("href");
        if (!rawHref) return;

        if (
            rawHref.startsWith("mailto:") ||
            rawHref.startsWith("tel:") ||
            rawHref.startsWith("#")
        ) {
            return;
        }

        try {
            const parsedUrl = new URL(rawHref, window.location.href);
            const hrefPath = normalizePathname(parsedUrl.pathname);
            const hrefFile = hrefPath.split("/").filter(Boolean).pop() || "";

            if (hrefFile && hrefFile === currentFile && hrefFile !== "index.html") {
                link.classList.add("active-page");
                link.setAttribute("aria-current", "page");
            }
        } catch (error) {
            console.warn("No se pudo evaluar enlace para navbar activa:", rawHref, error);
        }
    });
}

async function loadSharedComponents() {
    const basePath = getCurrentPathDepth();

    await loadComponent("#navbar-container", `${basePath}components/navbar.html`);
    await loadComponent("#footer-container", `${basePath}components/footer.html`);
    await loadComponent("#chatbot-placeholder", `${basePath}components/chatbot.html`);

    hideHomeLinkOnIndex();
    initMobileMenu();
    initCenterSelector();
    initFooterYear();
    initWhatsAppModal();
    preserveCenterInLinks();
    applyCenterTextContent();
    initNavbarCenterControls();
    initHiddenAdminAccess();
    ensureCenterForProtectedPages();
    initActiveNavLink();

    if (typeof initChatbot === "function") {
        initChatbot();
    }
}

window.IA_CENTER = {
    normalizeCenter,
    getCenterFromUrl,
    getCenterFromStorage,
    getActiveCenter,
    saveCenter,
    updateUrlWithCenter,
    buildUrlWithCenter,
    getCenterMeta
};

window.addEventListener("DOMContentLoaded", async () => {
    const loader = document.querySelector(".loader");
    const mainContent = document.querySelector(".main-content");

    try {
        await loadSharedComponents();
    } catch (error) {
        console.error("Error general cargando componentes:", error);
    } finally {
        if (loader) {
            loader.style.display = "none";
        }

        if (mainContent) {
            mainContent.style.display = "block";
        }
    }
});