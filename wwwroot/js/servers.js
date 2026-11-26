// =====================================================
// servers.js — pantalla "Servidores"
// APIs: GET /servers, POST /servers, POST /servers/{id}/vote
// =====================================================

document.addEventListener("DOMContentLoaded", async () => {
    const me = Shell.requireLogin();
    if (!me) return;
    Shell.setupNavbar(me);

    const { el, showToast } = Shell;
    const listEl = document.getElementById("server-list");
    const filtersEl = document.getElementById("server-filters");

    let servers = [];
    let currentFilter = "Todos";
    const voted = new Set();

    // ---------- Filtros por tipo (se aplican en el cliente) ----------
    const BASE_FILTERS = ["Todos", "Minecraft", "CS2", "Discord", "TeamSpeak"];

    function renderFilters() {
        // Ademas de los tipos fijos, muestra cualquier otro tipo que exista en los datos
        const extra = [...new Set(servers.map(s => s.type).filter(t => t && !BASE_FILTERS.includes(t)))];
        filtersEl.innerHTML = "";
        [...BASE_FILTERS, ...extra].forEach(name => {
            const chip = el("button", "chip" + (name === currentFilter ? " active" : ""), name);
            chip.type = "button";
            chip.addEventListener("click", () => {
                currentFilter = name;
                renderFilters();
                renderList();
            });
            filtersEl.appendChild(chip);
        });
    }

    // ---------- Lista ----------
    function addressOf(s) {
        if (s.ipAddress) return s.ipAddress + (s.port ? ":" + s.port : "");
        return s.inviteLink || "";
    }

    function metaOf(s) {
        if (!s.isOnline) return "Sin conexion";
        return s.maxPlayers ? `max. ${s.maxPlayers.toLocaleString("es")}` : "";
    }

    function buildRow(s) {
        const row = el("div", "server-row");
        row.appendChild(el("span", "status-dot" + (s.isOnline ? " online" : "")));

        const main = el("div", "server-main");
        const name = el("div", "server-name");
        name.appendChild(el("span", "s-title", s.name));
        name.appendChild(el("span", "pill", s.type));
        main.appendChild(name);
        main.appendChild(el("div", "server-addr", addressOf(s)));
        row.appendChild(main);

        const meta = el("div", "server-meta");
        const info = metaOf(s);
        if (info) meta.appendChild(el("span", null, info));
        const votes = el("b", null, `${s.votesCount.toLocaleString("es")} votos`);
        meta.appendChild(votes);

        const btn = el("button", "btn", "Votar");
        btn.type = "button";
        if (voted.has(s.id)) { btn.textContent = "Votado"; btn.disabled = true; }
        btn.addEventListener("click", async () => {
            btn.disabled = true;
            try {
                await API.request(`/servers/${s.id}/vote`, { method: "POST", auth: true });
                s.votesCount += 1;
                voted.add(s.id);
                votes.textContent = `${s.votesCount.toLocaleString("es")} votos`;
                btn.textContent = "Votado";
            } catch (err) {
                if (err.status === 409) { voted.add(s.id); btn.textContent = "Votado"; }
                else { showToast(err.message || "No se pudo registrar el voto.", true); btn.disabled = false; }
            }
        });
        meta.appendChild(btn);
        row.appendChild(meta);
        return row;
    }

    function renderList() {
        listEl.innerHTML = "";
        const visible = currentFilter === "Todos" ? servers : servers.filter(s => s.type === currentFilter);
        if (visible.length === 0) {
            Shell.showState(listEl, "Sin servidores", "Todavia no hay servidores de este tipo.");
            return;
        }
        visible.forEach(s => listEl.appendChild(buildRow(s)));
    }

    async function load() {
        Shell.showState(listEl, "Cargando...", "Un momento por favor.");
        try {
            servers = await API.request("/servers");
            renderFilters();
            renderList();
        } catch (err) {
            renderFilters();
            Shell.showState(listEl, "No se pudieron cargar los servidores", err.message || "Intenta de nuevo.");
        }
    }

    // ---------- Modal: agregar servidor ----------
    const modal = document.getElementById("server-modal");
    const form = document.getElementById("server-form");
    const alertEl = document.getElementById("server-alert");
    const submit = document.getElementById("server-submit");

    function openModal() {
        alertEl.className = "alert";
        alertEl.textContent = "";
        modal.classList.add("open");
        document.getElementById("srv-name").focus();
    }
    function closeModal() {
        modal.classList.remove("open");
        form.reset();
    }

    document.getElementById("add-server-btn").addEventListener("click", openModal);
    document.getElementById("server-cancel").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

    function showError(message) {
        alertEl.textContent = message; // textContent: seguro
        alertEl.className = "alert error";
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("srv-name").value.trim();
        const type = document.getElementById("srv-type").value;
        const ip = document.getElementById("srv-ip").value.trim();
        const portRaw = document.getElementById("srv-port").value;
        const invite = document.getElementById("srv-invite").value.trim();
        const maxRaw = document.getElementById("srv-max").value;

        // Validaciones de UX (la API no valida longitudes por su cuenta)
        if (!name) return showError("Escribe el nombre del servidor.");
        if (name.length > 100) return showError("El nombre no puede pasar de 100 caracteres.");
        if (!ip && !invite) return showError("Indica una direccion IP o un enlace de invitacion.");

        const port = portRaw ? parseInt(portRaw, 10) : null;
        if (port !== null && (port < 1 || port > 65535)) return showError("El puerto debe estar entre 1 y 65535.");
        const maxPlayers = maxRaw ? parseInt(maxRaw, 10) : null;
        if (maxPlayers !== null && maxPlayers < 1) return showError("El maximo de jugadores debe ser mayor que 0.");

        submit.disabled = true;
        try {
            const created = await API.request("/servers", {
                method: "POST",
                auth: true,
                body: {
                    name, type,
                    ipAddress: ip || null,
                    port,
                    inviteLink: invite || null,
                    maxPlayers
                }
            });
            servers.push(created);
            closeModal();
            renderFilters();
            renderList();
            showToast("Servidor agregado.");
        } catch (err) {
            showError(err.message || "No se pudo agregar el servidor.");
        } finally {
            submit.disabled = false;
        }
    });

    load();
});
