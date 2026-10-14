import { supabase } from "./supabase-browser.js";

const BUCKET_PUBLICACIONES = "publicaciones";

const botonNuevaPublicacion =
    document.getElementById("crearPublicacion");

const modalPublicacion =
    document.getElementById("modalPublicacion");

const cerrarModalPublicacion =
    document.getElementById("cerrarModalPublicacion");

const formPublicacion =
    document.getElementById("formPublicacion");

const contenidoPublicacion =
    document.getElementById("contenidoPublicacion");

const archivoPublicacion =
    document.getElementById("archivoPublicacion");

const nombreArchivoPublicacion =
    document.getElementById("nombreArchivoPublicacion");

const vistaPreviaPublicacion =
    document.getElementById("vistaPreviaPublicacion");

const contadorPublicacion =
    document.getElementById("contadorPublicacion");

const mensajePublicacion =
    document.getElementById("mensajePublicacion");

const botonPublicar =
    document.getElementById("botonPublicar");
const listaPublicaciones =
    document.getElementById("listaPublicaciones");
let usuarioActual = null;
let urlVistaPrevia = null;
const contadorPerfilPublicaciones =
    document.getElementById(
        "contadorPerfilPublicaciones"
    );

/* =========================================
   INICIAR PUBLICACIONES
========================================= */

async function iniciarPublicaciones() {
    const {
        data: { session },
        error
    } = await supabase.auth.getSession();

    if (error) {
        console.error(
            "Error al obtener la sesión:",
            error
        );
        return;
    }

    if (!session?.user) {
        window.location.href = "/login";
        return;
    }

    usuarioActual = session.user
    await cargarPublicaciones();
}

iniciarPublicaciones();

/* =========================================
   ABRIR MODAL
========================================= */

botonNuevaPublicacion?.addEventListener(
    "click",
    () => {
        modalPublicacion.classList.remove("hidden");

        modalPublicacion.setAttribute(
            "aria-hidden",
            "false"
        );
    }
);

/* =========================================
   CERRAR MODAL
========================================= */

cerrarModalPublicacion?.addEventListener(
    "click",
    cerrarModalNuevaPublicacion
);

modalPublicacion?.addEventListener(
    "click",
    (evento) => {
        if (evento.target === modalPublicacion) {
            cerrarModalNuevaPublicacion();
        }
    }
);

function cerrarModalNuevaPublicacion() {
    modalPublicacion.classList.add("hidden");

    modalPublicacion.setAttribute(
        "aria-hidden",
        "true"
    );
}

/* =========================================
   CONTADOR
========================================= */

contenidoPublicacion?.addEventListener(
    "input",
    () => {
        contadorPublicacion.textContent =
            `${contenidoPublicacion.value.length} / 1000`;
    }
);

/* =========================================
   VISTA PREVIA
========================================= */

archivoPublicacion?.addEventListener(
    "change",
    () => {
        const archivo =
            archivoPublicacion.files?.[0];

        limpiarVistaPrevia();

        if (!archivo) {
            nombreArchivoPublicacion.textContent =
                "Ningún archivo seleccionado";

            return;
        }

        nombreArchivoPublicacion.textContent =
            archivo.name;

        urlVistaPrevia =
            URL.createObjectURL(archivo);

        if (archivo.type.startsWith("image/")) {
            const imagen =
                document.createElement("img");

            imagen.src = urlVistaPrevia;

            imagen.alt =
                "Vista previa de la publicación";

            vistaPreviaPublicacion.appendChild(
                imagen
            );
        } else if (
            archivo.type.startsWith("video/")
        ) {
            const video =
                document.createElement("video");

            video.src = urlVistaPrevia;
            video.controls = true;
            video.preload = "metadata";

            vistaPreviaPublicacion.appendChild(
                video
            );
        } else {
            mostrarMensajePublicacion(
                "El archivo seleccionado no está permitido.",
                "error"
            );

            archivoPublicacion.value = "";

            nombreArchivoPublicacion.textContent =
                "Ningún archivo seleccionado";

            return;
        }

        vistaPreviaPublicacion.classList.remove(
            "hidden"
        );
    }
);

