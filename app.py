import os
import uuid
from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId
from flask import (
    Flask, abort, jsonify, redirect, render_template,
    request, session, url_for,
)
from pymongo import MongoClient
from pymongo.errors import PyMongoError

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "clave-solo-para-pruebas-locales")
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

# ---------------------------------------------------------------
# Base de datos (guía 05, paso 4)
# ---------------------------------------------------------------
mongo_uri = os.environ.get("MONGO_URI")
if not mongo_uri:
    if os.environ.get("RENDER"):
        raise RuntimeError("Configura MONGO_URI en Render.")
    mongo_uri = "mongodb://127.0.0.1:27017/"

cliente = MongoClient(mongo_uri, serverSelectionTimeoutMS=10000)
base_datos = cliente["zennties"]

# "alumnos" se conserva como nombre interno de la guía; la colección real
# es "productos". Así se reutilizan las rutas y plantillas ya probadas.
alumnos = base_datos["productos"]

# Colección extra para el carrito (un carrito por visitante).
carrito = base_datos["carrito"]

ESTADOS = ["Disponible", "Agotado"]
CATEGORIAS_SUGERIDAS = ["Páginas web", "Juegos", "Diseño de interfaz"]
MAX_POR_PRODUCTO = 10

EJEMPLOS = [
    ("Landing para cafetería", "Páginas web", "Disponible"),
    ("Portafolio de fotógrafo", "Páginas web", "Disponible"),
    ("Tienda en línea minimalista", "Páginas web", "Disponible"),
    ("Blog de recetas", "Páginas web", "Agotado"),
    ("Pixel Runner", "Juegos", "Disponible"),
    ("Memorama espacial", "Juegos", "Disponible"),
    ("Trivia galáctica", "Juegos", "Disponible"),
    ("Snake neón", "Juegos", "Agotado"),
    ("Kit de app bancaria", "Diseño de interfaz", "Disponible"),
    ("Dashboard oscuro", "Diseño de interfaz", "Disponible"),
    ("Pantallas de app fitness", "Diseño de interfaz", "Disponible"),
    ("Sistema de iconos", "Diseño de interfaz", "Agotado"),
]


# ---------------------------------------------------------------
# Validación (guía 05, paso 6)
# ---------------------------------------------------------------
def leer_formulario(datos=None):
    if datos is None:
        datos = request.form
    campos = ("nombre", "categoria", "estado")
    if any(not isinstance(datos.get(c, ""), str) for c in campos):
        abort(400, description="Los campos deben contener texto.")
    nombre = datos.get("nombre", "").strip()
    categoria = datos.get("categoria", "").strip()
    estado = datos.get("estado", "").strip()
    if not nombre or not categoria or not estado:
        abort(400, description="Completa nombre, categoría y estado.")
    if len(nombre) > 80 or len(categoria) > 20:
        abort(400, description="Máximo: nombre 80 y categoría 20.")
    if estado not in ESTADOS:
        abort(400, description="Selecciona un estado válido.")
    return {"nombre": nombre, "categoria": categoria, "estado": estado}


def buscar_alumno(id):
    try:
        oid = ObjectId(id)
    except (InvalidId, TypeError):
        abort(404, description="La clave del producto no es válida.")
    producto = alumnos.find_one({"_id": oid})
    if producto is None:
        abort(404, description="Este producto ya no existe.")
    return producto


# ---------------------------------------------------------------
# Páginas públicas y cuentas (el inicio de sesión usa Supabase en el navegador)
# ---------------------------------------------------------------
@app.route("/")
def portada():
    return render_template("portada.html")


@app.route("/login")
def login():
    return render_template("login.html")


@app.route("/register")
def register():
    return render_template("register.html")


@app.route("/comunidad")
def comunidad():
    return render_template("legacy/comunidad.html")


@app.route("/perfil")
def perfil():
    return render_template("legacy/perfil.html")


# ---------------------------------------------------------------
# Catálogo: CRUD por formularios (guía 05)
# ---------------------------------------------------------------
@app.route("/catalogo")
def inicio():
    lista = alumnos.find().sort("nombre", 1)
    return render_template(
        "index.html",
        alumnos=list(lista),
        estados=ESTADOS,
        categorias=CATEGORIAS_SUGERIDAS,
    )


@app.route("/agregar", methods=["POST"])
def agregar():
    alumnos.insert_one(leer_formulario())
    return redirect(url_for("inicio") + "#lista")


