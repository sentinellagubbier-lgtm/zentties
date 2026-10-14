import { supabase } from "./supabase-browser.js";

/* =========================================
   ELEMENTOS
========================================= */

const informacionUsuario =
    document.getElementById("informacionUsuario");

const botonCerrarSesion =
    document.getElementById("botonCerrarSesion");

const feedPublicaciones =
    document.getElementById("feedPublicaciones");

const botonRecargar =
    document.getElementById("recargarFeed");

const usuariosSugeridos =
    document.getElementById("usuariosSugeridos");


/* =========================================
   CONFIGURACIÓN
========================================= */

const REACCIONES_DISPONIBLES = {
    fire: "🔥",
    sparkles: "✨",
    laugh: "😂",
    wow: "😮",
    clap: "👏",
    star: "⭐",
    diamond: "💎"
};

let usuarioActual = null;


/* =========================================
   INICIAR
========================================= */

async function iniciar() {

    const {
        data: { session },
        error
    } = await supabase.auth.getSession();

    if (error || !session?.user) {

        console.error(
            "No se pudo comprobar la sesión:",
            error
        );

        window.location.href = "/login";

        return;
    }

    usuarioActual = session.user;

    await mostrarUsuarioActual();

    await cargarFeed();

    await cargarUsuariosSugeridos();
}

iniciar();


/* =========================================
   USUARIO ACTUAL
========================================= */

async function mostrarUsuarioActual() {

    const {
        data: perfil,
        error
    } = await supabase
        .from("perfiles")
        .select(
            "nombre_usuario"
        )
        .eq(
            "id",
            usuarioActual.id
        )
        .maybeSingle();

    if (error) {
        console.error(
            "Error al cargar perfil:",
            error
        );
    }

    const nombre =
        perfil?.nombre_usuario ||
        usuarioActual.user_metadata
            ?.nombre_usuario;

    if (informacionUsuario) {

        informacionUsuario.textContent =
            nombre
                ? `Sesión iniciada como @${nombre}`
                : `Sesión iniciada como ${usuarioActual.email}`;
    }
}


/* =========================================
   CARGAR FEED
========================================= */

async function cargarFeed() {

    if (!feedPublicaciones) {
        return;
    }

    feedPublicaciones.innerHTML = `
        <div class="feed-loading">
            <span class="feed-loading-icon">
                ✦
            </span>

            <p>
                Cargando publicaciones...
            </p>
        </div>
    `;

    const {
        data: publicaciones,
        error
    } = await supabase
        .from("publicaciones")
        .select(`
            id,
            usuario_id,
            contenido,
            archivo_url,
            tipo_archivo,
            fecha_creacion
        `)
        .order(
            "fecha_creacion",
            {
                ascending: false
            }
        );

    if (error) {

        console.error(
            "Error al cargar feed:",
            error
        );

        feedPublicaciones.innerHTML = `
            <div class="feed-error">
                No fue posible cargar
                las publicaciones.
            </div>
        `;

        return;
    }

    if (!publicaciones?.length) {

        feedPublicaciones.innerHTML = `
            <div class="feed-empty">

                <span class="feed-loading-icon">
                    ✦
                </span>

                <h2>
                    Aún no hay publicaciones
                </h2>

                <p>
                    Cuando alguien publique algo,
                    aparecerá aquí.
                </p>

            </div>
        `;

        return;
    }


    /* =====================================
       OBTENER PERFILES
    ===================================== */

    const idsUsuarios = [
        ...new Set(
            publicaciones.map(
                publicacion =>
                    publicacion.usuario_id
            )
        )
    ];

    const {
        data: perfiles,
        error: errorPerfiles
    } = await supabase
        .from("perfiles")
        .select(
            "id, nombre_usuario, avatar_url"
        )
        .in(
            "id",
            idsUsuarios
        );

    if (errorPerfiles) {

        console.error(
            "Error al cargar autores:",
            errorPerfiles
        );
    }

    const mapaPerfiles = {};

    for (const perfil of perfiles || []) {

        mapaPerfiles[perfil.id] =
            perfil;
    }


    /* =====================================
       DIBUJAR PUBLICACIONES
    ===================================== */

    feedPublicaciones.innerHTML =
        publicaciones
            .map(
                publicacion =>
                    crearHtmlPublicacion(
                        publicacion,
                        mapaPerfiles[
                            publicacion.usuario_id
                        ]
                    )
            )
            .join("");


    const idsPublicaciones =
        publicaciones.map(
            publicacion =>
                publicacion.id
        );

    await cargarLikes(
        idsPublicaciones
    );

    await cargarReacciones(
        idsPublicaciones
    );
}


/* =========================================
   CREAR PUBLICACIÓN
========================================= */