/* =========================================
   CREAR PUBLICACIÓN
========================================= */

formPublicacion?.addEventListener(
    "submit",
    async (evento) => {
        evento.preventDefault();

        if (!usuarioActual) {
            mostrarMensajePublicacion(
                "No se encontró una sesión activa.",
                "error"
            );

            return;
        }

        const contenido =
            contenidoPublicacion.value.trim();

        const archivo =
            archivoPublicacion.files?.[0] || null;

        if (!contenido && !archivo) {
            mostrarMensajePublicacion(
                "Escribe algo o selecciona un archivo.",
                "error"
            );

            return;
        }

        botonPublicar.disabled = true;
        botonPublicar.textContent =
            "Publicando...";

        mostrarMensajePublicacion(
            "Creando publicación...",
            ""
        );

        let rutaArchivo = null;
        let archivoUrl = null;
        let tipoArchivo = null;

        try {
            if (archivo) {
                validarArchivo(archivo);

                tipoArchivo =
                    obtenerTipoArchivo(archivo);

                const extension =
                    obtenerExtension(archivo);

                const nombreUnico =
                    `publicacion-${Date.now()}.${extension}`;

                rutaArchivo =
                    `${usuarioActual.id}/${nombreUnico}`;

                const {
                    error: errorSubida
                } = await supabase
                    .storage
                    .from(BUCKET_PUBLICACIONES)
                    .upload(
                        rutaArchivo,
                        archivo,
                        {
                            cacheControl: "3600",
                            contentType: archivo.type,
                            upsert: false
                        }
                    );

                if (errorSubida) {
                    throw errorSubida;
                }

                const {
                    data: datosUrl
                } = supabase
                    .storage
                    .from(BUCKET_PUBLICACIONES)
                    .getPublicUrl(rutaArchivo);

                archivoUrl =
                    datosUrl.publicUrl;
            }

            const {
                data: publicacionCreada,
                error: errorPublicacion
            } = await supabase
                .from("publicaciones")
                .insert({
                    usuario_id:
                        usuarioActual.id,

                    contenido:
                        contenido || null,

                    archivo_url:
                        archivoUrl,

                    tipo_archivo:
                        tipoArchivo
                })
                .select()
                .single();

            if (errorPublicacion) {
                if (rutaArchivo) {
                    await supabase
                        .storage
                        .from(BUCKET_PUBLICACIONES)
                        .remove([rutaArchivo]);
                }

                throw errorPublicacion;
            }

            console.log(
                "Publicación creada:",
                publicacionCreada
            );

            mostrarMensajePublicacion(
                "Publicación creada correctamente.",
                "exito"
            );
            await cargarPublicaciones();
            limpiarFormularioPublicacion();

            setTimeout(
                cerrarModalNuevaPublicacion,
                700
            );

        } catch (error) {
            console.error(
                "Error al crear la publicación:",
                error
            );

            mostrarMensajePublicacion(
                error?.message ||
                "No fue posible crear la publicación.",
                "error"
            );

        } finally {
            botonPublicar.disabled = false;
            botonPublicar.textContent =
                "Publicar";
        }
    }
);
/* =========================================
   CARGAR PUBLICACIONES DEL PERFIL
========================================= */

