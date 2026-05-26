const AdminLayout = (() => {

    function activatePanel(panelId) {

        const panelViews = document.querySelectorAll(".admin-panel-view");

        const sidebarLinks = document.querySelectorAll(".admin-sidebar-link");

        panelViews.forEach(panel => {
            panel.classList.remove("active");
        });

        sidebarLinks.forEach(link => {
            link.classList.remove("active");
        });

        const targetPanel = document.getElementById(panelId);

        const activeButton = document.querySelector(
            `.admin-sidebar-link[data-panel-target="${panelId}"]`
        );

        if (targetPanel) {
            targetPanel.classList.add("active");
        }

        if (activeButton) {
            activeButton.classList.add("active");
        }

    }

    function initSidebar(defaultPanel = null) {

        const sidebarLinks = document.querySelectorAll(".admin-sidebar-link");

        sidebarLinks.forEach(link => {

            link.addEventListener("click", () => {

                const panelId = link.dataset.panelTarget;

                if (!panelId) return;

                activatePanel(panelId);

            });

        });

        if (defaultPanel) {
            activatePanel(defaultPanel);
        }

    }

    return {
        activatePanel,
        initSidebar
    };

})();