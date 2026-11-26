// =====================================================
// profile.js — pantalla "Perfil de usuario"
// profile.html -> perfil propio; profile.html?id=5 -> perfil de otro.
// APIs: GET /users/{id}, /users/{id}/posts, /groups, /servers,
// POST/DELETE /users/{id}/follow.
// =====================================================

document.addEventListener("DOMContentLoaded", async () => {
    const me = Shell.requireLogin();
    if (!me) return;
    Shell.setupNavbar(me);

    const { el, showToast } = Shell;
    const root = document.getElementById("profile-root");
    const userId = Shell.queryInt("id") || me.id;

    Shell.showState(root, "Cargando...", "Un momento por favor.");

    let profile;
    try {
        profile = await API.request(`/users/${userId}`);
    } catch (err) {
        Shell.showState(root,
            err.status === 404 ? "Usuario no encontrado" : "No se pudo cargar el perfil",
            err.status === 404 ? "Ese perfil no existe." : (err.message || "Intenta de nuevo."));
        return;
    }

    document.title = `FG Corporation — ${profile.username}`;
    root.innerHTML = "";

    // ---------- Cabecera ----------
    const head = el("div", "profile-head");
    const inner = el("div", "profile-head-inner");

    const avatar = el("div", "profile-avatar", profile.username.charAt(0).toUpperCase());
    inner.appendChild(avatar);

    const info = el("div", "profile-info");
    info.appendChild(el("h1", null, profile.username));
    if (profile.bio) info.appendChild(el("p", "bio", profile.bio));

    const stats = el("div", "profile-stats");
    const followersStat = el("span");
    const makeStat = (target, value, label) => {
        target.textContent = "";
        const b = el("b", null, value);
        target.appendChild(b);
        target.appendChild(document.createTextNode(label));
    };
    const postsStat = el("span");
    makeStat(postsStat, Shell.compact(profile.postsCount), "Publicaciones");
    let followers = profile.followersCount;
    makeStat(followersStat, Shell.compact(followers), "Seguidores");
    const followingStat = el("span");
    makeStat(followingStat, Shell.compact(profile.followingCount), "Siguiendo");
    stats.appendChild(postsStat);
    stats.appendChild(followersStat);
    stats.appendChild(followingStat);
    info.appendChild(stats);
    inner.appendChild(info);

    if (profile.id !== me.id) {
        const actions = el("div", "profile-actions");
        const follow = el("button", "btn primary", "Seguir");
        follow.type = "button";
        follow.addEventListener("click", async () => {
            follow.disabled = true;
            try {
                await API.request(`/users/${profile.id}/follow`, { method: "POST", auth: true });
                follow.textContent = "Siguiendo";
                followers += 1;
                makeStat(followersStat, Shell.compact(followers), "Seguidores");
            } catch (err) {
                if (err.status === 409) follow.textContent = "Siguiendo";
                else { showToast(err.message || "No se pudo seguir al usuario.", true); follow.disabled = false; }
            }
        });
        const msg = el("button", "btn", "Mensaje");
        msg.type = "button";
        msg.addEventListener("click", () => showToast("El chat todavia no esta disponible."));
        actions.appendChild(follow);
        actions.appendChild(msg);
        inner.appendChild(actions);
    }

    head.appendChild(inner);
    root.appendChild(head);

    // ---------- Pestanas ----------
    const tabs = el("div", "profile-tabs");
    const tabDefs = [
        { key: "posts", label: "Publicaciones" },
        { key: "groups", label: "Grupos" },
        { key: "servers", label: "Servidores" }
    ];
    const tabButtons = {};
    tabDefs.forEach(t => {
        const b = el("button", "profile-tab", t.label);
        b.type = "button";
        b.addEventListener("click", () => selectTab(t.key));
        tabButtons[t.key] = b;
        tabs.appendChild(b);
    });
    root.appendChild(tabs);

    const content = el("main", "page-main");
    root.appendChild(content);

    const cache = {};

    function postCard(p) {
        const card = el("a", "thumb-card");
        card.href = `post.html?id=${p.id}`;
        const media = el("div", "thumb-media");
        const url = p.fileUrls && p.fileUrls[0];
        if (url && p.type === "Image") {
            const img = el("img");
            img.src = safeUrl(url);
            img.alt = "";
            img.loading = "lazy";
            media.appendChild(img);
        } else {
            media.textContent = "MINIATURA";
        }
        const body = el("div", "thumb-body");
        body.appendChild(el("div", "t-title", p.title));
        body.appendChild(el("div", "t-sub",
            `${Shell.POST_TYPE_LABELS[p.type] || p.type} · ${p.likesCount} me gusta`));
        card.appendChild(media);
        card.appendChild(body);
        return card;
    }

    function infoRow(title, sub, right) {
        const row = el("div", "server-row");
        const main = el("div", "server-main");
        main.appendChild(el("div", "server-name", title));
        if (sub) main.appendChild(el("div", "server-addr", sub));
        row.appendChild(main);
        if (right) row.appendChild(el("div", "server-meta", right));
        return row;
    }

    async function render(key) {
        if (!cache[key]) {
            if (key === "posts") {
                cache[key] = await API.request(`/users/${profile.id}/posts`);
            } else if (key === "groups") {
                const all = await API.request("/groups");
                cache[key] = all.filter(g => g.createdBy && g.createdBy.id === profile.id);
            } else {
                const all = await API.request("/servers");
                cache[key] = all.filter(s => s.postedBy && s.postedBy.id === profile.id);
            }
        }
        const data = cache[key];
        content.innerHTML = "";

        if (data.length === 0) {
            const msgs = {
                posts: ["Sin publicaciones", "Este usuario todavia no ha publicado nada."],
                groups: ["Sin grupos", "Este usuario no ha creado grupos."],
                servers: ["Sin servidores", "Este usuario no ha agregado servidores."]
            };
            Shell.showState(content, msgs[key][0], msgs[key][1]);
            return;
        }

        if (key === "posts") {
            const grid = el("div", "thumb-grid");
            data.forEach(p => grid.appendChild(postCard(p)));
            content.appendChild(grid);
        } else {
            const list = el("div", "server-list");
            data.forEach(item => {
                if (key === "groups") {
                    list.appendChild(infoRow(item.name, item.description,
                        `${item.membersCount} miembros`));
                } else {
                    const addr = item.ipAddress
                        ? item.ipAddress + (item.port ? ":" + item.port : "")
                        : (item.inviteLink || "");
                    list.appendChild(infoRow(item.name, addr, `${item.votesCount} votos`));
                }
            });
            content.appendChild(list);
        }
    }

    async function selectTab(key) {
        Object.entries(tabButtons).forEach(([k, b]) => b.classList.toggle("active", k === key));
        Shell.showState(content, "Cargando...", "Un momento por favor.");
        try {
            await render(key);
        } catch (err) {
            Shell.showState(content, "No se pudo cargar", err.message || "Intenta de nuevo.");
        }
    }

    selectTab("posts");
});