function crearHtmlPublicacion(
    publicacion,
    perfil
) {

    const nombre =
        perfil?.nombre_usuario ||
        "usuario";

    const avatar =
        perfil?.avatar_url || "";

    const contenido =
        escaparHtml(
            publicacion.contenido || ""
        );

    const fecha =
        formatearFecha(
            publicacion.fecha_creacion
        );

    const avatarHtml =
        avatar
            ? `
                <img
                    class="feed-post-avatar"
                    src="${escaparAtributo(avatar)}"
                    alt="Avatar de @${escaparHtml(nombre)}"
                >
            `
            : `
                <div
                    class="feed-post-avatar-fallback"
                >
                    ${escaparHtml(
                        nombre
                            .charAt(0)
                            .toUpperCase()
                    )}
                </div>
            `;

    return `
        <article
            class="feed-post"
            data-publicacion-id="${publicacion.id}"
        >

            <header
                class="feed-post-header"
            >

                ${avatarHtml}

                <div
                    class="feed-post-user"
                >
                    <strong>
                        @${escaparHtml(nombre)}
                    </strong>

                    <time>
                        ${fecha}
                    </time>
                </div>

                <button
                    class="feed-post-menu"
                    type="button"
                    aria-label="Opciones"
                >
                    •••
                </button>

            </header>


            ${
                contenido
                    ? `
                        <p
                            class="feed-post-content"
                        >
                            ${contenido}
                        </p>
                    `
                    : ""
            }


            ${crearMedia(publicacion)}


            <div
                class="feed-post-actions"
            >

                <button
                    class="feed-like-button"
                    type="button"
                    data-publicacion-id="${publicacion.id}"
                    aria-label="Dar like"
                >
                    <span
                        class="feed-like-heart"
                    >
                        ♡
                    </span>

                    <span
                        class="feed-like-count"
                    >
                        0
                    </span>
                </button>


                <button
                    class="feed-comment-button"
                    type="button"
                    aria-label="Comentarios"
                >
                    💬
                    <span>0</span>
                </button>


                <button
                    class="feed-reaction-button"
                    type="button"
                    data-publicacion-id="${publicacion.id}"
                    aria-label="Dar reconocimiento"
                >
                    ☺
                </button>


                <button
                    class="feed-share-button"
                    type="button"
                    data-publicacion-id="${publicacion.id}"
                    aria-label="Compartir"
                >
                    ↗
                </button>

            </div>


            <div
                class="feed-special-reactions"
                data-reacciones-id="${publicacion.id}"
            ></div>

        </article>
    `;
}


/* =========================================
   IMAGEN / GIF / VIDEO
========================================= */

function crearMedia(publicacion) {

    if (!publicacion.archivo_url) {
        return "";
    }

    const url =
        escaparAtributo(
            publicacion.archivo_url
        );

    if (
        publicacion.tipo_archivo ===
        "video"
    ) {

        return `
            <video
                class="feed-post-media"
                src="${url}"
                controls
                preload="metadata"
            ></video>
        `;
    }

    return `
        <img
            class="feed-post-media"
            src="${url}"
            alt="Contenido de la publicación"
            loading="lazy"
        >
    `;
}


/* =========================================
   CARGAR LIKES
========================================= */

async function cargarLikes(
    idsPublicaciones
) {

    const {
        data: likes,
        error
    } = await supabase
        .from("likes_publicaciones")
        .select(
            "publicacion_id, usuario_id"
        )
        .in(
            "publicacion_id",
            idsPublicaciones
        );

    if (error) {

        console.error(
            "Error al cargar likes:",
            error
        );

        return;
    }

    const cantidades = {};

    const misLikes =
        new Set();

    for (const like of likes || []) {

        cantidades[
            like.publicacion_id
        ] =
            (
                cantidades[
                    like.publicacion_id
                ] || 0
            ) + 1;

        if (
            like.usuario_id ===
            usuarioActual.id
        ) {

            misLikes.add(
                like.publicacion_id
            );
        }
    }

    for (
        const publicacionId
        of idsPublicaciones
    ) {

        const boton =
            feedPublicaciones.querySelector(
                `.feed-like-button[data-publicacion-id="${publicacionId}"]`
            );

        if (!boton) {
            continue;
        }

        const contador =
            boton.querySelector(
                ".feed-like-count"
            );

        const corazon =
            boton.querySelector(
                ".feed-like-heart"
            );

        contador.textContent =
            cantidades[
                publicacionId
            ] || 0;

        if (
            misLikes.has(
                publicacionId
            )
        ) {

            boton.classList.add(
                "liked"
            );

            corazon.textContent =
                "♥";

        } else {

            boton.classList.remove(
                "liked"
            );

            corazon.textContent =
                "♡";
        }
    }
}


/* =========================================
   DAR / QUITAR LIKE
========================================= */

