import { supabase } from "./supabase-browser.js";

/* =====================================================
   ELEMENTOS PRINCIPALES
===================================================== */

const nombreUsuario =
    document.querySelector("#nombreUsuario");

const correoUsuario =
    document.querySelector("#correoUsuario");

const avatarUsuario =
    document.querySelector("#avatarUsuario");

const inicialAvatar =
    document.querySelector("#inicialAvatar");

const imagenAvatar =
    document.querySelector("#imagenAvatar");

const imagenBanner =
    document.querySelector("#imagenBanner");

const biografiaUsuario =
    document.querySelector("#biografiaUsuario");

const mensajeArchivos =
    document.querySelector("#mensajeArchivos");

/* =====================================================
   BOTONES E INPUTS
===================================================== */

const botonCambiarAvatar =
    document.querySelector("#cambiarAvatar");

const botonCambiarBanner =
    document.querySelector("#cambiarBanner");

const inputAvatar =
    document.querySelector("#inputAvatar");

const inputBanner =
    document.querySelector("#inputBanner");

const botonCerrarSesion =
    document.querySelector("#botonCerrarSesion");

const botonEditarPerfil =
    document.querySelector("#editarPerfil");

/* =====================================================
   MODAL
===================================================== */

const modalPerfil =
    document.querySelector("#modalPerfil");

const cerrarModal =
    document.querySelector("#cerrarModal");

const formularioPerfil =
    document.querySelector("#formEditarPerfil");

const biografiaInput =
    document.querySelector("#biografiaInput");

const contadorBiografia =
    document.querySelector("#contadorBiografia");

const botonGuardarPerfil =
    formularioPerfil.querySelector(
        'button[type="submit"]'
    );
    

/* =====================================================
   CONFIGURACIÓN
===================================================== */

const BUCKET = "perfiles";

const TIPOS_PERMITIDOS = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
];

const LIMITE_AVATAR =
    5 * 1024 * 1024;

const LIMITE_BANNER =
    10 * 1024 * 1024;

let usuarioActual = null;

/* =====================================================
   MENSAJES
===================================================== */

function mostrarMensaje(
    texto,
    tipo = "informacion"
) {
    mensajeArchivos.textContent = texto;
    mensajeArchivos.dataset.tipo = tipo;
}

function limpiarMensaje() {
    mensajeArchivos.textContent = "";
    delete mensajeArchivos.dataset.tipo;
}

/* =====================================================
   VALIDAR ARCHIVOS
===================================================== */

function validarArchivo(
    archivo,
    tamañoMaximo
) {
    if (!archivo) {
        return "No seleccionaste ningún archivo.";
    }

    if (
        !TIPOS_PERMITIDOS.includes(
            archivo.type
        )
    ) {
        return (
            "Formato no permitido. Usa JPG, PNG, WebP o GIF."
        );
    }

    if (archivo.size > tamañoMaximo) {
        const megabytes =
            tamañoMaximo /
            1024 /
            1024;

        return (
            `El archivo no puede superar ${megabytes} MB.`
        );
    }

    return null;
}

/* =====================================================
   EXTENSIÓN DEL ARCHIVO
===================================================== */

function obtenerExtension(archivo) {
    const partes =
        archivo.name.split(".");

    if (partes.length < 2) {
        if (archivo.type === "image/gif") {
            return "gif";
        }

        if (archivo.type === "image/png") {
            return "png";
        }

        if (archivo.type === "image/webp") {
            return "webp";
        }

        return "jpg";
    }

    return partes
        .pop()
        .toLowerCase();
}

/* =====================================================
   MOSTRAR AVATAR
===================================================== */

function mostrarAvatar(url) {
    if (!url) {
        imagenAvatar.classList.add(
            "hidden"
        );

        inicialAvatar.classList.remove(
            "hidden"
        );

        return;
    }

    /*
     * Agregamos un parámetro para evitar
     * que el navegador muestre la versión
     * anterior guardada en caché.
     */
    imagenAvatar.src =
        `${url}?actualizacion=${Date.now()}`;

    imagenAvatar.classList.remove(
        "hidden"
    );

    inicialAvatar.classList.add(
        "hidden"
    );
}

/* =====================================================
   MOSTRAR BANNER
===================================================== */

function mostrarBanner(url) {
    if (!url) {
        imagenBanner.classList.add(
            "hidden"
        );

        return;
    }

    imagenBanner.src =
        `${url}?actualizacion=${Date.now()}`;

    imagenBanner.classList.remove(
        "hidden"
    );
}

/* =====================================================
   CARGAR PERFIL DESDE SUPABASE
===================================================== */