@app.route("/editar/<id>", methods=["GET", "POST"])
def editar(id):
    alumno = buscar_alumno(id)
    if request.method == "POST":
        alumnos.update_one({"_id": alumno["_id"]}, {"$set": leer_formulario()})
        return redirect(url_for("inicio") + "#lista")
    return render_template(
        "editar.html", alumno=alumno, estados=ESTADOS,
        categorias=CATEGORIAS_SUGERIDAS,
    )


@app.route("/eliminar/<id>", methods=["POST"])
def eliminar(id):
    alumno = buscar_alumno(id)
    alumnos.delete_one({"_id": alumno["_id"]})
    carrito.delete_many({"producto_id": str(alumno["_id"])})
    return redirect(url_for("inicio") + "#lista")


@app.route("/semilla", methods=["POST"])
def semilla():
    """Carga productos ficticios sin duplicar los que ya existen."""
    existentes = {p["nombre"] for p in alumnos.find()}
    nuevos = [
        {"nombre": n, "categoria": c, "estado": e}
        for n, c, e in EJEMPLOS if n not in existentes
    ]
    if nuevos:
        alumnos.insert_many(nuevos)
    destino = request.form.get("volver", "")
    if destino == "tienda":
        return redirect(url_for("tienda"))
    return redirect(url_for("inicio") + "#lista")


@app.route("/ayuda")
def ayuda():
    fecha = datetime.now().strftime("%d/%m/%Y")
    return render_template("ayuda.html", fecha=fecha)


# ---------------------------------------------------------------
# Tienda y carrito (páginas)
# ---------------------------------------------------------------
def sesion_id():
    if "sid" not in session:
        session["sid"] = uuid.uuid4().hex
        session.permanent = True
    return session["sid"]


def lineas_carrito():
    """Líneas del carrito de este visitante, unidas al producto actual."""
    lineas = list(carrito.find({"sesion": sesion_id()}))
    resultado = []
    for linea in lineas:
        try:
            producto = alumnos.find_one({"_id": ObjectId(linea["producto_id"])})
        except (InvalidId, TypeError):
            producto = None
        if producto is None:
            carrito.delete_one({"_id": linea["_id"]})
            continue
        resultado.append({
            "id": str(linea["_id"]),
            "producto_id": linea["producto_id"],
            "nombre": producto["nombre"],
            "categoria": producto["categoria"],
            "estado": producto["estado"],
            "cantidad": linea["cantidad"],
        })
    resultado.sort(key=lambda x: x["nombre"].lower())
    return resultado


def total_articulos(lineas):
    return sum(x["cantidad"] for x in lineas)


@app.route("/tienda")
def tienda():
    productos = list(alumnos.find().sort("nombre", 1))
    en_carrito = {x["producto_id"]: x["cantidad"] for x in lineas_carrito()}
    categorias = sorted({p["categoria"] for p in productos})
    return render_template(
        "tienda.html", productos=productos, categorias=categorias,
        en_carrito=en_carrito,
    )


@app.route("/carrito")
def ver_carrito():
    lineas = lineas_carrito()
    return render_template(
        "carrito.html", lineas=lineas, total=total_articulos(lineas),
        maximo=MAX_POR_PRODUCTO,
    )


# ---------------------------------------------------------------
# API de productos (guía 05, pasos 10 a 13)
# ---------------------------------------------------------------
def producto_json(producto):
    return {
        "id": str(producto["_id"]),
        "nombre": producto["nombre"],
        "categoria": producto["categoria"],
        "estado": producto["estado"]
    }


def leer_json():
    datos = request.get_json(silent=True)
    if not isinstance(datos, dict):
        abort(400, description="Envía un objeto JSON válido.")
    return leer_formulario(datos)


@app.route("/api/productos", methods=["GET", "POST"])
def api_productos():
    if request.method == "POST":
        datos = leer_json()
        resultado = alumnos.insert_one(datos)
        producto = buscar_alumno(str(resultado.inserted_id))
        return jsonify(producto_json(producto)), 201
    lista = alumnos.find().sort("nombre", 1)
    return jsonify([producto_json(p) for p in lista])


@app.route("/api/productos/<id>", methods=["GET", "PUT", "DELETE"])
def api_producto(id):
    producto = buscar_alumno(id)
    if request.method == "PUT":
        datos = leer_json()
        alumnos.update_one({"_id": producto["_id"]}, {"$set": datos})
        return jsonify(producto_json(buscar_alumno(id)))
    if request.method == "DELETE":
        alumnos.delete_one({"_id": producto["_id"]})
        carrito.delete_many({"producto_id": str(producto["_id"])})
        return "", 204
    return jsonify(producto_json(producto))


