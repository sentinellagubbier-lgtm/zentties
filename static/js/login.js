import { supabase } from "./supabase-browser.js";

/* =========================================
   COMPROBAR SESIÓN EXISTENTE
========================================= */

async function comprobarSesionExistente() {
    const {
        data: { session },
        error
    } = await supabase.auth.getSession();

    if (error) {
        console.error(
            "Error al comprobar la sesión:",
            error
        );

        return;
    }

    if (session?.user) {
        window.location.href = "/tienda";
    }
}
await comprobarSesionExistente();
const formulario =
    document.querySelector("#form-login");

const correoInput =
    document.querySelector("#correoLogin");

const contrasenaInput =
    document.querySelector("#contrasenaLogin");

const botonLogin =
    document.querySelector("#botonLogin");

const mensajeLogin =
    document.querySelector("#mensajeLogin");

function mostrarMensaje(texto, tipo = "error") {
    mensajeLogin.textContent = texto;
    mensajeLogin.dataset.tipo = tipo;
}

formulario.addEventListener(
    "submit",
    async (evento) => {
        evento.preventDefault();

        const correo =
            correoInput.value
                .trim()
                .toLowerCase();

        const contrasena =
            contrasenaInput.value;

        botonLogin.disabled = true;
        botonLogin.textContent = "Ingresando...";

        mostrarMensaje(
            "Comprobando tus datos...",
            "informacion"
        );

        try {
            const { data, error } =
                await supabase.auth
                    .signInWithPassword({
                        email: correo,
                        password: contrasena
                    });

            if (error) {
                throw error;
            }

            if (!data.session) {
                throw new Error(
                    "No se pudo iniciar la sesión."
                );
            }

            mostrarMensaje(
                "Sesión iniciada correctamente.",
                "exito"
            );

            console.log(
                "Usuario conectado:",
                data.user
            );

            /*
             * Por ahora regresamos a la página principal.
             * Después cambiaremos esta ruta por el feed.
             */
             setTimeout(() => {
             window.location.href = "/tienda";
            }, 1000);

        } catch (error) {
            console.error(
                "Error al iniciar sesión:",
                error
            );

            const mensajeError =
                error?.message?.toLowerCase() || "";

            if (
                mensajeError.includes(
                    "invalid login credentials"
                )
            ) {
                mostrarMensaje(
                    "El correo o la contraseña son incorrectos."
                );

                return;
            }

            if (
                mensajeError.includes(
                    "email not confirmed"
                )
            ) {
                mostrarMensaje(
                    "Debes confirmar tu correo antes de iniciar sesión."
                );

                return;
            }

            mostrarMensaje(
                error?.message ||
                "No se pudo iniciar sesión."
            );

        } finally {
            botonLogin.disabled = false;
            botonLogin.textContent =
                "Iniciar Sesión";
        }
    }
);