feedPublicaciones?.addEventListener(
    "click",
    async evento => {

        const boton =
            evento.target.closest(
                ".feed-like-button"
            );

        if (!boton) {
            return;
        }

        const publicacionId =
            boton.dataset.publicacionId;

        const teniaLike =
            boton.classList.contains(
                "liked"
            );

        boton.disabled = true;

        try {

            if (teniaLike) {

                const { error } =
                    await supabase
                        .from(
                            "likes_publicaciones"
                        )
                        .delete()
                        .eq(
                            "publicacion_id",
                            publicacionId
                        )
                        .eq(
                            "usuario_id",
                            usuarioActual.id
                        );

                if (error) {
                    throw error;
                }

            } else {

                const { error } =
                    await supabase
                        .from(
                            "likes_publicaciones"
                        )
                        .insert({
                            publicacion_id:
                                publicacionId,

                            usuario_id:
                                usuarioActual.id
                        });

                if (error) {
                    throw error;
                }
            }

            await cargarLikes(
                [publicacionId]
            );

        } catch (error) {

            console.error(
                "Error al cambiar like:",
                error
            );

        } finally {

            boton.disabled = false;
        }
    }
);


/* =========================================
   CARGAR REACCIONES
========================================= */

async function cargarReacciones(
    idsPublicaciones
) {

    const {
        data: reacciones,
        error
    } = await supabase
        .from(
            "reacciones_publicaciones"
        )
        .select(
            "publicacion_id, usuario_id, tipo_reaccion"
        )
        .in(
            "publicacion_id",
            idsPublicaciones
        );

    if (error) {

        console.error(
            "Error al cargar reacciones:",
            error
        );

        return;
    }

    const cantidades = {};

    const misReacciones = {};

    for (
        const reaccion
        of reacciones || []
    ) {

        const publicacionId =
            reaccion.publicacion_id;

        const tipo =
            reaccion.tipo_reaccion;

        if (
            !cantidades[
                publicacionId
            ]
        ) {

            cantidades[
                publicacionId
            ] = {};
        }

        cantidades[
            publicacionId
        ][tipo] =
            (
                cantidades[
                    publicacionId
                ][tipo] || 0
            ) + 1;

        if (
            reaccion.usuario_id ===
            usuarioActual.id
        ) {

            misReacciones[
                publicacionId
            ] = tipo;
        }
    }

    for (
        const publicacionId
        of idsPublicaciones
    ) {

        mostrarReacciones(
            publicacionId,
            cantidades[
                publicacionId
            ] || {},
            misReacciones[
                publicacionId
            ] || null
        );
    }
}


/* =========================================
   MOSTRAR REACCIONES
========================================= */

function mostrarReacciones(
    publicacionId,
    cantidades,
    miReaccion
) {

    const contenedor =
        feedPublicaciones.querySelector(
            `[data-reacciones-id="${publicacionId}"]`
        );

    if (!contenedor) {
        return;
    }

    const html = [];

    for (
        const [tipo, emoji]
        of Object.entries(
            REACCIONES_DISPONIBLES
        )
    ) {

        const cantidad =
            cantidades[tipo] || 0;

        if (!cantidad) {
            continue;
        }

        html.push(`
            <button
                class="feed-reaction-chip ${
                    miReaccion === tipo
                        ? "selected"
                        : ""
                }"
                type="button"
                data-publicacion-id="${publicacionId}"
                data-reaccion="${tipo}"
            >
                <span>
                    ${emoji}
                </span>

                <strong>
                    ${cantidad}
                </strong>
            </button>
        `);
    }

    contenedor.innerHTML =
        html.join("");
}


/* =========================================
   MENÚ DE REACCIONES
========================================= */

feedPublicaciones?.addEventListener(
    "click",
    async evento => {

        const boton =
            evento.target.closest(
                ".feed-reaction-button"
            );

        if (boton) {

            evento.stopPropagation();

            abrirMenuReacciones(
                boton,
                boton.dataset.publicacionId
            );

            return;
        }

        const opcion =
            evento.target.closest(
                ".feed-reaction-option"
            );

        const chip =
            evento.target.closest(
                ".feed-reaction-chip"
            );

        const elemento =
            opcion || chip;

        if (!elemento) {
            return;
        }

        evento.stopPropagation();

        await guardarReaccion(
            elemento.dataset.publicacionId,
            elemento.dataset.reaccion
        );

        cerrarMenusReacciones();
    }
);


function abrirMenuReacciones(
    boton,
    publicacionId
) {

    cerrarMenusReacciones();

    const menu =
        document.createElement(
            "div"
        );

    menu.className =
        "feed-reaction-picker";

    menu.innerHTML =
        Object.entries(
            REACCIONES_DISPONIBLES
        )
            .map(
                ([tipo, emoji]) => `
                    <button
                        class="feed-reaction-option"
                        type="button"
                        data-publicacion-id="${publicacionId}"
                        data-reaccion="${tipo}"
                    >
                        ${emoji}
                    </button>
                `
            )
            .join("");

    boton
        .closest(
            ".feed-post-actions"
        )
        .appendChild(menu);
}


