const AdminUpload = (() => {

    function renderCurrentFile({
        box,
        item,
        kind = "archivo",
        uploadsBase,
        escapeHtml,
        getFileTypeLabel
    }) {

        if (!box) return;

        if (!item) {
            box.innerHTML = "";
            box.classList.add("hidden");
            return;
        }

        const urlField =
            kind === "video"
                ? item.video_url
                : item.archivo_url;

        const nameField =
            kind === "video"
                ? item.video_nombre_original
                : item.archivo_nombre_original;

        const typeField =
            kind === "video"
                ? item.tipo_video
                : item.tipo_archivo;

        if (!urlField && !nameField) {
            box.innerHTML = "";
            box.classList.add("hidden");
            return;
        }

        const normalizedUrl = urlField
            ? `${uploadsBase}/${String(urlField)
                .replace(/^\/informatica-uploads/, "")
                .replace(/^\/uploads/, "")
                .replace(/^\/+/, "")}`
            : "";

        box.classList.remove("hidden");

        box.innerHTML = `
            <div class="admin-file-card">
                <strong>
                    ${kind === "video"
                        ? "Video actual:"
                        : "Archivo actual:"}
                </strong>

                <div class="admin-file-meta">
                    <span>
                        ${escapeHtml(
                            nameField
                            || (kind === "video"
                                ? "Video cargado"
                                : "Archivo cargado")
                        )}
                    </span>

                    ${typeField
                        ? `
                            <span class="admin-badge">
                                ${escapeHtml(getFileTypeLabel(typeField))}
                            </span>
                        `
                        : ""}
                </div>

                ${urlField
                    ? `
                        <a
                            href="${escapeHtml(normalizedUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Ver actual
                        </a>
                    `
                    : ""}
            </div>
        `;
    }

    function setupImagePreview({
        input,
        previewWrap,
        previewImage
    }) {

        if (!input || !previewWrap || !previewImage) return;

        input.addEventListener("change", () => {

            const file = input.files?.[0];

            if (!file) return;

            const reader = new FileReader();

            reader.onload = function (e) {

                previewImage.src = e.target.result;

                previewWrap.style.display = "block";

            };

            reader.readAsDataURL(file);

        });

    }

    function clearImagePreview({
        previewWrap,
        previewImage
    }) {

        if (previewWrap) {
            previewWrap.style.display = "none";
        }

        if (previewImage) {
            previewImage.src = "";
        }

    }

    return {
        renderCurrentFile,
        setupImagePreview,
        clearImagePreview
    };

})();