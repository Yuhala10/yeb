/* Tayeb: apply the saved light/dark choice before the page paints. */
(function () {
    try {
        var theme = localStorage.getItem("tayebTheme");

        if (theme === "light" || theme === "dark") {
            document.documentElement.setAttribute("data-theme", theme);
        }
    } catch (error) {
        /* Storage blocked: the phone's own setting applies. */
    }
})();