async function cargarPublicaciones() {
    if (!listaPublicaciones || !usuarioActual) {
        return;
    }

    listaPublicaciones.innerHTML = `
        <p class="posts-loading">
            Cargando publicaciones...
        </p>
    `;

    const {
        data: publicaciones,
        error
    } = await supabase
        .from("publicaciones")
        .select(`
            id,
            contenido,
            archivo_url,
            tipo_archivo,
            fecha_creacion
        `)
        .eq(
            "usuario_id",
            usuarioActual.id
        )
        .order(
            "fecha_creacion",
            {
                ascending: false
            }
        );

if (error) {
    console.error(
        "Error al cargar publicaciones:",
        error
    );

    listaPublicaciones.innerHTML = `
        <p class="posts-error">
            No fue posible cargar las publicaciones.
        </p>
    `;

    return;
}

if (contadorPerfilPublicaciones) {
    contadorPerfilPublicaciones.textContent =
        publicaciones?.length || 0;
}

if (!publicaciones?.length) {
    listaPublicaciones.innerHTML = `
        <div class="empty-posts">
            <span class="empty-posts-icon">✦</span>

            <h3>
                Todavía no hay publicaciones
            </h3>

            <p>
                Tus fotos, GIF, videos y textos
                aparecerán aquí.
            </p>
        </div>
    `;

    return;
}

const {
    data: perfilAutor,
    error: errorPerfilAutor
} = await supabase
    .from("perfiles")
    .select(
        "nombre_usuario, avatar_url"
    )
    .eq(
        "id",
        usuarioActual.id
    )
    .maybeSingle();

if (errorPerfilAutor) {
    console.error(
        "Error al cargar datos del autor:",
        errorPerfilAutor
    );
}

const nombre =
    perfilAutor?.nombre_usuario
        ? `@${perfilAutor.nombre_usuario}`
        : "@usuario";

const avatar =
    perfilAutor?.avatar_url || "";

    listaPublicaciones.innerHTML =
        publicaciones
            .map(
                (publicacion) =>
                    crearHtmlPublicacion(
                        publicacion,
                        nombre,
                        avatar
                    )
            )
            .join("");

    const idsPublicaciones =
        publicaciones.map(
            (publicacion) =>
                publicacion.id
        );

    await cargarLikesPublicaciones(
        idsPublicaciones
    );

    await cargarReaccionesPublicaciones(
        idsPublicaciones
    );
}
/* =========================================
   CARGAR LIKES DE LAS PUBLICACIONES
========================================= */

async function cargarLikesPublicaciones(
    idsPublicaciones
) {
    if (
        !idsPublicaciones.length ||
        !usuarioActual
    ) {
        return;
    }

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
    const publicacionesConMiLike =
        new Set();

    for (const like of likes || []) {
        cantidades[like.publicacion_id] =
            (
                cantidades[
                    like.publicacion_id
                ] || 0
            ) + 1;

        if (
            like.usuario_id ===
            usuarioActual.id
        ) {
            publicacionesConMiLike.add(
                like.publicacion_id
            );
        }
    }

    for (
        const publicacionId
        of idsPublicaciones
    ) {
        const boton =
            listaPublicaciones
                .querySelector(
                    `.post-like-button[
                        data-publicacion-id="${publicacionId}"
                    ]`
                );

        if (!boton) {
            continue;
        }

        const contador =
            boton.querySelector(
                ".like-count"
            );

        const corazon =
            boton.querySelector(
                ".like-heart"
            );

        contador.textContent =
            cantidades[publicacionId] || 0;

        if (
            publicacionesConMiLike.has(
                publicacionId
            )
        ) {
            boton.classList.add("liked");
            boton.setAttribute(
                "aria-label",
                "Quitar like"
            );

            corazon.textContent = "♥";
        } else {
            boton.classList.remove("liked");
            boton.setAttribute(
                "aria-label",
                "Dar like"
            );

            corazon.textContent = "♡";
        }
    }
}
/* =========================================
   DAR O QUITAR LIKE
========================================= */