# ---------------------------------------------------------------
# API del carrito: segunda colección para practicar el CRUD
#   GET    /api/carrito          consulta las líneas
#   POST   /api/carrito          agrega {"producto_id", "cantidad"}
#   PUT    /api/carrito/ID       cambia {"cantidad"}
#   DELETE /api/carrito/ID       quita una línea
#   DELETE /api/carrito          vacía el carrito
# ---------------------------------------------------------------
def leer_cantidad(datos, por_defecto=None):
    cantidad = datos.get("cantidad", por_defecto)
    if isinstance(cantidad, bool) or not isinstance(cantidad, int):
        abort(400, description="La cantidad debe ser un número entero.")
    if cantidad < 1 or cantidad > MAX_POR_PRODUCTO:
        abort(400, description=f"La cantidad va de 1 a {MAX_POR_PRODUCTO}.")
    return cantidad


def respuesta_carrito(codigo=200):
    lineas = lineas_carrito()
    return jsonify({"lineas": lineas, "total": total_articulos(lineas)}), codigo


def buscar_linea(id):
    try:
        oid = ObjectId(id)
    except (InvalidId, TypeError):
        abort(404, description="La línea del carrito no es válida.")
    linea = carrito.find_one({"_id": oid, "sesion": sesion_id()})
    if linea is None:
        abort(404, description="Esta línea ya no está en tu carrito.")
    return linea


@app.route("/api/carrito", methods=["GET", "POST", "DELETE"])
def api_carrito():
    if request.method == "DELETE":
        carrito.delete_many({"sesion": sesion_id()})
        return respuesta_carrito()

    if request.method == "POST":
        datos = request.get_json(silent=True)
        if not isinstance(datos, dict) or not isinstance(
                datos.get("producto_id"), str):
            abort(400, description="Envía producto_id y cantidad.")
        cantidad = leer_cantidad(datos, por_defecto=1)
        producto = buscar_alumno(datos["producto_id"])
        if producto["estado"] != "Disponible":
            abort(409, description="Este producto está agotado.")
        pid = str(producto["_id"])
        existente = carrito.find_one({"sesion": sesion_id(), "producto_id": pid})
        if existente:
            nueva = min(existente["cantidad"] + cantidad, MAX_POR_PRODUCTO)
            carrito.update_one({"_id": existente["_id"]},
                               {"$set": {"cantidad": nueva}})
        else:
            carrito.insert_one({
                "sesion": sesion_id(), "producto_id": pid, "cantidad": cantidad,
            })
        return respuesta_carrito(201)

    return respuesta_carrito()


@app.route("/api/carrito/<id>", methods=["PUT", "DELETE"])
def api_linea_carrito(id):
    linea = buscar_linea(id)
    if request.method == "PUT":
        datos = request.get_json(silent=True)
        if not isinstance(datos, dict):
            abort(400, description="Envía un objeto JSON válido.")
        cantidad = leer_cantidad(datos)
        carrito.update_one({"_id": linea["_id"]}, {"$set": {"cantidad": cantidad}})
        return respuesta_carrito()
    carrito.delete_one({"_id": linea["_id"]})
    return respuesta_carrito()


@app.template_filter("tipo")
def tipo_categoria(categoria):
    """Clasifica la categoría para elegir ilustración y color de la tarjeta."""
    c = (categoria or "").lower()
    if "web" in c or "página" in c or "pagina" in c or "sitio" in c:
        return "web"
    if "juego" in c or "game" in c:
        return "juego"
    if "interfaz" in c or "ui" in c.split() or "diseñ" in c or "disen" in c:
        return "ui"
    return "otro"


@app.context_processor
def datos_globales():
    """Contador del carrito para la barra de navegación."""
    try:
        total = total_articulos(lineas_carrito())
    except PyMongoError:
        total = 0
    return {"carrito_total": total, "anio": datetime.now().year}


# ---------------------------------------------------------------
# Respuestas de error (guía 05, paso 13)
# ---------------------------------------------------------------
@app.errorhandler(PyMongoError)
def error_mongo(error):
    mensaje = "No fue posible conectar con la base de datos."
    if request.path.startswith("/api/"):
        return jsonify({"error": mensaje}), 503
    return render_template("error.html", mensaje=mensaje), 503


@app.errorhandler(400)
@app.errorhandler(404)
@app.errorhandler(405)
@app.errorhandler(409)
def error_peticion(error):
    if request.path.startswith("/api/"):
        return jsonify({"error": error.description}), error.code
    return render_template(
        "error.html", mensaje=error.description
    ), error.code


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
