// =====================================================
// post.js — pantalla "Detalle de publicacion"
// Usa solo APIs existentes: GET /posts/{id}, /users/{id},
// /posts/{id}/comments, POST comments, download, rating, follow.
// =====================================================

document.addEventListener("DOMContentLoaded", async () => {
    const me = Shell.requireLogin();
    if (!me) return;
    Shell.setupNavbar(me);

    const { el, showToast } = Shell;
    const root = document.getElementById("post-root");
    const postId = Shell.queryInt("id");

    if (!postId) {
        Shell.showState(root, "Publicacion no encontrada", "Falta el identificador de la publicacion.");
        return;
    }

    Shell.showState(root, "Cargando...", "Un momento por favor.");

    let post, author, comments;
    try {
        post = await API.request(`/posts/${postId}`);
        [author, comments] = await Promise.all([
            API.request(`/users/${post.user.id}`).catch(() => null),
            API.request(`/posts/${postId}/comments`).catch(() => [])
        ]);
    } catch (err) {
        Shell.showState(root,
            err.status === 404 ? "Publicacion no encontrada" : "No se pudo cargar la publicacion",
            err.status === 404 ? "Puede que haya sido eliminada." : (err.message || "Intenta de nuevo."));
        return;
    }

    document.title = `FG Corporation — ${post.title}`;
    root.innerHTML = "";

    const files = post.fileUrls || [];
    const grid = el("div", "detail-grid");
    const left = el("div");
    const side = el("aside");
    grid.appendChild(left);
    grid.appendChild(side);
    root.appendChild(grid);

    // ---------- Media ----------
    const media = el("div", "detail-media");
    const first = files[0];
    if (first && post.type === "Image") {
        const img = el("img");
        img.src = safeUrl(first);
        img.alt = "";
        media.appendChild(img);
    } else if (first && post.type === "Video") {
        const video = el("video");
        video.src = safeUrl(first);
        video.controls = true;
        video.playsInline = true;
        media.appendChild(video);
    } else {
        media.textContent = "IMAGEN / VIDEO / MOD";
    }
    left.appendChild(media);

    // ---------- Titulo, pills y descripcion ----------
    left.appendChild(el("h1", "detail-title", post.title));

    const pills = el("div", "pill-row");
    pills.appendChild(el("span", "pill accent", Shell.POST_TYPE_LABELS[post.type] || post.type));
    if (post.gameName) pills.appendChild(el("span", "pill", post.gameName));
    (post.tags || []).forEach(t => pills.appendChild(el("span", "pill", "#" + t)));
    left.appendChild(pills);

    if (post.description) left.appendChild(el("p", "detail-desc", post.description));

    // ---------- Archivos / versiones ----------
    // Todos los archivos pasan por POST /download para registrar la descarga.
    async function download(url, btn) {
        btn.disabled = true;
        try {
            await API.request(`/posts/${postId}/download`, { method: "POST", auth: true });
            window.open(safeUrl(url), "_blank");
            if (typeof post.downloadsCount === "number") {
                post.downloadsCount += 1;
                if (downloadsMeta) downloadsMeta.textContent = metaText();
            }
        } catch (err) {
            showToast(err.message || "No se pudo iniciar la descarga.", true);
        } finally {
            btn.disabled = false;
        }
    }

    function fileName(url) {
        try { return decodeURIComponent(String(url).split("/").pop().split("?")[0]); }
        catch { return String(url).split("/").pop(); }
    }

    function fileExt(url) {
        const name = fileName(url);
        const i = name.lastIndexOf(".");
        return i >= 0 ? name.slice(i + 1).toLowerCase() : "archivo";
    }

    left.appendChild(el("h2", "section-title", "Versiones"));
    const versions = el("div", "version-list");
    if (files.length === 0) {
        versions.appendChild(el("p", "muted", "Esta publicacion no tiene archivos adjuntos."));
    } else {
        files.forEach(url => {
            const row = el("div", "version-row");
            row.appendChild(el("span", "version-tag", "." + fileExt(url)));
            const info = el("div", "version-info");
            info.appendChild(el("div", "vi-title", fileName(url)));
            info.appendChild(el("div", "vi-sub", new Date(post.createdAt).toLocaleDateString("es")));
            row.appendChild(info);
            const btn = el("button", "btn", "Descargar");
            btn.type = "button";
            btn.addEventListener("click", () => download(url, btn));
            row.appendChild(btn);
            versions.appendChild(row);
        });
    }
    left.appendChild(versions);

    // ---------- Comentarios ----------
    const commentsTitle = el("h2", "section-title");
    left.appendChild(commentsTitle);
    let commentsCount = comments.length;
    const updateCommentsTitle = () => { commentsTitle.textContent = `Comentarios (${commentsCount})`; };
    updateCommentsTitle();

    const form = el("form", "comment-form");
    const input = el("input");
    input.type = "text";
    input.placeholder = "Escribe un comentario...";
    input.maxLength = 500;
    const send = el("button", "btn primary", "Enviar");
    send.type = "submit";
    form.appendChild(input);
    form.appendChild(send);
    left.appendChild(form);

    const list = el("div");
    left.appendChild(list);

    function commentNode(c) {
        const item = el("div", "comment-item");
        item.appendChild(el("div", "avatar-badge", c.user.username.charAt(0).toUpperCase()));
        const body = el("div");
        body.appendChild(el("div", "c-user", c.user.username));
        body.appendChild(el("div", "c-text", c.content));
        item.appendChild(body);
        return item;
    }

    comments.forEach(c => list.appendChild(commentNode(c)));

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const content = input.value.trim();
        if (!content) return;
        send.disabled = true;
        try {
            const created = await API.request(`/posts/${postId}/comments`, {
                method: "POST", auth: true, body: { content }
            });
            list.insertBefore(commentNode(created), list.firstChild);
            commentsCount += 1;
            updateCommentsTitle();
            input.value = "";
        } catch (err) {
            showToast(err.message || "No se pudo publicar el comentario.", true);
        } finally {
            send.disabled = false;
        }
    });

    // ---------- Barra lateral: autor ----------
    const authorCard = el("div", "side-card");
    const top = el("div", "author-top");
    top.appendChild(el("div", "avatar-badge", post.user.username.charAt(0).toUpperCase()));
    const topText = el("div");
    const aName = el("a", "a-name", post.user.username);
    aName.href = `profile.html?id=${post.user.id}`;
    topText.appendChild(aName);
    topText.appendChild(el("div", "a-sub", `${Shell.compact(author ? author.followersCount : 0)} seguidores`));
    top.appendChild(topText);
    authorCard.appendChild(top);

    if (author && author.bio) authorCard.appendChild(el("p", "author-bio", author.bio));

    if (post.user.id !== me.id) {
        const follow = el("button", "btn block", "Seguir");
        follow.type = "button";
        follow.addEventListener("click", async () => {
            follow.disabled = true;
            try {
                await API.request(`/users/${post.user.id}/follow`, { method: "POST", auth: true });
                follow.textContent = "Siguiendo";
                showToast(`Ahora sigues a ${post.user.username}.`);
            } catch (err) {
                if (err.status === 409) follow.textContent = "Siguiendo";
                else { showToast(err.message || "No se pudo seguir al usuario.", true); follow.disabled = false; }
            }
        });
        authorCard.appendChild(follow);
    }
    side.appendChild(authorCard);

    // ---------- Barra lateral: descarga y calificacion ----------
    const dlCard = el("div", "side-card");
    const mainDl = el("button", "btn primary block lg", "Descargar");
    mainDl.type = "button";
    if (files.length === 0) mainDl.disabled = true;
    else mainDl.addEventListener("click", () => download(files[0], mainDl));
    dlCard.appendChild(mainDl);

    const metaText = () => {
        const ext = files[0] ? fileExt(files[0]) : "sin archivo";
        return `${ext} · ${(post.downloadsCount || 0).toLocaleString("es")} descargas`;
    };
    const downloadsMeta = el("div", "dl-meta", metaText());
    dlCard.appendChild(downloadsMeta);

    const ratingRow = el("div", "rating-row");
    const stars = el("span", "stars");
    const starEls = [];
    for (let i = 0; i < 5; i++) { const s = el("i"); starEls.push(s); stars.appendChild(s); }
    const ratingText = el("span", "rating-text");
    ratingRow.appendChild(stars);
    ratingRow.appendChild(ratingText);
    dlCard.appendChild(ratingRow);

    function paintRating(avg) {
        const value = Number(avg) || 0;
        starEls.forEach((s, i) => s.classList.toggle("on", i < Math.round(value)));
        ratingText.textContent = value > 0 ? `${value.toFixed(1)} / 5` : "Sin calificaciones";
    }
    paintRating(post.averageRating);

    const rateBtn = el("button", "btn block", "Calificar");
    rateBtn.type = "button";
    dlCard.appendChild(rateBtn);

    const picker = el("div", "rate-picker");
    for (let n = 1; n <= 5; n++) {
        const b = el("button", null, String(n));
        b.type = "button";
        b.title = `${n} de 5`;
        b.addEventListener("click", async () => {
            try {
                const res = await API.request(`/posts/${postId}/rating`, {
                    method: "POST", auth: true, body: { stars: n }
                });
                paintRating(res.averageRating);
                picker.classList.remove("open");
                showToast("Gracias por tu calificacion.");
            } catch (err) {
                showToast(err.message || "No se pudo guardar la calificacion.", true);
            }
        });
        picker.appendChild(b);
    }
    dlCard.appendChild(picker);
    rateBtn.addEventListener("click", () => picker.classList.toggle("open"));
    side.appendChild(dlCard);

    // ---------- Reportar (el backend aun no tiene este endpoint) ----------
    const report = el("button", "link-btn", "Reportar publicacion");
    report.type = "button";
    report.addEventListener("click", () => showToast("Los reportes todavia no estan disponibles."));
    side.appendChild(report);
});
