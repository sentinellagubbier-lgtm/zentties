# ZENNTIES · Práctica 05 (Flask + MongoDB Atlas)

Catálogo CRUD (formularios + API JSON), tienda y carrito. Login/registro/perfil/comunidad usan Supabase en el navegador.

## Probar en local
```
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```
(Mac/Linux: `python3 -m venv .venv` y `.venv/bin/python ...`). Necesitas MongoDB local iniciado.
Abre http://127.0.0.1:5000 . En **Catálogo** pulsa «Cargar ejemplos». Prueba la API con `python probar_api.py`.

## 1. GitHub (repositorio nuevo y vacío, privado)
```
git init
git add .
git commit -m "ZENNTIES: catalogo, tienda, carrito y API"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/zennties.git
git remote -v
git push -u origin main
```

## 2. MongoDB Atlas
1. Database Access → Add New Database User: `zennties_app`, contraseña larga de letras y números, rol `readWrite` solo sobre la base `zennties`.
2. Connect → Drivers → Python: copia la URI y pon tu usuario y contraseña.
3. La base `zennties` aparece al guardar el primer documento (colecciones `productos` y `carrito`).

## 3. Render (New → Web Service)
- Repositorio: el nuevo, rama `main`. Language: Python 3.
- Build: `pip install -r requirements.txt`
- Start: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 60`
- Environment: `MONGO_URI` (URI de Atlas) y `SECRET_KEY` (cadena larga aleatoria).
- Connect → Outbound: agrega esos rangos de IP en Atlas → Network Access.

## Supabase
Las claves públicas (publishable) están en `static/js/supabase-browser.js`. No pongas claves secretas en el código.
