import { supabase } from "./supabase-browser.js";

const formulario = document.querySelector("#form-registro");
const nombreUsuarioInput = document.querySelector("#nombreUsuario");
const correoInput = document.querySelector("#correo");
const contrasenaInput = document.querySelector("#contrasena");
const confirmarContrasenaInput =
    document.querySelector("#confirmarContrasena");
const botonRegistro = document.querySelector("#botonRegistro");
const mensajeRegistro = document.querySelector("#mensajeRegistro");

function mostrarMensaje(texto, tipo = "error") {
    mensajeRegistro.textContent = texto;
    mensajeRegistro.dataset.tipo = tipo;
}

function nombreUsuarioValido(nombre) {
    const expresion = /^[a-zA-Z0-9._]{3,30}$/;
    return expresion.test(nombre);
}

formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    mensajeRegistro.textContent = "";

    const nombreUsuario = nombreUsuarioInput.value.trim();
    const correo = correoInput.value.trim().toLowerCase();
    const contrasena = contrasenaInput.value;
    const confirmarContrasena = confirmarContrasenaInput.value;

    if (!nombreUsuarioValido(nombreUsuario)) {
        mostrarMensaje(
            "El nombre debe tener entre 3 y 30 caracteres. Solo puede contener letras, números, puntos y guiones bajos."
        );
        return;
    }

    if (contrasena.length < 8) {
        mostrarMensaje(
            "La contraseña debe tener al menos 8 caracteres."
        );
        return;
    }

    if (contrasena !== confirmarContrasena) {
        mostrarMensaje("Las contraseñas no coinciden.");
        return;
    }

    botonRegistro.disabled = true;
    botonRegistro.textContent = "Creando cuenta...";

    try {
        const { data, error } = await supabase.auth.signUp({
            email: correo,
            password: contrasena,
            options: {
                data: {
                    nombre_usuario: nombreUsuario
                },
                emailRedirectTo:
                    `${window.location.origin}/login`
            }
        });

        if (error) {
            throw error;
        }

        if (data.session) {
            mostrarMensaje(
                "Cuenta creada correctamente.",
                "exito"
            );

            setTimeout(() => {
                window.location.href = "/tienda";
            }, 1000);

            return;
        }

        mostrarMensaje(
            "Cuenta creada. Revisa tu correo para confirmarla.",
            "exito"
        );

        formulario.reset();

    } catch (error) {
        console.error(error);

        const mensaje = error.message?.toLowerCase() || "";

        if (mensaje.includes("already registered")) {
            mostrarMensaje(
                "Este correo ya tiene una cuenta."
            );
        } else if (
            mensaje.includes("duplicate") ||
            mensaje.includes("unique")
        ) {
            mostrarMensaje(
                "Ese nombre de usuario ya está ocupado."
            );
        } else if (
            mensaje.includes("database error saving new user")
        ) {
            mostrarMensaje(
                "Supabase no pudo crear el perfil. Revisa el código SQL."
            );
        } else {
            mostrarMensaje(
                error.message ||
                "No se pudo crear la cuenta."
            );
        }

    } finally {
        botonRegistro.disabled = false;
        botonRegistro.textContent = "Crear Cuenta";
    }
});