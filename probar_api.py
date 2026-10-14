"""Comprobador de la API (guía 05, paso 14). Se ejecuta aparte de app.py.

Uso local:   python probar_api.py
En línea:    BASE=https://tu-servicio.onrender.com python probar_api.py
"""
import json
import os
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE = os.environ.get("BASE", "http://127.0.0.1:5000")


def pedir(metodo, ruta, datos=None):
    cuerpo = None if datos is None else json.dumps(datos).encode()
    peticion = Request(
        BASE + ruta, data=cuerpo, method=metodo,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urlopen(peticion, timeout=30) as respuesta:
            texto = respuesta.read().decode()
            print(metodo, ruta, respuesta.status, texto)
            return json.loads(texto) if texto else None
    except HTTPError as error:
        print("Error:", error.code, error.read().decode())
        raise


producto = pedir("POST", "/api/productos", {
    "nombre": "Prueba API", "categoria": "Juegos",
    "estado": "Disponible"
})
ruta = "/api/productos/" + producto["id"]
pedir("GET", ruta)
pedir("PUT", ruta, {
    "nombre": "Prueba API", "categoria": "Juegos",
    "estado": "Agotado"
})
pedir("GET", "/api/productos")
pedir("DELETE", ruta)
