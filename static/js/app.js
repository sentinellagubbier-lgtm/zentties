/* ZENNTIES · interacciones de la tienda, el carrito y el catálogo */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- Avisos ---------- */
  function zona() {
    let z = $(".zn-toast-zone");
    if (!z) {
      z = document.createElement("div");
      z.className = "zn-toast-zone";
      z.setAttribute("role", "status");
      z.setAttribute("aria-live", "polite");
      document.body.appendChild(z);
    }
    return z;
  }
  function aviso(texto, tipo = "ok") {
    const t = document.createElement("div");
    t.className = "zn-toast" + (tipo === "error" ? " error" : "");
    t.textContent = texto;
    zona().appendChild(t);
    setTimeout(() => {
      t.classList.add("leaving");
      setTimeout(() => t.remove(), 320);
    }, 2800);
  }

  /* ---------- Contador del carrito ---------- */
  function actualizarContador(total) {
    const c = $("#contadorCarrito");
    if (!c) return;
    c.textContent = total;
    c.classList.toggle("is-empty", total === 0);
    c.classList.remove("bump");
    void c.offsetWidth;
    if (total > 0) c.classList.add("bump");
  }

  async function api(metodo, ruta, datos) {
    const r = await fetch(ruta, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: datos ? JSON.stringify(datos) : undefined,
    });
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(cuerpo.error || "No se pudo completar la acción.");
    return cuerpo;
  }

  /* ---------- Tienda: agregar al carrito ---------- */
  $$("[data-agregar]").forEach((boton) => {
    boton.addEventListener("click", async () => {
      boton.disabled = true;
      try {
        const datos = await api("POST", "/api/carrito", { producto_id: boton.dataset.agregar, cantidad: 1 });
        actualizarContador(datos.total);
        const linea = datos.lineas.find((l) => l.producto_id === boton.dataset.agregar);
        const marca = boton.closest(".zn-product")?.querySelector(".zn-in-cart");
        if (marca && linea) marca.textContent = `En tu carrito: ${linea.cantidad}`;
        aviso(`Agregado: ${boton.dataset.nombre}`);
      } catch (e) {
        aviso(e.message, "error");
      } finally {
        boton.disabled = false;
      }
    });
  });

  /* ---------- Tienda: filtros y búsqueda ---------- */
  const tarjetas = $$("[data-producto]");
  if (tarjetas.length) {
    let categoria = "todos";
    const buscador = $("#buscar");
    const vacio = $("#sinResultados");
    const aplicar = () => {
      const q = (buscador?.value || "").trim().toLowerCase();
      let visibles = 0;
      tarjetas.forEach((t) => {
        const ok = (categoria === "todos" || t.dataset.cat === categoria) &&
                   (!q || t.dataset.nombre.includes(q));
        t.hidden = !ok;
        if (ok) visibles++;
      });
      if (vacio) vacio.hidden = visibles !== 0;
    };
    $$("[data-filtro]").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("[data-filtro]").forEach((c) => { c.classList.remove("active"); c.setAttribute("aria-pressed", "false"); });
        chip.classList.add("active");
        chip.setAttribute("aria-pressed", "true");
        categoria = chip.dataset.filtro;
        aplicar();
      });
    });
    buscador?.addEventListener("input", aplicar);
  }

  /* ---------- Inclinación suave de tarjetas (responde al puntero) ---------- */
  const fino = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (fino && !sinMovimiento) {
    $$(".zn-product").forEach((card) => {
      let frame = 0;
      card.addEventListener("pointermove", (e) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const r = card.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          card.style.transform = `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) translateY(-4px)`;
        });
      });
      card.addEventListener("pointerleave", () => {
        cancelAnimationFrame(frame);
        card.style.transform = "";
      });
    });
  }

  /* ---------- Carrito: cantidades, quitar, vaciar ---------- */
  const lista = $("#lineasCarrito");
  if (lista) {
    const max = Number(lista.dataset.max || 10);
    const resumen = (total) => {
      actualizarContador(total);
      const t = $("#totalArticulos");
      if (t) t.textContent = total;
    };
    const recargarSiVacio = (total) => { if (total === 0) setTimeout(() => location.reload(), 320); };

    $$("[data-qty]").forEach((boton) => {
      boton.addEventListener("click", async () => {
        const fila = boton.closest("[data-linea]");
        const salida = $("output", fila);
        const nueva = Number(salida.textContent) + Number(boton.dataset.qty);
        if (nueva < 1 || nueva > max) return;
        try {
          const datos = await api("PUT", `/api/carrito/${fila.dataset.linea}`, { cantidad: nueva });
          salida.textContent = nueva;
          $("[data-qty='-1']", fila).disabled = nueva <= 1;
          $("[data-qty='1']", fila).disabled = nueva >= max;
          resumen(datos.total);
        } catch (e) { aviso(e.message, "error"); }
      });
    });

    $$("[data-quitar]").forEach((boton) => {
      boton.addEventListener("click", async () => {
        const fila = boton.closest("[data-linea]");
        try {
          const datos = await api("DELETE", `/api/carrito/${fila.dataset.linea}`);
          fila.classList.add("removing");
          setTimeout(() => fila.remove(), 300);
          resumen(datos.total);
          aviso("Producto quitado del carrito");
          recargarSiVacio(datos.total);
        } catch (e) { aviso(e.message, "error"); }
      });
    });

    $("#vaciar")?.addEventListener("click", async () => {
      try {
        const datos = await api("DELETE", "/api/carrito");
        resumen(datos.total);
        aviso("Carrito vaciado");
        setTimeout(() => location.reload(), 300);
      } catch (e) { aviso(e.message, "error"); }
    });
  }

  /* ---------- Catálogo: confirmación de borrado con modal de Bootstrap ---------- */
  const modalEl = $("#modalEliminar");
  if (modalEl && window.bootstrap) {
    const modal = new bootstrap.Modal(modalEl);
    $$("[data-eliminar]").forEach((b) => {
      b.addEventListener("click", () => {
        $("#nombreEliminar").textContent = b.dataset.nombre;
        $("#formEliminar").action = b.dataset.eliminar;
        modal.show();
      });
    });
  }

  /* ---------- Contador de caracteres ---------- */
  $$("[data-contar]").forEach((input) => {
    const salida = $(input.dataset.contar);
    if (!salida) return;
    const max = input.getAttribute("maxlength");
    const pintar = () => { salida.textContent = `${input.value.length}/${max}`; };
    input.addEventListener("input", pintar);
    pintar();
  });
})();
