// =====================================================
// shell.js — utilidades compartidas por las pantallas
// post.html, profile.html y servers.html.
// Se carga DESPUES de api.js.
// =====================================================

const Shell = (() => {
    let toastTimer;

    // Redirige al login si no hay sesion. Devuelve el usuario actual o null.
    function requireLogin() {
        if (!API.isLoggedIn()) {
            window.location.href = "index.html";
            return null;
        }
        return API.getCurrentUser();
    }

    // Rellena nombre/avatar del navbar y activa el boton "Salir".
    function setupNavbar(user) {
        const name = document.getElementById("navbar-username");
        const avatar = document.getElementById("navbar-avatar");
        if (name) name.textContent = user.username;
        if (avatar) avatar.textContent = user.username.charAt(0).toUpperCase();

        const logout = document.getElementById("logout-btn");
        if (logout) {
            logout.addEventListener("click", () => {
                API.logout();
                window.location.href = "index.html";
            });
        }

        // Secciones del menu que todavia no tienen pantalla
        document.querySelectorAll("[data-soon]").forEach(link => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                showToast(`${link.dataset.soon} todavia no esta disponible.`);
            });
        });
    }

    function showToast(message, isError = false) {
        const toast = document.getElementById("toast");
        if (!toast) return;
        toast.textContent = message;
        toast.className = "toast show" + (isError ? " error" : "");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
    }

    // 1200 -> "1.2k"
    function compact(n) {
        n = Number(n) || 0;
        if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
        if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
        return String(n);
    }

    function queryInt(name) {
        const value = parseInt(new URLSearchParams(window.location.search).get(name), 10);
        return Number.isFinite(value) && value > 0 ? value : null;
    }

    // Crea un elemento con clase y texto (textContent => seguro contra XSS)
    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function showState(container, title, message) {
        container.innerHTML = "";
        const box = el("div", "page-state");
        box.appendChild(el("h3", null, title));
        box.appendChild(el("p", null, message));
        container.appendChild(box);
    }

    const POST_TYPE_LABELS = { Image: "Foto", Video: "Video", Mod: "Mod", Map: "Mapa", Guide: "Guia" };

    return { requireLogin, setupNavbar, showToast, compact, queryInt, el, showState, POST_TYPE_LABELS };
})();
