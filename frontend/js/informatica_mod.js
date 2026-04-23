document.addEventListener('DOMContentLoaded', () => {

    let currentIndex = 0;
    let autoSlideInterval = null;

    const bannerContainer = document.querySelector('.banner-container');
    const slides = document.querySelectorAll('.banner-slide');
    const totalSlides = slides.length;

    /* ===============================
       🛑 Validaciones de seguridad
    =============================== */
    if (!bannerContainer || totalSlides === 0) return;

    /* ===============================
       Función para actualizar banner
    =============================== */
    const updateBanner = () => {
        const offset = currentIndex * bannerContainer.offsetWidth;
        bannerContainer.scrollTo({
            left: offset,
            behavior: 'smooth'
        });
    };

    /* ===============================
       Auto slide
    =============================== */
    const autoSlide = () => {
        currentIndex = (currentIndex + 1) % totalSlides;
        updateBanner();
    };

    const startAutoSlide = () => {
        if (autoSlideInterval) return; // evita duplicados
        autoSlideInterval = setInterval(autoSlide, 3000);
    };

    const stopAutoSlide = () => {
        clearInterval(autoSlideInterval);
        autoSlideInterval = null;
    };

    /* ===============================
       Inicialización
    =============================== */
    startAutoSlide();

    bannerContainer.addEventListener('mouseenter', stopAutoSlide);
    bannerContainer.addEventListener('mouseleave', startAutoSlide);

    window.addEventListener('resize', updateBanner);

    /* ===============================
       Menú móvil
    =============================== */
    const mobileMenu = document.getElementById('mobile-menu');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenu && navLinks) {
        mobileMenu.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

});
