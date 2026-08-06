(async () => {

    if (!AdminCore.requireAuth()) {
        return;
    }

    const valid = await AdminCore.validateSession();

    if (!valid) {
        return;
    }

    document
        .getElementById("logout-btn")
        ?.addEventListener("click", () => AdminCore.logout());

    initDashboard();

})();

function initDashboard() {

    const adminUser = AdminCore.adminUser;

    const summary = document.getElementById(
        "dashboard-admin-summary"
    );

    if (summary && adminUser) {

        summary.textContent =
            `Sesión iniciada como ${adminUser.fullName || adminUser.username}. Rol: ${adminUser.role}.`;

    }

    if (
        String(adminUser?.role || "").toLowerCase() ===
        "superadmin"
    ) {

        const superadminSection = document.getElementById(
            "superadmin-section"
        );

        if (superadminSection) {
            superadminSection.style.display = "block";
        }

    }

}