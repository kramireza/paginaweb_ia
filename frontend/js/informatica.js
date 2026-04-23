document.addEventListener('DOMContentLoaded', () => {

    const centerSelect = document.getElementById('center-select');
    const centerContent = document.getElementById('center-content');

    // 🛑 Seguridad: si no existe el select, no hacemos nada
    if (!centerSelect || !centerContent) return;

    // Ocultar contenido al cargar
    centerContent.classList.add('hidden');

    centerSelect.addEventListener('change', () => {
        const selectedCenter = centerSelect.value;

        if (!selectedCenter) {
            centerContent.classList.add('hidden');
            return;
        }

        // Mostrar contenedor
        centerContent.classList.remove('hidden');

        // 🔧 Lógica por centro (lista para crecer)
        switch (selectedCenter) {
            case 'unah-vs':
                // lógica UNAH-VS
                break;

            case 'unah-teg':
                // lógica UNAH-Tegucigalpa
                break;

            case 'unah-curc':
                // lógica UNAH-CURC
                break;

            default:
                console.warn('Centro no reconocido:', selectedCenter);
        }
    });

});
