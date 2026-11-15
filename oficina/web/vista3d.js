/* Vista 3D de la oficina JH AUTOS (Three.js r128 + OrbitControls).
   Usa el mismo plano y la misma simulación de empleados que la vista en pixel art (window.JH). */
(function () {
  const THREE = window.THREE;
  const JH = window.JH;

  const C = {
    negro: 0x0c0c0d, grafito: 0x1c1c1e, pared: 0x2a2a2c, blanco: 0xf2f2f2, plata: 0xb4b7bb,
    vidrio: 0x9fb8c4, asfalto: 0x262628, oficina: 0xd6d7d9,
  };
  const PINTURA = { NEGRO: 0x141416, BLANCO: 0xeeeeee, PLATA: 0xb4b7bb };

  let renderer, scene, camera, controls, contenedor, raycaster, puntero;
  const personas = new Map();
  const pantallas = new Map();
  let iniciado = false, activo = false, reloj = 0, t0 = performance.now();

  const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7, metalness: 0.05 }, extra || {}));
  function caja(w, h, d, material, x, y, z, padre) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    (padre || scene).add(m); return m;
  }

  // ── Texturas con texto (Michroma para letreros, Open Sans para placas) ──
  function texturaTexto(texto, opts) {
    const o = Object.assign({ ancho: 512, alto: 128, fondo: "#000000", color: "#ffffff", fuente: "Michroma", tam: 54, borde: "#b4b7bb" }, opts || {});
    const c = document.createElement("canvas"); c.width = o.ancho; c.height = o.alto;
    const x = c.getContext("2d");
    x.fillStyle = o.fondo; x.fillRect(0, 0, o.ancho, o.alto);
    if (o.borde) { x.strokeStyle = o.borde; x.lineWidth = 4; x.strokeRect(2, 2, o.ancho - 4, o.alto - 4); }
    x.fillStyle = o.color; x.textAlign = "center"; x.textBaseline = "middle";
    x.font = `${o.tam}px "${o.fuente}", "Arial Black", sans-serif`;
    if (o.espaciado) { try { x.letterSpacing = o.espaciado; } catch (e) { /* navegadores sin soporte */ } }
    x.fillText(texto, o.ancho / 2, o.alto / 2 + 2);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; return t;
  }
  function letrero(texto, w, h, x, y, z, rotY, opts) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texturaTexto(texto, opts) }));
    m.position.set(x, y, z); m.rotation.y = rotY || 0; scene.add(m); return m;
  }

  // ── Piso pintado (asfalto, oficina, showroom, líneas de parqueo) ──
  function piso(plano) {
    const P = 32, c = document.createElement("canvas");
    c.width = plano.cols * P; c.height = plano.rows * P;
    const x = c.getContext("2d");
    for (let r = 0; r < plano.rows; r++) {
      for (let col = 0; col < plano.cols; col++) {
        const t = plano.suelo[r][col], px = col * P, py = r * P;
        if (t === "A" || t === "W" || t === "V") {
          x.fillStyle = "#252527"; x.fillRect(px, py, P, P);
          for (let i = 0; i < 8; i++) { x.fillStyle = Math.random() < 0.5 ? "#2e2e31" : "#1e1e20"; x.fillRect(px + Math.random() * P, py + Math.random() * P, 2, 2); }
        } else if (t === "S") {
          for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
            x.fillStyle = (i + j) % 2 ? "#2b2f33" : "#ececec"; x.fillRect(px + i * 16, py + j * 16, 16, 16);
          }
        } else {
          x.fillStyle = "#d6d7d9"; x.fillRect(px, py, P, P);
          x.fillStyle = "#bdbec1"; x.fillRect(px, py, P, 1); x.fillRect(px, py, 1, P);
        }
      }
    }
    x.fillStyle = "#e8e8e8";
    for (const m of plano.muebles) {
      if (m.t === "LINEA_PARQUEO_FRONT") x.fillRect(m.c * P + P / 2 - 2, m.r * P + 3, 4, 3 * P - 6);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter; tex.anisotropy = 4; tex.encoding = THREE.sRGBEncoding;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(plano.cols, plano.rows), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    m.rotation.x = -Math.PI / 2; m.position.set(plano.cols / 2, 0, plano.rows / 2); m.receiveShadow = true;
    scene.add(m);
    const borde = new THREE.Mesh(new THREE.PlaneGeometry(plano.cols + 40, plano.rows + 40), mat(0x0a0a0b));
    borde.rotation.x = -Math.PI / 2; borde.position.set(plano.cols / 2, -0.01, plano.rows / 2); scene.add(borde);
  }

  // ── Paredes y vidrio ──
  function paredes(plano) {
    const vidrioSet = new Set(plano.muebles.filter((m) => m.t === "VENTANAL").map((m) => m.c + "," + (m.r + 1)));
    const solido = mat(C.pared, { roughness: 0.9 });
    const tapa = mat(0x4a4b4f);
    const marco = mat(C.plata, { metalness: 0.6, roughness: 0.3 });
    const vidrio = new THREE.MeshPhysicalMaterial({ color: C.vidrio, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1 });
    const H = 1.6;
    for (let r = 0; r < plano.rows; r++) for (let c = 0; c < plano.cols; c++) {
      if (plano.suelo[r][c] !== "W") continue;
      const cx = c + 0.5, cz = r + 0.5;
      const interior = (c === 15 || c === 23 || c === 35) && r > 1 && r < 19;
      if (vidrioSet.has(c + "," + r) || interior) {
        caja(1, 0.08, 0.12, marco, cx, 0.04, cz);
        caja(1, 0.05, 0.12, marco, cx, H, cz);
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.98, H - 0.1, 0.05), vidrio);
        v.position.set(cx, H / 2, cz); scene.add(v);
      } else {
        caja(1, H, 1, solido, cx, H / 2, cz);
        caja(1, 0.04, 1, tapa, cx, H + 0.02, cz);
      }
    }
  }

  // ── Carros low-poly ──
  const MODELOS = {
    SEDAN: { L: 2.5, W: 1.45, h: 0.42, cab: { l: 1.25, z: -0.1, h: 0.4 } },
    CAMIONETA: { L: 2.65, W: 1.55, h: 0.58, cab: { l: 1.6, z: -0.2, h: 0.48 } },
    DEPORTIVO: { L: 2.45, W: 1.55, h: 0.34, cab: { l: 0.95, z: -0.15, h: 0.3 } },
    PICKUP: { L: 2.8, W: 1.55, h: 0.55, cab: { l: 0.95, z: 0.3, h: 0.48 }, platon: true },
  };
  function carro(modelo, pintura) {
    const d = MODELOS[modelo], g = new THREE.Group();
    const pin = new THREE.MeshPhysicalMaterial({ color: PINTURA[pintura], metalness: 0.55, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.15 });
    const vid = new THREE.MeshStandardMaterial({ color: 0x1a222c, metalness: 0.3, roughness: 0.1 });
    const negro = mat(0x080808, { roughness: 0.9 });
    const rueda = 0.28, base = rueda * 0.75;
    caja(d.W, d.h, d.L, pin, 0, base + d.h / 2, 0, g);
    caja(d.W - 0.24, d.cab.h, d.cab.l, vid, 0, base + d.h + d.cab.h / 2, d.cab.z, g);
    caja(d.W - 0.3, 0.05, d.cab.l - 0.18, pin, 0, base + d.h + d.cab.h + 0.02, d.cab.z, g);
    if (d.platon) {
      const zb = -d.L / 2 + 0.6;
      caja(d.W - 0.2, 0.06, 1.05, negro, 0, base + d.h + 0.02, zb, g);
      caja(0.08, 0.22, 1.1, pin, -d.W / 2 + 0.04, base + d.h + 0.1, zb, g);
      caja(0.08, 0.22, 1.1, pin, d.W / 2 - 0.04, base + d.h + 0.1, zb, g);
    }
    const geoR = new THREE.CylinderGeometry(rueda, rueda, 0.22, 16);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(geoR, negro); w.rotation.z = Math.PI / 2;
      w.position.set(sx * (d.W / 2 - 0.08), rueda, sz * d.L * 0.32); w.castShadow = true; g.add(w);
    }
    const faro = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 0.6 });
    const stop = new THREE.MeshStandardMaterial({ color: 0x8a1010, emissive: 0x6a0808, emissiveIntensity: 0.5 });
    for (const sx of [-1, 1]) {
      caja(0.3, 0.08, 0.04, faro, sx * (d.W / 2 - 0.25), base + d.h * 0.7, d.L / 2 + 0.01, g);
      caja(0.3, 0.08, 0.04, stop, sx * (d.W / 2 - 0.25), base + d.h * 0.7, -d.L / 2 - 0.01, g);
    }
    return g;
  }
  function ponerCarro(m) {
    const p = m.t.split("_"); // CARRO_MODELO_PINTURA_ORIENTACION
    const g = carro(p[1], p[2]);
    g.position.set(m.c + m.w / 2, 0, m.r + m.h / 2);
    g.rotation.y = p[3] === "BACK" ? Math.PI : p[3] === "FRONT" ? 0 : Math.PI / 2;
    scene.add(g);
  }

  // ── Vitrina con funda negra y moño ──
  function vitrina(m) {
    const cx = m.c + m.w / 2, cz = m.r + m.h / 2;
    const tarima = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 2.0, 0.22, 48), mat(0x222224, { roughness: 0.25, metalness: 0.3 }));
    tarima.position.set(cx, 0.11, cz); tarima.receiveShadow = true; tarima.castShadow = true; scene.add(tarima);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(1.97, 0.03, 8, 64), mat(C.plata, { metalness: 0.8, roughness: 0.2 }));
    aro.rotation.x = Math.PI / 2; aro.position.set(cx, 0.22, cz); scene.add(aro);
    const g = new THREE.Group(); g.position.set(cx, 0.22, cz); g.rotation.y = 0.5; scene.add(g);
    const funda = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.55, metalness: 0.1 });
    const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), funda);
    cuerpo.scale.set(0.82, 0.42, 1.4); cuerpo.position.y = 0.38; cuerpo.castShadow = true; g.add(cuerpo);
    const techo = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), funda);
    techo.scale.set(0.62, 0.38, 0.75); techo.position.set(0, 0.62, -0.1); techo.castShadow = true; g.add(techo);
    const cinta = mat(0xffffff, { roughness: 0.4 });
    const c1 = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 6, 48), cinta); c1.scale.set(0.84, 0.62, 1); c1.rotation.y = Math.PI / 2; c1.position.y = 0.42; g.add(c1);
    const c2 = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 6, 48), cinta); c2.scale.set(0.84, 0.62, 1); c2.position.set(0, 0.42, -0.1); g.add(c2);
    for (const s of [-1, 1]) {
      const lazo = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 20), cinta);
      lazo.scale.set(1.3, 0.75, 1); lazo.rotation.set(0.3, s * 0.6, s * 0.4); lazo.position.set(s * 0.2, 1.08, -0.1); g.add(lazo);
    }
    const nudo = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), cinta); nudo.position.set(0, 1.04, -0.1); g.add(nudo);
    const luz = new THREE.SpotLight(0xffffff, 0.9, 9, 0.5, 0.5); luz.position.set(cx, 5, cz); luz.target = tarima; scene.add(luz);
  }

  // ── Puestos de trabajo ──
  const NOMBRE_PLACA = {
    GERENTE: "GERENTE", SECRETARIA: "SECRETARIA", ESPIA: "ESPÍA", CREATIVO: "CREATIVO", GUIONISTA: "GUIONISTA",
    DISENADOR: "DISEÑADOR", ESTRATEGA_IG: "ESTRATEGA IG", INVENTARIO: "INVENTARIO", TASADOR: "TASADOR", CONTADOR: "CONTADOR", PAUTA: "PAUTA",
  };
  const ROL = {
    GERENTE: "gerente", SECRETARIA: "secretaria", ESPIA: "espia", CREATIVO: "creativo", GUIONISTA: "guionista", DISENADOR: "disenador",
    ESTRATEGA_IG: "estratega-instagram", INVENTARIO: "jefe-inventario", TASADOR: "tasador", CONTADOR: "contador", PAUTA: "estratega-pauta",
  };
  function escritorio(m) {
    const negro = mat(0x111112, { roughness: 0.35, metalness: 0.2 });
    const filo = mat(C.plata, { metalness: 0.7, roughness: 0.25 });
    const x0 = m.c, z0 = m.r, H = 0.46;
    caja(3.4, 0.05, 1.1, negro, x0 + 2, H, z0 + 0.95);
    caja(3.4, 0.012, 0.02, filo, x0 + 2, H + 0.03, z0 + 1.5);
    caja(3.4, H - 0.05, 0.04, negro, x0 + 2, (H - 0.05) / 2, z0 + 1.45);
    for (const sx of [-1.65, 1.65]) caja(0.06, H, 1.0, negro, x0 + 2 + sx, H / 2, z0 + 0.95);
  }
  function placa(m) {
    const clave = m.t.slice(6);
    const t = NOMBRE_PLACA[clave] || clave;
    letrero(t, 1.3, 0.2, m.c + 1.1, 0.3, m.r + 1.48, 0, { ancho: 512, alto: 80, fuente: "Open Sans", tam: 40, fondo: "#1a1a1a" });
  }
  function monitor(desk) {
    const x = desk.c + 2.4, z = desk.r + 0.75, H = 0.48;
    const negro = mat(0x0a0a0a, { roughness: 0.4 });
    caja(0.05, 0.16, 0.05, negro, x, H + 0.08, z);
    caja(0.62, 0.38, 0.04, negro, x, H + 0.34, z);
    const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.32), new THREE.MeshStandardMaterial({ color: 0x1a2028, emissive: 0x000000 }));
    pantalla.position.set(x, H + 0.34, z + 0.025); scene.add(pantalla);
    caja(0.5, 0.02, 0.16, mat(0x2a2a2c), x, H + 0.035, z + 0.38);
    return pantalla;
  }
  function silla(m) {
    const g = new THREE.Group(); g.position.set(m.c + 0.5, 0, m.r + 0.2); scene.add(g);
    const n = mat(0x141415, { roughness: 0.6 });
    caja(0.42, 0.06, 0.42, n, 0, 0.27, 0, g);
    caja(0.42, 0.42, 0.06, n, 0, 0.52, 0.2, g);
    caja(0.04, 0.24, 0.04, mat(C.plata, { metalness: 0.7 }), 0, 0.12, 0, g);
  }

  function planta(m, alta) {
    const x = m.c + 0.5, z = m.r + m.h - 0.5;
    const maceta = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.34, 12), mat(0x151516));
    maceta.position.set(x, 0.17, z); maceta.castShadow = true; scene.add(maceta);
    const hoja = mat(0x2f6b3a, { roughness: 0.9, flatShading: true });
    const n = alta ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(alta ? 0.34 : 0.26, 0), hoja);
      b.position.set(x + (Math.random() - 0.5) * 0.2, 0.45 + i * 0.25, z + (Math.random() - 0.5) * 0.2); b.castShadow = true; scene.add(b);
    }
  }

  function letreroEntrada(m) {
    const cx = m.c + m.w / 2, z = m.r + 1.6;
    const plata = mat(C.plata, { metalness: 0.75, roughness: 0.25 });
    for (const s of [-1, 1]) caja(0.12, 1.5, 0.12, plata, cx + s * 2.2, 0.75, z);
    caja(5.2, 1.2, 0.14, mat(0x000000), cx, 1.9, z);
    letrero("JH AUTOS", 5.0, 1.0, cx, 1.9, z + 0.075, 0, { ancho: 1024, alto: 200, tam: 104, espaciado: "12px" });
    letrero("JH AUTOS", 5.0, 1.0, cx, 1.9, z - 0.075, Math.PI, { ancho: 1024, alto: 200, tam: 104, espaciado: "12px" });
  }

  function construir(plano) {
    piso(plano);
    paredes(plano);
    const escritorios = plano.muebles.filter((m) => m.t === "ESCRITORIO_JH");
    for (const m of plano.muebles) {
      if (m.t.startsWith("CARRO_")) ponerCarro(m);
      else if (m.t === "VITRINA_FUNDA") vitrina(m);
      else if (m.t === "ESCRITORIO_JH") escritorio(m);
      else if (m.t.startsWith("PLACA_")) {
        placa(m);
        const desk = escritorios.find((d) => d.c === m.c && d.r === m.r - 1);
        if (desk) pantallas.set(ROL[m.t.slice(6)], monitor(desk));
      } else if (m.t === "CUSHIONED_CHAIR_BACK") silla(m);
      else if (m.t === "PLANT" || m.t === "PLANT_2") planta(m, false);
      else if (m.t === "LARGE_PLANT") planta(m, true);
      else if (m.t === "LETRERO_JH_AUTOS") letreroEntrada(m);
      else if (m.t === "LOGO_PARED_JH") letrero("JH AUTOS", 3.6, 0.6, m.c + 2, 1.15, 2.01, 0, { ancho: 768, alto: 128, tam: 66, espaciado: "8px" });
      else if (m.t.startsWith("ZONA_")) {
        const txt = { ZONA_GERENCIA: "GERENCIA", ZONA_CONTENIDO: "CONTENIDO", ZONA_OPERACION: "OPERACIÓN" }[m.t];
        letrero(txt, 2.4, 0.4, m.c + 1.5, 1.2, 2.01, 0, { ancho: 640, alto: 106, tam: 44, espaciado: "6px" });
      } else if (m.t === "WHITEBOARD") {
        caja(1.6, 0.9, 0.04, mat(0xf4f4f4), m.c + 1, 1.0, 2.03);
      } else if (m.t === "SOFA_FRONT") {
        const s = mat(0x2c2c2f, { roughness: 0.95 });
        caja(3.4, 0.3, 0.8, s, m.c + 2, 0.2, m.r + 1.2); caja(3.4, 0.5, 0.2, s, m.c + 2, 0.45, m.r + 0.9);
      } else if (m.t === "COFFEE_TABLE") {
        caja(2.2, 0.06, 0.9, mat(0x0d0d0e, { roughness: 0.3 }), m.c + 1.5, 0.3, m.r + 1); caja(2.0, 0.28, 0.7, mat(0x0d0d0e), m.c + 1.5, 0.14, m.r + 1);
      }
    }
  }

  // ── Personas ──
  function persona(p) {
    const g = new THREE.Group();
    const piel = mat(p.piel), camisa = mat(p.camisa), pant = mat(p.pantalon), pelo = mat(p.pelo, { roughness: 0.9 });
    const cadera = new THREE.Group(); cadera.position.y = 0.42; g.add(cadera);
    const piernas = [];
    for (const s of [-1, 1]) {
      const pivote = new THREE.Group(); pivote.position.set(s * 0.08, 0, 0); cadera.add(pivote);
      caja(0.12, 0.42, 0.14, pant, 0, -0.21, 0, pivote);
      caja(0.13, 0.06, 0.2, mat(0x0a0a0a), 0, -0.41, 0.03, pivote);
      piernas.push(pivote);
    }
    caja(0.34, 0.38, 0.2, camisa, 0, 0.2, 0, cadera);
    const brazos = [];
    for (const s of [-1, 1]) {
      const pivote = new THREE.Group(); pivote.position.set(s * 0.22, 0.36, 0); cadera.add(pivote);
      caja(0.09, 0.32, 0.1, camisa, 0, -0.16, 0, pivote);
      caja(0.08, 0.08, 0.08, piel, 0, -0.34, 0, pivote);
      brazos.push(pivote);
    }
    const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), piel);
    cabeza.position.y = 0.55; cabeza.castShadow = true; cadera.add(cabeza);
    const gorro = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), pelo);
    gorro.position.y = 0.57; gorro.rotation.x = -0.25; cadera.add(gorro);
    if (p.largo) caja(0.26, 0.26, 0.08, pelo, 0, 0.47, -0.1, cadera);
    const globo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaTexto("!", { ancho: 128, alto: 128, fondo: "#e8c46a", color: "#000000", fuente: "Open Sans", tam: 96, borde: null }) }));
    globo.scale.set(0.28, 0.28, 1); globo.position.y = 1.25; globo.visible = false; g.add(globo);
    const etiqueta = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaTexto(p.nombre, { ancho: 512, alto: 96, fondo: "#ffffff", color: "#000000", fuente: "Open Sans", tam: 44, borde: null }), depthTest: false }));
    etiqueta.scale.set(1.2, 0.225, 1); etiqueta.position.y = 1.5; etiqueta.visible = false; etiqueta.renderOrder = 10; g.add(etiqueta);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.id = p.id; } });
    scene.add(g);
    return { g, cadera, piernas, brazos, globo, etiqueta };
  }

  function actualizarPersonas(dt) {
    const sel = JH.seleccion;
    for (const [id, g] of JH.gente) {
      let v = personas.get(id);
      if (!v) { v = persona(g.p); personas.set(id, v); v.prev = [g.x, g.y]; }
      const e = (JH.estados[id] || {}).estado || "libre";
      const x = g.x / 16, z = (g.y - 7) / 16;
      const dx = g.x - v.prev[0], dy = g.y - v.prev[1];
      v.prev = [g.x, g.y];
      if (g.sentado) {
        v.g.position.set(x, 0, z - 0.25);
        v.g.rotation.y = Math.PI;
        v.cadera.position.y = 0.3;
        v.piernas.forEach((p) => (p.rotation.x = -Math.PI / 2 + 0.1));
        const tec = e === "trabajando";
        v.brazos.forEach((b, i) => (b.rotation.x = tec ? -1.1 + Math.sin(reloj * 14 + i * 2) * 0.12 : -0.4));
      } else {
        v.g.position.set(x, 0, z);
        if (Math.abs(dx) + Math.abs(dy) > 0.01) v.g.rotation.y = Math.atan2(dx, dy);
        v.cadera.position.y = 0.42;
        const anda = g.ruta.length ? Math.sin(reloj * 10) * 0.5 : 0;
        v.piernas[0].rotation.x = anda; v.piernas[1].rotation.x = -anda;
        v.brazos[0].rotation.x = -anda * 0.7; v.brazos[1].rotation.x = anda * 0.7;
      }
      v.globo.visible = e === "esperando";
      v.globo.position.y = 1.25 + Math.sin(reloj * 4) * 0.04;
      v.etiqueta.visible = sel === id || mostrarNombres;
      const pant = pantallas.get(id);
      if (pant) {
        const on = g.sentado && e === "trabajando";
        pant.material.emissive.setHex(on ? 0x9fb8d0 : 0x000000);
        pant.material.emissiveIntensity = on ? 0.7 + Math.sin(reloj * 6) * 0.1 : 0;
      }
    }
  }

  let mostrarNombres = false;
  function cuadro(ahora) {
    if (!activo) return;
    const dt = Math.min(0.05, (ahora - t0) / 1000); t0 = ahora; reloj += dt;
    const w = contenedor.clientWidth, h = contenedor.clientHeight;
    if (renderer.domElement.width !== Math.round(w * renderer.getPixelRatio()) || renderer.domElement.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
    }
    mostrarNombres = camera.position.distanceTo(controls.target) < 9;
    actualizarPersonas(dt);
    if (seguir) {
      const g = JH.gente.get(seguir);
      if (g) {
        const objetivo = new THREE.Vector3(g.x / 16, 0.4, (g.y - 7) / 16);
        const d = objetivo.clone().sub(controls.target);
        controls.target.add(d.multiplyScalar(0.08)); camera.position.add(d);
        if (d.length() < 0.002) seguir = null;
      }
    }
    if (vuelo) {
      vuelo.t = Math.min(1, vuelo.t + dt * 2.2);
      const k = 1 - Math.pow(1 - vuelo.t, 3);
      controls.target.lerpVectors(vuelo.desdeT, vuelo.haciaT, k);
      camera.position.lerpVectors(vuelo.desdeC, vuelo.haciaC, k);
      if (vuelo.t >= 1) vuelo = null;
    }
    controls.update();
    if (pellizco && pellizco.ancla) {
      const p = suelo(pellizco.mx, pellizco.my);
      if (p) { const d = pellizco.ancla.clone().sub(p); d.y = 0; camera.position.add(d); controls.target.add(d); }
    }
    limitarMapa();
    renderer.render(scene, camera);
    requestAnimationFrame(cuadro);
  }

  let seguir = null, vuelo = null, pellizco = null;
  const plano0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Punto del piso que está bajo una posición de la pantalla
  function suelo(cx, cy) {
    const r = renderer.domElement.getBoundingClientRect();
    puntero.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(puntero, camera);
    const p = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plano0, p) ? p : null;
  }
  function limitarMapa() {
    const P = JH.plano, t = controls.target;
    const cx = Math.min(P.cols + 2, Math.max(-2, t.x)), cz = Math.min(P.rows + 2, Math.max(-2, t.z));
    const d = new THREE.Vector3(cx - t.x, 0, cz - t.z);
    if (d.lengthSq() > 0) { t.add(d); camera.position.add(d); }
  }
  // Acerca o aleja manteniendo fijo el punto del piso que está bajo el dedo o el mouse
  function zoomEn(cx, cy, factor) {
    const p = suelo(cx, cy); if (!p) return;
    const dist = camera.position.distanceTo(controls.target);
    const nueva = Math.max(controls.minDistance, Math.min(controls.maxDistance, dist / factor));
    const k = nueva / dist;
    camera.position.sub(p).multiplyScalar(k).add(p);
    controls.target.sub(p).multiplyScalar(k).add(p);
    controls.target.y = 0;
  }
  // Vuela suavemente hasta un punto del piso
  function volarA(p, distancia) {
    const dir = camera.position.clone().sub(controls.target);
    const d = Math.max(controls.minDistance, Math.min(dir.length(), distancia || dir.length()));
    vuelo = {
      t: 0, desdeT: controls.target.clone(), desdeC: camera.position.clone(),
      haciaT: new THREE.Vector3(p.x, 0, p.z), haciaC: new THREE.Vector3(p.x, 0, p.z).add(dir.setLength(d)),
    };
  }

  function enfocar(id) {
    const g = JH.gente.get(id); if (!g) return;
    seguir = id;
    const dist = camera.position.distanceTo(controls.target);
    if (dist > 9) {
      const dir = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target.clone().add(dir.multiplyScalar(7)));
    }
  }

  function iniciar(cont) {
    contenedor = cont;
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.domElement.setAttribute("aria-label", "Concesionario JH AUTOS en 3D con los empleados trabajando");
    renderer.domElement.style.touchAction = "none";
    cont.prepend(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0b);
    scene.fog = new THREE.Fog(0x0a0a0b, 40, 85);
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    camera.position.set(24, 26, 40);
    // Como un mapa: un dedo (o clic izquierdo) mueve la oficina, dos dedos hacen zoom y giran,
    // clic derecho gira. El zoom (rueda y pellizco) es nuestro para que acerque justo donde apuntas.
    controls = new THREE.MapControls(camera, renderer.domElement);
    controls.target.set(24, 0, 13);
    controls.enableDamping = true; controls.dampingFactor = 0.1;
    controls.maxPolarAngle = Math.PI * 0.47; controls.minDistance = 2.5; controls.maxDistance = 75;
    controls.screenSpacePanning = false; controls.enableZoom = false;
    controls.panSpeed = 1.2; controls.rotateSpeed = 0.6;
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    controls.addEventListener("start", () => { seguir = null; vuelo = null; });

    const el = renderer.domElement;
    el.addEventListener("wheel", (e) => {
      e.preventDefault(); seguir = null; vuelo = null;
      zoomEn(e.clientX, e.clientY, Math.pow(1.0012, -Math.max(-300, Math.min(300, e.deltaY))));
    }, { passive: false });
    const toques = new Map();
    const medio = () => { const [a, b] = [...toques.values()]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.hypot(a[0] - b[0], a[1] - b[1])]; };
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch") return;
      toques.set(e.pointerId, [e.clientX, e.clientY]);
      if (toques.size === 2) { const [mx, my, d] = medio(); pellizco = { mx, my, d, ancla: suelo(mx, my) }; }
    });
    el.addEventListener("pointermove", (e) => {
      if (!toques.has(e.pointerId)) return;
      toques.set(e.pointerId, [e.clientX, e.clientY]);
      if (toques.size === 2 && pellizco) {
        const [mx, my, d] = medio();
        if (pellizco.d > 0 && d > 0) {
          const dist = camera.position.distanceTo(controls.target);
          const nueva = Math.max(controls.minDistance, Math.min(controls.maxDistance, dist * (pellizco.d / d)));
          camera.position.sub(controls.target).setLength(nueva).add(controls.target);
        }
        pellizco.mx = mx; pellizco.my = my; pellizco.d = d;
      }
    });
    const fin = (e) => { toques.delete(e.pointerId); if (toques.size < 2) pellizco = null; };
    el.addEventListener("pointerup", fin); el.addEventListener("pointercancel", fin);
    // Doble toque o doble clic: acercarse justo ahí
    let ultimoToque = 0, ultimoXY = [0, 0];
    el.addEventListener("pointerup", (e) => {
      const ahora = performance.now();
      if (ahora - ultimoToque < 320 && Math.hypot(e.clientX - ultimoXY[0], e.clientY - ultimoXY[1]) < 30) {
        const p = suelo(e.clientX, e.clientY);
        if (p) { seguir = null; volarA(p, camera.position.distanceTo(controls.target) * 0.45); }
        ultimoToque = 0;
      } else { ultimoToque = ahora; ultimoXY = [e.clientX, e.clientY]; }
    });

    scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a1c, 0.42));
    const sol = new THREE.DirectionalLight(0xffffff, 0.72);
    sol.position.set(10, 30, 22); sol.target.position.set(24, 0, 16); scene.add(sol.target);
    sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -32, right: 32, top: 26, bottom: -26, near: 1, far: 80 });
    sol.shadow.bias = -0.0008;
    scene.add(sol);
    const interior = new THREE.PointLight(0xffffff, 0.35, 30); interior.position.set(31, 6, 9); scene.add(interior);

    construir(JH.plano);

    raycaster = new THREE.Raycaster(); puntero = new THREE.Vector2();
    let abajo = null;
    renderer.domElement.addEventListener("pointerdown", (e) => { abajo = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener("pointerup", (e) => {
      if (!abajo || Math.hypot(e.clientX - abajo[0], e.clientY - abajo[1]) > 6) return;
      const r = renderer.domElement.getBoundingClientRect();
      puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(puntero, camera);
      const objs = []; personas.forEach((v) => v.g.traverse((o) => { if (o.isMesh) objs.push(o); }));
      const hit = raycaster.intersectObjects(objs, false)[0];
      JH.seleccionar(hit ? hit.object.userData.id : null, false);
    });
    iniciado = true;
  }

  window.Vista3D = {
    mostrar(cont) {
      if (!iniciado) iniciar(cont);
      activo = true; t0 = performance.now(); requestAnimationFrame(cuadro);
    },
    ocultar() { activo = false; },
    enfocar,
    acercar(f) {
      const r = renderer.domElement.getBoundingClientRect();
      seguir = null; vuelo = null;
      zoomEn(r.left + r.width / 2, r.top + r.height / 2, f);
    },
    todo() {
      seguir = null;
      vuelo = { t: 0, desdeT: controls.target.clone(), desdeC: camera.position.clone(), haciaT: new THREE.Vector3(24, 0, 13), haciaC: new THREE.Vector3(24, 26, 40) };
    },
  };
})();