listaPublicaciones?.addEventListener(
    "click",
    async (evento) => {
        const botonLike =
            evento.target.closest(
                ".post-like-button"
            );

        if (!botonLike) {
            return;
        }

        if (!usuarioActual) {
            window.location.href =
                "/login";

            return;
        }

        const publicacionId =
            botonLike.dataset
                .publicacionId;

        if (!publicacionId) {
            return;
        }

        await alternarLike(
            publicacionId,
            botonLike
        );
    }
);
async function alternarLike(
    publicacionId,
    boton
) {
    const contador =
        boton.querySelector(
            ".like-count"
        );

    const corazon =
        boton.querySelector(
            ".like-heart"
        );

    const teniaLike =
        boton.classList.contains(
            "liked"
        );

    const cantidadActual =
        Number(
            contador.textContent
        ) || 0;

    boton.disabled = true;

    try {
        if (teniaLike) {
            const {
                error
            } = await supabase
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

            boton.classList.remove(
                "liked"
            );

            boton.setAttribute(
                "aria-label",
                "Dar like"
            );

            corazon.textContent = "♡";

            contador.textContent =
                Math.max(
                    0,
                    cantidadActual - 1
                );
        } else {
            const {
                error
            } = await supabase
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

            boton.classList.add(
                "liked"
            );

            boton.setAttribute(
                "aria-label",
                "Quitar like"
            );

            corazon.textContent = "♥";

            contador.textContent =
                cantidadActual + 1;
        }
    } catch (error) {
        console.error(
            "Error al cambiar el like:",
            error
        );
    } finally {
        boton.disabled = false;
    }
}
/* =========================================
   REACCIONES ESPECIALES
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

/* =========================================
   CARGAR REACCIONES
========================================= */

async function cargarReaccionesPublicaciones(
    idsPublicaciones
) {
    if (
        !idsPublicaciones.length ||
        !usuarioActual
    ) {
        return;
    }

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
    const reaccionesDelUsuario = {};

    for (const reaccion of reacciones || []) {
        const publicacionId =
            reaccion.publicacion_id;

        const tipo =
            reaccion.tipo_reaccion;

        if (!cantidades[publicacionId]) {
            cantidades[publicacionId] = {};
        }

        cantidades[publicacionId][tipo] =
            (
                cantidades[publicacionId][tipo] ||
                0
            ) + 1;

        if (
            reaccion.usuario_id ===
            usuarioActual.id
        ) {
            reaccionesDelUsuario[
                publicacionId
            ] = tipo;
        }
    }

    for (
        const publicacionId
        of idsPublicaciones
    ) {
        mostrarResumenReacciones(
            publicacionId,
            cantidades[publicacionId] || {},
            reaccionesDelUsuario[
                publicacionId
            ] || null
        );
    }
}

/* =========================================
   MOSTRAR REACCIONES RECIBIDAS
========================================= */

function mostrarResumenReacciones(
    publicacionId,
    cantidades,
    reaccionUsuario
) {
    const contenedor =
        listaPublicaciones.querySelector(
            `[data-reacciones-id="${publicacionId}"]`
        );

    const botonPrincipal =
        listaPublicaciones.querySelector(
            `.post-reaction-button[data-publicacion-id="${publicacionId}"]`
        );

    if (!contenedor) {
        return;
    }

    const chips = [];

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

        const seleccionada =
            reaccionUsuario === tipo
                ? "selected"
                : "";

        chips.push(`
            <button
                class="special-reaction-chip ${seleccionada}"
                type="button"
                data-publicacion-id="${publicacionId}"
                data-reaccion="${tipo}"
                aria-label="Reacción ${emoji}"
            >
                <span>${emoji}</span>
                <strong>${cantidad}</strong>
            </button>
        `);
    }

    contenedor.innerHTML =
        chips.join("");

    if (botonPrincipal) {
        botonPrincipal.classList.toggle(
            "reaction-selected",
            Boolean(reaccionUsuario)
        );

        botonPrincipal.textContent = "☺";
    }
}

/* =========================================
   EVENTOS DE REACCIONES
========================================= */

listaPublicaciones?.addEventListener(
    "click",
    async (evento) => {
        const botonPrincipal =
            evento.target.closest(
                ".post-reaction-button"
            );

        if (botonPrincipal) {
            evento.stopPropagation();

            const publicacionId =
                botonPrincipal.dataset
                    .publicacionId;

            abrirMenuReacciones(
                botonPrincipal,
                publicacionId
            );

            return;
        }

        const opcion =
            evento.target.closest(
                ".reaction-option"
            );

        const chip =
            evento.target.closest(
                ".special-reaction-chip"
            );

        const elemento =
            opcion || chip;

        if (!elemento) {
            return;
        }

        evento.stopPropagation();

        const publicacionId =
            elemento.dataset.publicacionId;

        const tipoReaccion =
            elemento.dataset.reaccion;

        await guardarReaccion(
            publicacionId,
            tipoReaccion
        );

        cerrarMenusReacciones();
    }
);

