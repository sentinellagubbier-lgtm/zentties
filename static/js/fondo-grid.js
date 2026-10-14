/* =====================================================================
   Fondo de cuadrícula de ZENNTIES (canvas único)
   Antes: cientos de <div> con box-shadow y filter animados (lento).
   Ahora: un solo <canvas>. La cuadrícula base se dibuja una vez en un
   lienzo auxiliar y en cada cuadro solo se pintan las celdas encendidas.
   Patrones: círculos, diagonal, onda, letra Z, corazón y tablero.
   ===================================================================== */
(() => {
  const canvas = document.getElementById("fondoGrid");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const reducirMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const PALETAS = [
    [[151, 71, 255], [255, 65, 180]],
    [[31, 136, 255], [87, 245, 255]],
    [[255, 55, 120], [255, 156, 54]],
    [[36, 220, 160], [59, 130, 246]],
    [[179, 62, 255], [255, 225, 70]],
  ];

  let ancho = 0, alto = 0, dpr = 1;
  let celda = 56, hueco = 5, paso = 61;
  let cols = 0, filas = 0;
  let energia = new Float32Array(0);
  let sostenida = new Uint8Array(0);     // celdas que se mantienen encendidas mientras dura el patrón
  let sostener = 0, liberada = false;
  let base = null;                       // cuadrícula apagada, dibujada una vez
  let ignitions = [];                    // {t, i} ordenadas por tiempo
  let puntero = 0;                       // siguiente ignición por procesar
  let tPatron = 0;                       // segundos desde que empezó el patrón
  let finPatron = 0;
  let pausa = 0;
  let indicePatron = -1;
  let paleta = PALETAS[0];
  let paletaDestino = PALETAS[PALETAS.length - 1];   // el primer patrón usa violeta y magenta
  let mezclaPaleta = 1;
  let ultimo = 0;
  let raf = 0;
  let cursor = { x: -999, y: -999, activo: false };

  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Tamaño y cuadrícula base ---------- */
  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    ancho = window.innerWidth;
    alto = window.innerHeight;
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);

    celda = ancho < 640 ? 38 : 56;
    hueco = ancho < 640 ? 4 : 5;
    paso = celda + hueco;
    cols = Math.ceil(ancho / paso) + 1;
    filas = Math.ceil(alto / paso) + 1;
    energia = new Float32Array(cols * filas);
    sostenida = new Uint8Array(cols * filas);

    base = document.createElement("canvas");
    base.width = canvas.width;
    base.height = canvas.height;
    const b = base.getContext("2d");
    b.scale(dpr, dpr);

    const fondo = b.createRadialGradient(ancho / 2, alto / 2, 0, ancho / 2, alto / 2, Math.max(ancho, alto) * 0.75);
    fondo.addColorStop(0, "#12152e");
    fondo.addColorStop(1, "#04050c");
    b.fillStyle = fondo;
    b.fillRect(0, 0, ancho, alto);

    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < cols; c++) {
        const x = c * paso + hueco;
        const y = f * paso + hueco;
        trazarCelda(b, x, y, celda, 8);
        b.fillStyle = "rgba(20, 23, 48, 0.55)";
        b.fill();
        b.strokeStyle = "rgba(255, 255, 255, 0.035)";
        b.lineWidth = 1;
        b.stroke();
      }
    }
  }

  function trazarCelda(c, x, y, s, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, s, s, r);
    else c.rect(x, y, s, s);
  }

  /* ---------- Patrones ----------
     Cada patrón devuelve, para cada celda, null (no se enciende) o el
     retraso en segundos con el que se enciende. */
  const centroC = () => cols / 2;
  const centroF = () => filas / 2;

  const patrones = [
    function circulos() {
      const ox = Math.random() * cols, oy = Math.random() * filas;
      return (c, f) => {
        const d = Math.hypot(c - ox, f - oy);
        return Math.floor(d / 3) % 3 === 0 ? d * 0.045 : null;
      };
    },
    function diagonal() {
      return (c, f) => ((c + f) % 7 < 2 ? (c + f) * 0.035 : null);
    },
    function onda() {
      const amp = filas * 0.28, fase = Math.random() * 6;
      return (c, f) => {
        const y = filas / 2 + Math.sin(c * 0.38 + fase) * amp;
        return Math.abs(f - y) < 1.6 ? c * 0.04 : null;
      };
    },
    function letraZ() {
      const lado = Math.min(cols, filas) * 0.72;
      const c0 = centroC() - lado / 2, f0 = centroF() - lado / 2;
      const grosor = Math.max(1.6, lado * 0.16);
      return (c, f) => {
        const x = (c - c0) / lado, y = (f - f0) / lado;   // 0..1
        if (x < 0 || x > 1 || y < 0 || y > 1) return null;
        const arriba = y < grosor / lado;
        const abajo = y > 1 - grosor / lado;
        const diag = Math.abs(x - (1 - y)) < (grosor / lado) * 0.85;
        if (!(arriba || abajo || diag)) return null;
        return y * 1.4 + x * 0.35;
      };
    },
    function corazon() {
      const escala = Math.min(cols, filas) * 0.36;
      return (c, f) => {
        const x = (c - centroC()) / escala;
        const y = -(f - centroF() + 0.6) / escala;
        const v = Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y;
        return v <= 0 ? Math.hypot(x, y) * 0.9 : null;
      };
    },
    function tablero() {
      const radio = Math.min(cols, filas) * 0.55;
      return (c, f) => {
        const d = Math.hypot(c - centroC(), f - centroF());
        return d < radio && (c + f) % 2 === 0 ? d * 0.06 : null;
      };
    },
  ];

  const INDICE_Z = 3;

  function nuevoPatron(forzado) {
    indicePatron = typeof forzado === "number"
      ? forzado
      : (indicePatron + 1 + Math.floor(Math.random() * (patrones.length - 1))) % patrones.length;
    const regla = patrones[indicePatron]();
    ignitions = [];
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < cols; c++) {
        const retraso = regla(c, f);
        if (retraso !== null) ignitions.push({ t: retraso, i: f * cols + c });
      }
    }
    ignitions.sort((a, b) => a.t - b.t);
    puntero = 0;
    tPatron = 0;
    finPatron = ignitions.length ? ignitions[ignitions.length - 1].t : 0;
    pausa = 0;
    sostener = 0;
    liberada = false;
    sostenida.fill(0);
    paletaDestino = PALETAS[(PALETAS.indexOf(paletaDestino) + 1) % PALETAS.length];
    mezclaPaleta = 0;
  }

  /* ---------- Bucle de dibujo ---------- */
  function cuadro(ahora) {
    raf = requestAnimationFrame(cuadro);
    const dt = Math.min((ahora - ultimo) / 1000 || 0.016, 0.05);
    ultimo = ahora;

    // Avanza el patrón
    if (tPatron <= finPatron) {
      tPatron += dt;
      while (puntero < ignitions.length && ignitions[puntero].t <= tPatron) {
        energia[ignitions[puntero].i] = 1;
        sostenida[ignitions[puntero].i] = 1;
        puntero++;
      }
    } else if (sostener < 1.9) {
      sostener += dt;                       // el dibujo completo se queda visible
    } else {
      if (!liberada) { sostenida.fill(0); liberada = true; }
      pausa += dt;
      if (pausa > 1.2) nuevoPatron();
    }

    // Transición suave de paleta
    if (mezclaPaleta < 1) mezclaPaleta = Math.min(1, mezclaPaleta + dt * 0.9);
    const p1 = [0, 1].map((k) => paleta[k].map((v, j) => lerp(v, paletaDestino[k][j], mezclaPaleta)));
    if (mezclaPaleta === 1) paleta = paletaDestino;

    // Luz del cursor
    if (cursor.activo) {
      const cc = Math.floor(cursor.x / paso), ff = Math.floor(cursor.y / paso);
      for (let df = -1; df <= 1; df++) {
        for (let dc = -1; dc <= 1; dc++) {
          const c = cc + dc, f = ff + df;
          if (c < 0 || f < 0 || c >= cols || f >= filas) continue;
          const i = f * cols + c;
          const fuerza = dc === 0 && df === 0 ? 0.9 : 0.4;
          if (energia[i] < fuerza) energia[i] = fuerza;
        }
      }
    }

    // Fondo apagado (una sola copia)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(base, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Solo se pintan las celdas con energía
    const decaimiento = Math.exp(-dt * 1.9);
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < cols; c++) {
        const i = f * cols + c;
        let e = energia[i];
        if (e < 0.015) { energia[i] = 0; continue; }

        const t = (c / cols + f / filas) * 0.5 + 0.0;
        const r = lerp(p1[0][0], p1[1][0], t) | 0;
        const g = lerp(p1[0][1], p1[1][1], t) | 0;
        const b = lerp(p1[0][2], p1[1][2], t) | 0;

        const x = c * paso + hueco, y = f * paso + hueco;
        const crece = 0.92 + e * 0.08;
        const s = celda * crece;
        const o = (celda - s) / 2;

        if (e > 0.45) {                         // halo barato (sin shadowBlur)
          ctx.fillStyle = `rgba(${r},${g},${b},${(e - 0.45) * 0.22})`;
          trazarCelda(ctx, x - 5, y - 5, celda + 10, 14);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(${r},${g},${b},${0.12 + e * 0.58})`;
        trazarCelda(ctx, x + o, y + o, s, 8);
        ctx.fill();
        ctx.strokeStyle = `rgba(${r},${g},${b},${e * 0.9})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        e *= decaimiento;
        energia[i] = sostenida[i] && e < 0.55 ? 0.55 : e;
      }
    }
  }

  /* ---------- Eventos ---------- */
  let temporizadorResize = 0;
  window.addEventListener("resize", () => {
    clearTimeout(temporizadorResize);
    temporizadorResize = setTimeout(() => {
      medir();
      if (reducirMovimiento) pintarEstatico(); else nuevoPatron();
    }, 180);
  });
  window.addEventListener("pointermove", (e) => { cursor.x = e.clientX; cursor.y = e.clientY; cursor.activo = true; }, { passive: true });
  window.addEventListener("pointerleave", () => { cursor.activo = false; });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (!reducirMovimiento) { ultimo = performance.now(); raf = requestAnimationFrame(cuadro); }
  });

  function pintarEstatico() {
    nuevoPatron(INDICE_Z);
    ignitions.forEach(({ i }) => { energia[i] = 0.6; });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(base, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
      if (!energia[f * cols + c]) continue;
      trazarCelda(ctx, c * paso + hueco, f * paso + hueco, celda, 8);
      ctx.fillStyle = "rgba(151,71,255,0.45)";
      ctx.fill();
    }
  }

  medir();
  if (reducirMovimiento) {
    pintarEstatico();
  } else {
    nuevoPatron(INDICE_Z);   // empieza con la Z de ZENNTIES
    ultimo = performance.now();
    raf = requestAnimationFrame(cuadro);
  }
})();