function cerrarMenusReacciones() {

    document
        .querySelectorAll(
            ".feed-reaction-picker"
        )
        .forEach(
            menu =>
                menu.remove()
        );
}


document.addEventListener(
    "click",
    cerrarMenusReacciones
);


/* =========================================
   GUARDAR REACCIÓN
========================================= */

async function guardarReaccion(
    publicacionId,
    tipoReaccion
) {

    const {
        data: actual,
        error: errorConsulta
    } = await supabase
        .from(
            "reacciones_publicaciones"
        )
        .select(
            "tipo_reaccion"
        )
        .eq(
            "publicacion_id",
            publicacionId
        )
        .eq(
            "usuario_id",
            usuarioActual.id
        )
        .maybeSingle();

    if (errorConsulta) {

        console.error(
            errorConsulta
        );

        return;
    }


    if (
        actual?.tipo_reaccion ===
        tipoReaccion
    ) {

        const { error } =
            await supabase
                .from(
                    "reacciones_publicaciones"
                )
                .delete()
                .eq(
                    "publicacion_id",
                    publicacionId
                )
                .eq(
                    "usuario_id",
                    usuarioActual.id
                );

        if (error) {

            console.error(error);

            return;
        }

    } else {

        const { error } =
            await supabase
                .from(
                    "reacciones_publicaciones"
                )
                .upsert(
                    {
                        publicacion_id:
                            publicacionId,

                        usuario_id:
                            usuarioActual.id,

                        tipo_reaccion:
                            tipoReaccion
                    },
                    {
                        onConflict:
                            "publicacion_id,usuario_id"
                    }
                );

        if (error) {

            console.error(error);

            return;
        }
    }


    await cargarReacciones(
        [publicacionId]
    );
}


/* =========================================
   USUARIOS SUGERIDOS
========================================= */

async function cargarUsuariosSugeridos() {

    if (!usuariosSugeridos) {
        return;
    }

    const {
        data: perfiles,
        error
    } = await supabase
        .from("perfiles")
        .select(
            "id, nombre_usuario, avatar_url"
        )
        .neq(
            "id",
            usuarioActual.id
        )
        .limit(5);

    if (error) {

        console.error(
            "Error al cargar usuarios:",
            error
        );

        usuariosSugeridos.innerHTML =
            "<p>No se pudieron cargar usuarios.</p>";

        return;
    }

    if (!perfiles?.length) {

        usuariosSugeridos.innerHTML = `
            <p>
                Todavía no hay otros usuarios.
            </p>
        `;

        return;
    }

    usuariosSugeridos.innerHTML =
        perfiles
            .map(
                perfil => `
                    <div class="suggested-user">

                        ${
                            perfil.avatar_url
                                ? `
                                    <img
                                        src="${escaparAtributo(perfil.avatar_url)}"
                                        alt=""
                                    >
                                `
                                : `
                                    <div
                                        class="suggested-user-fallback"
                                    >
                                        ${escaparHtml(
                                            perfil.nombre_usuario
                                                ?.charAt(0)
                                                .toUpperCase() ||
                                            "U"
                                        )}
                                    </div>
                                `
                        }

                        <span>
                            @${escaparHtml(
                                perfil.nombre_usuario ||
                                "usuario"
                            )}
                        </span>

                    </div>
                `
            )
            .join("");
}


/* =========================================
   RECARGAR FEED
========================================= */

botonRecargar?.addEventListener(
    "click",
    async () => {

        botonRecargar.disabled =
            true;

        await cargarFeed();

        botonRecargar.disabled =
            false;
    }
);


/* =========================================
   CERRAR SESIÓN
========================================= */

botonCerrarSesion?.addEventListener(
    "click",
    async () => {

        botonCerrarSesion.disabled =
            true;

        botonCerrarSesion.textContent =
            "Cerrando sesión...";

        const { error } =
            await supabase.auth.signOut();

        if (error) {

            console.error(
                "Error al cerrar sesión:",
                error
            );

            botonCerrarSesion.disabled =
                false;

            botonCerrarSesion.textContent =
                "Cerrar sesión";

            return;
        }

        window.location.href =
            "/login";
    }
);


/* =========================================
   FECHA
========================================= */

function formatearFecha(fecha) {

    if (!fecha) {
        return "";
    }

    return new Intl.DateTimeFormat(
        "es-MX",
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    ).format(
        new Date(fecha)
    );
}


/* =========================================
   SEGURIDAD HTML
========================================= */

function escaparHtml(valor) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        String(valor);

    return div.innerHTML;
}


function escaparAtributo(valor) {

    return String(valor)
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}