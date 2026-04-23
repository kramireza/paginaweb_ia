function initChatbot() {
    const chatBubble = document.getElementById("chat-bubble");
    const chatContainer = document.getElementById("chatbot-container");
    const chatMessages = document.getElementById("chat-messages");
    const chatInputField = document.getElementById("chat-input-field");
    const chatSendBtn = document.getElementById("chat-send-btn");
    const minimizeBtn = document.getElementById("minimize-btn");
    const chatHelpMessage = document.getElementById("chat-help-message");

    if (
        !chatBubble ||
        !chatContainer ||
        !chatMessages ||
        !chatInputField ||
        !chatSendBtn ||
        !minimizeBtn
    ) {
        return;
    }

    /* Evitar doble inicialización */
    if (chatContainer.dataset.initialized === "true") {
        return;
    }
    chatContainer.dataset.initialized = "true";

    /* ===============================
       Estado inicial
    =============================== */
    chatContainer.classList.add("chat-hidden");
    chatContainer.classList.remove("chat-visible");
    chatBubble.style.display = "flex";

    if (chatHelpMessage) chatHelpMessage.style.opacity = "1";

    let chatOpen = false;

    /* ===============================
       Contexto de página
    =============================== */
    const currentPage = window.location.pathname.toLowerCase();
    let pageContext = "general";

    if (currentPage.includes("index")) pageContext = "inicio";
    else if (currentPage.includes("mapa")) pageContext = "mapa";
    else if (currentPage.includes("docente")) pageContext = "docentes";
    else if (currentPage.includes("jefatura")) pageContext = "jefatura";
    else if (currentPage.includes("contacto")) pageContext = "contacto";

    const introKey = `chat_intro_shown_${pageContext}`;

    function buildCenterAwareUrl(href) {
        if (!href) return href;

        if (
            window.IA_CENTER &&
            typeof window.IA_CENTER.getActiveCenter === "function" &&
            typeof window.IA_CENTER.buildUrlWithCenter === "function"
        ) {
            const center = window.IA_CENTER.getActiveCenter();
            if (center) {
                return window.IA_CENTER.buildUrlWithCenter(href, center);
            }
        }

        return href;
    }

    /* ===============================
       Detectar cambio de página
    =============================== */
    const lastPage = sessionStorage.getItem("chat_last_page");

    if (lastPage !== pageContext) {
        chatMessages.innerHTML = "";
        sessionStorage.setItem("chat_last_page", pageContext);
    }

    /* ===============================
       Mensaje inicial
    =============================== */
    function showInitialMessage() {
        if (sessionStorage.getItem(introKey)) return;

        appendMessage("bot", getInitialMessageByContext());
        renderQuickReplies();

        sessionStorage.setItem(introKey, "true");
    }

    /* ===============================
       Abrir chat
    =============================== */
    chatBubble.addEventListener("click", () => {
        chatOpen = true;

        chatContainer.classList.remove("chat-hidden");
        chatContainer.classList.add("chat-visible");
        chatBubble.style.display = "none";

        if (chatHelpMessage) chatHelpMessage.style.opacity = "0";

        showInitialMessage();
    });

    /* ===============================
       Minimizar chat
    =============================== */
    minimizeBtn.addEventListener("click", () => {
        chatOpen = false;

        chatContainer.classList.remove("chat-visible");
        chatContainer.classList.add("chat-hidden");
        chatBubble.style.display = "flex";

        if (chatHelpMessage) chatHelpMessage.style.opacity = "1";
    });

    /* ===============================
       Parpadeo controlado
    =============================== */
    setInterval(() => {
        if (!chatOpen && chatHelpMessage) {
            chatHelpMessage.classList.toggle("help-blink");
        }
    }, 1200);

    /* ===============================
       Envío de mensajes
    =============================== */
    chatSendBtn.addEventListener("click", sendMessage);
    chatInputField.addEventListener("keydown", e => {
        if (e.key === "Enter") sendMessage();
    });

    function sendMessage(textOverride = null) {
        const text = textOverride ?? chatInputField.value.trim();
        if (!text) return;

        appendMessage("user", text);
        chatInputField.value = "";

        removeQuickReplies();

        setTimeout(() => {
            appendMessage("bot", getMockResponse(text));
        }, 500);
    }

    /* ===============================
       QUICK REPLIES
    =============================== */
    function renderQuickReplies() {
        removeQuickReplies();

        const container = document.createElement("div");
        container.classList.add("quick-replies");

        const buttons = [
            "📚 Plan de estudios",
            "🗺️ Pensum de clases",
            "🏫 Modalidades",
            "📝 Requisitos",
            "👨‍🏫 Docentes",
            "📍 Contacto"
        ];

        buttons.forEach(label => {
            const btn = document.createElement("button");
            btn.textContent = label;
            btn.classList.add("quick-btn");
            btn.onclick = () => sendMessage(label);
            container.appendChild(btn);
        });

        chatMessages.appendChild(container);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function removeQuickReplies() {
        const el = chatMessages.querySelector(".quick-replies");
        if (el) el.remove();
    }

    /* ===============================
       MOCK INTELIGENTE
    =============================== */
    function getMockResponse(input) {
        const t = input.toLowerCase();

        if (t.includes("plan")) {
            return `📚 Revisa el plan de estudios 👉 <a href="${buildCenterAwareUrl("mapa-clases.html")}">Ver plan</a>`;
        }

        if (t.includes("mapa") || t.includes("pensum")) {
            return `🗺️ Mapa de clases 👉 <a href="${buildCenterAwareUrl("mapa-clases.html")}">Abrir mapa</a>`;
        }

        if (t.includes("modalidad")) {
            return `🏫 Modalidades 👉 <a href="${buildCenterAwareUrl("index.html#modalidades")}">Ver modalidades</a>`;
        }

        if (t.includes("requisito")) {
            return `📝 Puedes revisar el pensum y la planificación académica para conocer requisitos y orden de asignaturas 👉 <a href="${buildCenterAwareUrl("mapa-clases.html")}">Ver información</a>`;
        }

        if (t.includes("docente")) {
            return `👨‍🏫 Docentes 👉 <a href="${buildCenterAwareUrl("docentes.html")}">Ver docentes</a>`;
        }

        if (t.includes("contacto")) {
            return `📍 Contacto 👉 <a href="${buildCenterAwareUrl("contacto.html")}">Ir a contacto</a>`;
        }

        return "🤔 Puedo ayudarte a navegar la carrera.";
    }

    function appendMessage(type, text) {
        const div = document.createElement("div");
        div.classList.add("chat-message", type === "user" ? "chat-user" : "chat-bot");
        div.innerHTML = `<span>${text}</span>`;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function getInitialMessageByContext() {
        switch (pageContext) {
            case "inicio":
                return "👋 Bienvenido a Informática Administrativa.";
            case "mapa":
                return "🗺️ Estás viendo el mapa de clases.";
            case "docentes":
                return "👨‍🏫 Información sobre docentes.";
            case "jefatura":
                return "📌 Jefatura y coordinación académica.";
            case "contacto":
                return "📍 Canales de contacto de la carrera.";
            default:
                return "🤖 ¿En qué puedo ayudarte?";
        }
    }
}

/* Compatibilidad con páginas donde el HTML ya existe desde el inicio */
document.addEventListener("DOMContentLoaded", () => {
    initChatbot();
});