async function cargarPerfil() {
    const {
        data: { session },
        error: errorSesion
    } = await supabase.auth.getSession();

    if (
        errorSesion ||
        !session
    ) {
        window.location.href = "/login";
        return;
    }

    usuarioActual =
        session.user;

    const nombreMetadatos =
        usuarioActual.user_metadata
            ?.nombre_usuario;

    const {
        data: perfil,
        error: errorPerfil
    } = await supabase
        .from("perfiles")
        .select(
            `
                nombre_usuario,
                biografia,
                avatar_url,
                banner_url
            `
        )
        .eq(
            "id",
            usuarioActual.id
        )
        .maybeSingle();

    if (errorPerfil) {
        console.error(
            "Error al cargar el perfil:",
            errorPerfil
        );
    }

    const username =
        perfil?.nombre_usuario ||
        nombreMetadatos ||
        "usuario";

    nombreUsuario.textContent =
        `@${username}`;

    correoUsuario.textContent =
        usuarioActual.email;

    inicialAvatar.textContent =
        username
            .charAt(0)
            .toUpperCase();

    biografiaUsuario.textContent =
        perfil?.biografia ||
        "Todavía no has agregado una biografía.";

    mostrarAvatar(
        perfil?.avatar_url
    );

    mostrarBanner(
        perfil?.banner_url
    );
}

/* =====================================================
   SUBIR AVATAR O BANNER
===================================================== */

async function subirImagen({
    archivo,
    tipo,
    tamañoMaximo,
    columna,
    boton
}) {
    limpiarMensaje();

    const errorValidacion =
        validarArchivo(
            archivo,
            tamañoMaximo
        );

    if (errorValidacion) {
        mostrarMensaje(
            errorValidacion,
            "error"
        );

        return;
    }

    if (!usuarioActual) {
        window.location.href = "/login";
        return;
    }

    boton.disabled = true;

    const textoOriginal =
        boton.textContent;

    boton.textContent = "Subiendo...";

    mostrarMensaje(
        `Subiendo ${tipo}...`
    );

    try {
        const extension =
            obtenerExtension(archivo);

        /*
         * Se conserva una ruta estable,
         * pero cambia la extensión cuando
         * el usuario selecciona otro formato.
         */
        const nombreUnico =
    `${tipo}-${Date.now()}.${extension}`;

        const ruta =
    `${usuarioActual.id}/${nombreUnico}`;

        /*
         * Primero buscamos la URL anterior
         * para poder eliminar un archivo que
         * tenga otra extensión.
         */
        const {
            data: perfilAnterior
        } = await supabase
            .from("perfiles")
            .select(columna)
            .eq(
                "id",
                usuarioActual.id
            )
            .maybeSingle();

        const urlAnterior =
            perfilAnterior?.[columna];

        if (urlAnterior) {
            const marcador =
                `/storage/v1/object/public/${BUCKET}/`;

            const posicion =
                urlAnterior.indexOf(
                    marcador
                );

            if (posicion !== -1) {
                const rutaAnterior =
                    decodeURIComponent(
                        urlAnterior.substring(
                            posicion +
                            marcador.length
                        )
                    );

                if (
                    rutaAnterior !== ruta
                ) {
                    const {
    data: archivosEliminados,
    error: errorEliminacion
} = await supabase
    .storage
    .from(BUCKET)
    .remove([rutaAnterior]);

console.log(
    "Ruta anterior:",
    rutaAnterior
);

console.log(
    "Archivos eliminados:",
    archivosEliminados
);

if (errorEliminacion) {
    console.error(
        "Error al eliminar el archivo anterior:",
        errorEliminacion
    );
}
                }
            }
        }

        const {
            error: errorSubida
        } = await supabase
            .storage
            .from(BUCKET)
            .upload(
                ruta,
                archivo,
                {
                    cacheControl: "3600",
                    contentType: archivo.type,
                    upsert: true
                }
            );

        if (errorSubida) {
            throw errorSubida;
        }

        const {
            data: datosUrl
        } = supabase
            .storage
            .from(BUCKET)
            .getPublicUrl(ruta);

        const urlPublica =
            datosUrl.publicUrl;

        const {
            data: perfilActualizado,
            error: errorBaseDatos
        } = await supabase
            .from("perfiles")
            .update({
                [columna]: urlPublica
            })
            .eq(
                "id",
                usuarioActual.id
            )
            .select(
                "id, avatar_url, banner_url"
            )
            .single();

        if (errorBaseDatos) {
            throw errorBaseDatos;
        }

        console.log(
            "Perfil actualizado:",
            perfilActualizado
        );

        const urlGuardada =
            perfilActualizado[columna];

        if (tipo === "avatar") {
            mostrarAvatar(urlGuardada);
        } else {
            mostrarBanner(urlGuardada);
        }

        mostrarMensaje(
            `${
                tipo === "avatar"
                    ? "Avatar"
                    : "Banner"
            } actualizado correctamente.`,
            "exito"
        );

    } catch (error) {
        console.error(
            "Error al subir archivo:",
            error
        );

        mostrarMensaje(
            error?.message ||
            "No fue posible subir el archivo.",
            "error"
        );

    } finally {
        boton.disabled = false;
        boton.textContent =
            textoOriginal;
    }
}
/* =====================================================
   SELECCIONAR AVATAR
===================================================== */