/* =========================================
   MENÚ DE EMOJIS
========================================= */

function abrirMenuReacciones(
    boton,
    publicacionId
) {
    cerrarMenusReacciones();

    const menu =
        document.createElement("div");

    menu.className = "reaction-picker";

    menu.innerHTML =
        Object.entries(
            REACCIONES_DISPONIBLES
        )
            .map(
                ([tipo, emoji]) => `
                    <button
                        type="button"
                        class="reaction-option"
                        data-publicacion-id="${publicacionId}"
                        data-reaccion="${tipo}"
                        aria-label="Reaccionar con ${emoji}"
                    >
                        ${emoji}
                    </button>
                `
            )
            .join("");

    boton
        .closest(".post-actions")
        .appendChild(menu);
}

function cerrarMenusReacciones() {
    document
        .querySelectorAll(
            ".reaction-picker"
        )
        .forEach(
            (menu) => menu.remove()
        );
}

document.addEventListener(
    "click",
    cerrarMenusReacciones
);

/* =========================================
   GUARDAR, CAMBIAR O QUITAR REACCIÓN
========================================= */

async function guardarReaccion(
    publicacionId,
    tipoReaccion
) {
    if (!usuarioActual) {
        window.location.href =
            "/login";

        return;
    }

    const {
        data: reaccionActual,
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
            "Error al consultar reacción:",
            errorConsulta
        );

        return;
    }

    if (
        reaccionActual?.tipo_reaccion ===
        tipoReaccion
    ) {
        const {
            error: errorEliminar
        } = await supabase
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

        if (errorEliminar) {
            console.error(
                "Error al quitar reacción:",
                errorEliminar
            );

            return;
        }
    } else {
        const {
            error: errorGuardar
        } = await supabase
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

        if (errorGuardar) {
            console.error(
                "Error al guardar reacción:",
                errorGuardar
            );

            return;
        }
    }

    await cargarReaccionesPublicaciones(
        [publicacionId]
    );
}
/* =========================================
   CREAR HTML DE UNA PUBLICACIÓN
========================================= */

function crearHtmlPublicacion(
    publicacion,
    nombre,
    avatar
) {
    const contenidoSeguro =
        escaparHtml(
            publicacion.contenido || ""
        );

    const fecha =
        formatearFecha(
            publicacion.fecha_creacion
        );

    const media =
        crearMediaPublicacion(
            publicacion
        );

    const avatarHtml =
        avatar
            ? `
                <img
                    class="post-avatar"
                    src="${avatar}"
                    alt="Avatar de ${escaparHtml(nombre)}"
                >
            `
            : `
                <div class="post-avatar-fallback">
                    ${escaparHtml(
                        nombre
                            .replace("@", "")
                            .charAt(0)
                            .toUpperCase()
                    )}
                </div>
            `;

    return `
        <article
            class="post-card"
            data-publicacion-id="${publicacion.id}"
        >
            <header class="post-author">
                ${avatarHtml}

                <div class="post-author-info">
                    <strong>
                        ${escaparHtml(nombre)}
                    </strong>

                    <time>
                        ${fecha}
                    </time>
                </div>

                <button
                    class="post-menu-button"
                    type="button"
                    aria-label="Opciones de publicación"
                >
                    •••
                </button>
            </header>

            ${
                contenidoSeguro
                    ? `
                        <p class="post-content">
                            ${contenidoSeguro}
                        </p>
                    `
                    : ""
            }

            ${media}

            <div class="post-actions">
                <button
                    class="post-like-button"
                    type="button"
                    data-publicacion-id="${publicacion.id}"
                    aria-label="Dar like"
                >
                    <span class="like-heart">♡</span>
                    <span class="like-count">0</span>
                </button>

                <button
                    class="post-comment-button"
                    type="button"
                    aria-label="Comentarios"
                >
                    💬
                    <span>0</span>
                </button>

                <button
                    class="post-reaction-button"
                    type="button"
                    data-publicacion-id="${publicacion.id}"
                    aria-label="Dar reconocimiento"
                >
                    ☺
                </button>

                <button
                    class="post-share-button"
                    type="button"
                    aria-label="Compartir"
                >
                    ↗
                </button>
            </div>

            <div
                class="post-special-reactions"
                data-reacciones-id="${publicacion.id}"
            ></div>
        </article>
    `;
}

