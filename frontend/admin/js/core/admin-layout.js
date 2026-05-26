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

    function initSidebarPanels(defaultPanel = null) {

        const sidebarLinks = document.querySelectorAll(
            ".admin-sidebar-link"
        );

        sidebarLinks.forEach(link => {

            link.addEventListener("click", () => {

                const panelId =
                    link.dataset.panel ||
                    link.dataset.panelTarget;

                if (!panelId) return;

                activatePanel(panelId);

            });

        });

        if (defaultPanel) {

            activatePanel(defaultPanel);

        } else if (sidebarLinks.length > 0) {

            const firstPanel =
                sidebarLinks[0].dataset.panel
                || sidebarLinks[0].dataset.panelTarget;

            if (firstPanel) {
                activatePanel(firstPanel);
            }

        }

    }

    return {
        activatePanel,
        initSidebar,
        initSidebarPanels
    };

})();

window.AdminLayout = AdminLayout;