botonCambiarAvatar.addEventListener(
    "click",
    () => {
        inputAvatar.click();
    }
);

inputAvatar.addEventListener(
    "change",
    async () => {
        const archivo =
            inputAvatar.files?.[0];

        await subirImagen({
            archivo,
            tipo: "avatar",
            tamañoMaximo:
                LIMITE_AVATAR,
            columna: "avatar_url",
            boton:
                botonCambiarAvatar
        });

        inputAvatar.value = "";
    }
);

/* =====================================================
   SELECCIONAR BANNER
===================================================== */

botonCambiarBanner.addEventListener(
    "click",
    () => {
        inputBanner.click();
    }
);

inputBanner.addEventListener(
    "change",
    async () => {
        const archivo =
            inputBanner.files?.[0];

        await subirImagen({
            archivo,
            tipo: "banner",
            tamañoMaximo:
                LIMITE_BANNER,
            columna: "banner_url",
            boton:
                botonCambiarBanner
        });

        inputBanner.value = "";
    }
);

/* =====================================================
   MODAL DE BIOGRAFÍA
===================================================== */

function abrirModalPerfil() {
    const textoActual =
        biografiaUsuario.textContent;

    biografiaInput.value =
        textoActual ===
        "Todavía no has agregado una biografía."
            ? ""
            : textoActual;

    actualizarContador();

    modalPerfil.classList.remove(
        "hidden"
    );

    modalPerfil.setAttribute(
        "aria-hidden",
        "false"
    );
}

function cerrarModalPerfil() {
    modalPerfil.classList.add(
        "hidden"
    );

    modalPerfil.setAttribute(
        "aria-hidden",
        "true"
    );
}

function actualizarContador() {
    contadorBiografia.textContent =
        `${biografiaInput.value.length} / 180`;
}

botonEditarPerfil.addEventListener(
    "click",
    abrirModalPerfil
);

cerrarModal.addEventListener(
    "click",
    cerrarModalPerfil
);

modalPerfil.addEventListener(
    "click",
    (evento) => {
        if (
            evento.target ===
            modalPerfil
        ) {
            cerrarModalPerfil();
        }
    }
);

biografiaInput.addEventListener(
    "input",
    actualizarContador
);

/* =====================================================
   GUARDAR BIOGRAFÍA EN SUPABASE
===================================================== */

formularioPerfil.addEventListener(
    "submit",
    async (evento) => {
        evento.preventDefault();

        if (!usuarioActual) {
            window.location.href =
                "/login";

            return;
        }

        const nuevaBiografia =
            biografiaInput.value.trim();

        botonGuardarPerfil.disabled =
            true;

        botonGuardarPerfil.textContent =
            "Guardando...";

        const {
            error
        } = await supabase
            .from("perfiles")
            .update({
                biografia:
                    nuevaBiografia ||
                    null
            })
            .eq(
                "id",
                usuarioActual.id
            );

        botonGuardarPerfil.disabled =
            false;

        botonGuardarPerfil.textContent =
            "Guardar cambios";

        if (error) {
            console.error(error);

            alert(
                "No se pudo guardar la biografía."
            );

            return;
        }

        biografiaUsuario.textContent =
            nuevaBiografia ||
            "Todavía no has agregado una biografía.";

        cerrarModalPerfil();
    }
);

/* =====================================================
   CERRAR SESIÓN
===================================================== */

botonCerrarSesion.addEventListener(
    "click",
    async () => {
        botonCerrarSesion.disabled =
            true;

        botonCerrarSesion.textContent =
            "Cerrando sesión...";

        const {
            error
        } = await supabase.auth.signOut();

        if (error) {
            console.error(error);

            botonCerrarSesion.disabled =
                false;

            botonCerrarSesion.textContent =
                "Cerrar sesión";

            return;
        }

        window.location.href = "/login";
    }
);

cargarPerfil();