/* =========================================
   ARCHIVO DE LA PUBLICACIÓN
========================================= */

function crearMediaPublicacion(publicacion) {
    if (!publicacion.archivo_url) {
        return "";
    }

    const url =
        escaparAtributo(
            publicacion.archivo_url
        );

    if (
        publicacion.tipo_archivo === "video"
    ) {
        return `
            <video
                class="post-media"
                src="${url}"
                controls
                preload="metadata"
            ></video>
        `;
    }

    return `
        <img
            class="post-media"
            src="${url}"
            alt="Archivo de la publicación"
            loading="lazy"
        >
    `;
}

/* =========================================
   FORMATEAR FECHA
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
   EVITAR HTML INYECTADO
========================================= */

function escaparHtml(valor) {
    const elemento =
        document.createElement("div");

    elemento.textContent =
        String(valor);

    return elemento.innerHTML;
}

function escaparAtributo(valor) {
    return String(valor)
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}
/* =========================================
   FUNCIONES AUXILIARES
========================================= */

function obtenerTipoArchivo(archivo) {
    if (archivo.type === "image/gif") {
        return "gif";
    }

    if (archivo.type.startsWith("image/")) {
        return "imagen";
    }

    if (archivo.type.startsWith("video/")) {
        return "video";
    }

    return null;
}

function obtenerExtension(archivo) {
    const partes =
        archivo.name.split(".");

    if (partes.length > 1) {
        return partes.pop().toLowerCase();
    }

    if (archivo.type === "image/jpeg") {
        return "jpg";
    }

    if (archivo.type === "image/png") {
        return "png";
    }

    if (archivo.type === "image/gif") {
        return "gif";
    }

    if (archivo.type === "video/mp4") {
        return "mp4";
    }

    return "bin";
}

function validarArchivo(archivo) {
    const tiposPermitidos = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "video/mp4",
        "video/webm"
    ];

    if (!tiposPermitidos.includes(archivo.type)) {
        throw new Error(
            "Solo se permiten imágenes, GIF, MP4 o WebM."
        );
    }

    const limiteImagen =
        10 * 1024 * 1024;

    const limiteVideo =
        50 * 1024 * 1024;

    if (
        archivo.type.startsWith("image/") &&
        archivo.size > limiteImagen
    ) {
        throw new Error(
            "La imagen no puede pesar más de 10 MB."
        );
    }

    if (
        archivo.type.startsWith("video/") &&
        archivo.size > limiteVideo
    ) {
        throw new Error(
            "El video no puede pesar más de 50 MB."
        );
    }
}

function mostrarMensajePublicacion(
    texto,
    tipo
) {
    mensajePublicacion.textContent = texto;

    if (tipo) {
        mensajePublicacion.dataset.tipo = tipo;
    } else {
        delete mensajePublicacion.dataset.tipo;
    }
}

function limpiarVistaPrevia() {
    vistaPreviaPublicacion.innerHTML = "";

    vistaPreviaPublicacion.classList.add(
        "hidden"
    );

    if (urlVistaPrevia) {
        URL.revokeObjectURL(urlVistaPrevia);
        urlVistaPrevia = null;
    }
}

function limpiarFormularioPublicacion() {
    formPublicacion.reset();

    contadorPublicacion.textContent =
        "0 / 1000";

    nombreArchivoPublicacion.textContent =
        "Ningún archivo seleccionado";

    limpiarVistaPrevia();
}