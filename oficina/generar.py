"""Genera los sprites y el plano del concesionario JH AUTOS para Pixel Agents.

Uso:  python3 oficina/generar.py
Crea:
  oficina/jh-autos-assets/assets/furniture/<ITEM>/{manifest.json, *.png}
  oficina/layout-concesionario.json
"""
import json
import os
import shutil

from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
SALIDA = os.path.join(AQUI, "jh-autos-assets", "assets", "furniture")
LOGO = os.path.join(RAIZ, "logos", "jh-autos-logo-blanco-transparente.png")

# ── Colores de marca ──────────────────────────────────────────
NEGRO = (0, 0, 0, 255)
BLANCO = (255, 255, 255, 255)
PLATA = (180, 183, 187, 255)
GRAFITO = (26, 26, 26, 255)
GRIS = (138, 138, 138, 255)
T = (0, 0, 0, 0)

PINTURAS = {
    "NEGRO": dict(base=(30, 30, 32, 255), sombra=(14, 14, 15, 255), luz=(66, 67, 71, 255), borde=(0, 0, 0, 255)),
    "BLANCO": dict(base=(236, 236, 236, 255), sombra=(196, 197, 200, 255), luz=(255, 255, 255, 255), borde=(98, 99, 103, 255)),
    "PLATA": dict(base=(180, 183, 187, 255), sombra=(138, 141, 146, 255), luz=(218, 220, 223, 255), borde=(70, 72, 76, 255)),
}
VIDRIO = (40, 50, 62, 255)
VIDRIO_LUZ = (92, 110, 128, 255)
LLANTA = (12, 12, 12, 255)
FARO = (242, 242, 228, 255)
STOP = (150, 28, 28, 255)
SOMBRA = (0, 0, 0, 90)


# ── Utilidades ────────────────────────────────────────────────
def lienzo(w, h):
    return Image.new("RGBA", (w, h), T)


def rect(im, x0, y0, x1, y1, c):
    """Rectángulo lleno, coordenadas inclusivas."""
    for y in range(max(0, y0), min(im.height, y1 + 1)):
        for x in range(max(0, x0), min(im.width, x1 + 1)):
            im.putpixel((x, y), c)


def px(im, x, y, c):
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((x, y), c)


def guardar_item(item_id, nombre, categoria, sprites, **extra):
    """sprites: dict archivo -> Image. Escribe carpeta con manifest."""
    carpeta = os.path.join(SALIDA, item_id)
    os.makedirs(carpeta, exist_ok=True)
    for archivo, im in sprites.items():
        im.save(os.path.join(carpeta, archivo))
    manifest = {"id": item_id, "name": nombre, "category": categoria}
    manifest.update(extra)
    with open(os.path.join(carpeta, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)


def asset_simple(item_id, nombre, categoria, im, fw, fh, paredes=False, superficie=False, fondo=0):
    guardar_item(
        item_id, nombre, categoria, {f"{item_id}.png": im},
        type="asset", file=f"{item_id}.png", width=im.width, height=im.height,
        footprintW=fw, footprintH=fh, canPlaceOnWalls=paredes,
        canPlaceOnSurfaces=superficie, backgroundTiles=fondo,
    )


# ── Fuente de píxeles 3x5 (mayúsculas) ───────────────────────
FUENTE = {
    "A": ["010", "101", "111", "101", "101"], "B": ["110", "101", "110", "101", "110"],
    "C": ["011", "100", "100", "100", "011"], "D": ["110", "101", "101", "101", "110"],
    "E": ["111", "100", "110", "100", "111"], "F": ["111", "100", "110", "100", "100"],
    "G": ["011", "100", "101", "101", "011"], "H": ["101", "101", "111", "101", "101"],
    "I": ["111", "010", "010", "010", "111"], "J": ["001", "001", "001", "101", "010"],
    "L": ["100", "100", "100", "100", "111"], "M": ["101", "111", "111", "101", "101"],
    "N": ["101", "111", "111", "111", "101"], "O": ["010", "101", "101", "101", "010"],
    "P": ["110", "101", "110", "100", "100"], "R": ["110", "101", "110", "101", "101"],
    "S": ["011", "100", "010", "001", "110"], "T": ["111", "010", "010", "010", "010"],
    "U": ["101", "101", "101", "101", "111"], "V": ["101", "101", "101", "101", "010"],
    "Z": ["111", "001", "010", "100", "111"], " ": ["000", "000", "000", "000", "000"],
}
ACENTOS = {"Ñ": ("N", ["111"]), "Í": ("I", ["010"]), "Ó": ("O", ["010"])}


def ancho_texto(texto):
    return len(texto) * 4 - 1


def texto(im, x, y, cadena, c):
    for i, ch in enumerate(cadena):
        base, marca = ACENTOS.get(ch, (ch, None))
        glifo = FUENTE[base]
        ox = x + i * 4
        for fy, fila in enumerate(glifo):
            for fx, b in enumerate(fila):
                if b == "1":
                    px(im, ox + fx, y + fy, c)
        if marca:  # tilde una fila arriba
            for fx, b in enumerate(marca[0]):
                if b == "1":
                    px(im, ox + fx, y - 2, c)


# ── Carros vistos desde arriba (nariz hacia arriba) ──────────
# Cada modelo: (x0, x1) del cuerpo y tramos verticales.
MODELOS = {
    "SEDAN": dict(x=(5, 26), y=(3, 44), capo=(3, 14), parabrisas=(15, 19), techo=(20, 30), luneta=(31, 34), baul=(35, 44)),
    "CAMIONETA": dict(x=(4, 27), y=(3, 44), capo=(3, 11), parabrisas=(12, 16), techo=(17, 36), luneta=(37, 39), baul=(40, 44), barras=True),
    "DEPORTIVO": dict(x=(4, 27), y=(4, 44), capo=(4, 18), parabrisas=(19, 23), techo=(24, 29), luneta=(30, 33), baul=(34, 44), franja=True),
    "PICKUP": dict(x=(4, 27), y=(2, 45), capo=(2, 11), parabrisas=(12, 15), techo=(16, 23), luneta=(24, 25), platon=(27, 45)),
}


def carro(modelo, pintura):
    m = MODELOS[modelo]
    p = PINTURAS[pintura]
    im = lienzo(32, 48)
    x0, x1 = m["x"]
    y0, y1 = m["y"]
    # sombra sobre el asfalto
    rect(im, x0 + 1, y0 + 2, x1 + 1, y1 + 2, SOMBRA)
    # llantas (asoman a los lados)
    for (a, b) in [(y0 + 6, y0 + 11), (y1 - 11, y1 - 6)]:
        rect(im, x0 - 1, a, x0, b, LLANTA)
        rect(im, x1, a, x1 + 1, b, LLANTA)
    # carrocería
    rect(im, x0, y0, x1, y1, p["base"])
    # esquinas redondeadas
    for (cx, cy) in [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]:
        px(im, cx, cy, T)
    # borde
    for y in range(y0, y1 + 1):
        for x in (x0, x1):
            if im.getpixel((x, y))[3] == 255:
                px(im, x, y, p["borde"])
    for x in range(x0 + 1, x1):
        px(im, x, y0, p["borde"])
        px(im, x, y1, p["borde"])
    # sombra lateral derecha y luz izquierda (luz desde arriba a la izquierda)
    rect(im, x1 - 2, y0 + 2, x1 - 1, y1 - 2, p["sombra"])
    rect(im, x0 + 1, y0 + 2, x0 + 2, y1 - 2, p["luz"])
    # faros y stops
    rect(im, x0 + 2, y0 + 1, x0 + 4, y0 + 1, FARO)
    rect(im, x1 - 4, y0 + 1, x1 - 2, y0 + 1, FARO)
    rect(im, x0 + 2, y1 - 1, x0 + 4, y1 - 1, STOP)
    rect(im, x1 - 4, y1 - 1, x1 - 2, y1 - 1, STOP)
    # línea del capó
    cx = (x0 + x1) // 2
    a, b = m["capo"]
    for y in range(a + 3, b - 1):
        px(im, cx, y, p["sombra"])
    # parabrisas (trapecio)
    a, b = m["parabrisas"]
    for i, y in enumerate(range(a, b + 1)):
        rect(im, x0 + 3 - (i > 1), y, x1 - 3 + (i > 1), y, VIDRIO)
    px(im, x0 + 4, a + 1, VIDRIO_LUZ)
    px(im, x0 + 5, a + 1, VIDRIO_LUZ)
    px(im, x0 + 4, a + 2, VIDRIO_LUZ)
    # espejos
    px(im, x0 - 1, a + 1, p["borde"])
    px(im, x1 + 1, a + 1, p["borde"])
    # techo
    a, b = m["techo"]
    rect(im, x0 + 3, a, x1 - 3, b, p["base"])
    rect(im, x0 + 3, a, x0 + 4, b, p["luz"])
    rect(im, x1 - 4, a, x1 - 3, b, p["sombra"])
    # ventanas laterales
    rect(im, x0 + 1, a, x0 + 2, b, VIDRIO)
    rect(im, x1 - 2, a, x1 - 1, b, VIDRIO)
    if m.get("barras"):
        rect(im, x0 + 5, a + 1, x0 + 5, b - 1, GRIS)
        rect(im, x1 - 5, a + 1, x1 - 5, b - 1, GRIS)
    # luneta trasera
    a, b = m["luneta"]
    for i, y in enumerate(range(a, b + 1)):
        rect(im, x0 + 3 + (i >= 2), y, x1 - 3 - (i >= 2), y, VIDRIO)
    # baúl
    if "baul" in m:
        a, b = m["baul"]
        px(im, cx, a + 2, p["sombra"])
    # platón de pickup
    if "platon" in m:
        a, b = m["platon"]
        rect(im, x0 + 1, a - 1, x1 - 1, a - 1, p["borde"])
        rect(im, x0 + 3, a + 1, x1 - 3, b - 3, p["sombra"])
        for y in range(a + 3, b - 3, 3):
            rect(im, x0 + 4, y, x1 - 4, y, p["borde"])
    if m.get("franja"):
        franja = PLATA if pintura == "NEGRO" else GRAFITO
        for y in range(y0 + 2, y1 - 1):
            if im.getpixel((cx - 1, y))[:3] != VIDRIO[:3]:
                px(im, cx - 2, y, franja)
                px(im, cx + 2, y, franja)
    return im


def item_carro(modelo, pintura):
    base = carro(modelo, pintura)  # nariz arriba = "de espaldas"
    item_id = f"CARRO_{modelo}_{pintura}"
    nombres = {"SEDAN": "Sedán", "CAMIONETA": "Camioneta", "DEPORTIVO": "Deportivo", "PICKUP": "Pickup"}
    sprites = {
        f"{item_id}_BACK.png": base,
        f"{item_id}_FRONT.png": base.rotate(180),
        f"{item_id}_SIDE.png": base.rotate(-90, expand=True),
    }
    miembros = [
        dict(type="asset", id=f"{item_id}_FRONT", file=f"{item_id}_FRONT.png", width=32, height=48, footprintW=2, footprintH=3, orientation="front"),
        dict(type="asset", id=f"{item_id}_BACK", file=f"{item_id}_BACK.png", width=32, height=48, footprintW=2, footprintH=3, orientation="back"),
        dict(type="asset", id=f"{item_id}_SIDE", file=f"{item_id}_SIDE.png", width=48, height=32, footprintW=3, footprintH=2, orientation="side", mirrorSide=True),
    ]
    guardar_item(
        item_id, f"{nombres[modelo]} {pintura.lower()}", "decor", sprites,
        type="group", groupType="rotation", rotationScheme="3-way-mirror",
        canPlaceOnWalls=False, canPlaceOnSurfaces=False, backgroundTiles=0, members=miembros,
    )


# ── Línea de parqueo ─────────────────────────────────────────
def item_linea():
    v = lienzo(16, 48)
    rect(v, 7, 2, 8, 45, (232, 232, 232, 255))
    h = v.rotate(-90, expand=True)
    guardar_item(
        "LINEA_PARQUEO", "Línea de parqueo", "misc",
        {"LINEA_PARQUEO_FRONT.png": v, "LINEA_PARQUEO_SIDE.png": h},
        type="group", groupType="rotation", rotationScheme="2-way",
        canPlaceOnWalls=False, canPlaceOnSurfaces=False, backgroundTiles=0,
        members=[
            dict(type="asset", id="LINEA_PARQUEO_FRONT", file="LINEA_PARQUEO_FRONT.png", width=16, height=48, footprintW=1, footprintH=3, orientation="front"),
            dict(type="asset", id="LINEA_PARQUEO_SIDE", file="LINEA_PARQUEO_SIDE.png", width=48, height=16, footprintW=3, footprintH=1, orientation="side"),
        ],
    )


# ── Vitrina: tarima con carro bajo funda negra y moño ────────
def item_vitrina():
    im = lienzo(64, 64)
    # tarima: cara superior y frente
    rect(im, 2, 6, 61, 55, (44, 44, 46, 255))
    rect(im, 2, 56, 61, 61, (16, 16, 17, 255))
    for x in range(2, 62):
        px(im, x, 6, PLATA)
        px(im, x, 55, PLATA)
        px(im, x, 61, (90, 92, 96, 255))
    for y in range(6, 62):
        px(im, 2, y, PLATA)
        px(im, 61, y, PLATA)
    for (cx, cy) in [(2, 6), (61, 6), (2, 61), (61, 61)]:
        px(im, cx, cy, T)
    # brillo del piso de la tarima
    for i in range(0, 10):
        px(im, 6 + i, 10 + i, (64, 64, 67, 255))
    # carro cubierto (silueta redondeada)
    x0, x1, y0, y1 = 18, 45, 11, 51
    rect(im, x0 + 1, y0 + 2, x1 + 1, y1 + 2, SOMBRA)
    rect(im, x0, y0, x1, y1, (8, 8, 9, 255))
    for (cx, cy) in [(x0, y0), (x1, y0), (x0, y1), (x1, y1), (x0 + 1, y0), (x1 - 1, y0), (x0, y0 + 1), (x1, y0 + 1)]:
        px(im, cx, cy, T)
    # volumen del techo y pliegues de la funda
    rect(im, x0 + 4, y0 + 14, x1 - 4, y0 + 28, (22, 22, 24, 255))
    for y in range(y0 + 3, y1 - 2, 6):
        px(im, x0 + 2, y, (48, 48, 52, 255))
        px(im, x0 + 3, y + 1, (48, 48, 52, 255))
        px(im, x1 - 3, y + 2, (40, 40, 44, 255))
    rect(im, x0 + 1, y0 + 2, x0 + 1, y1 - 2, (36, 36, 40, 255))
    # cintas blancas en cruz
    cx, cy = (x0 + x1) // 2, y0 + 21
    rect(im, cx, y0, cx + 1, y1, BLANCO)
    rect(im, x0, cy, x1, cy + 1, BLANCO)
    # moño grande (B = blanco, P = plata para volumen)
    MONO = [
        "..BBBB.........BBBB..",
        ".BBPPBBB.....BBBPPBB.",
        "BBP...PBB...BBP...PBB",
        "BP......BB.BB......PB",
        "BP.......BBBB......PB",
        "BBP.....BBPPBB....PBB",
        ".BBPPPBBBPPPPBBBPPPBB",
        "..BBBBBBBPPPPBBBBBBB.",
        "........BBPPBB.......",
        ".......BBB..BBB......",
        "......BBB....BBB.....",
        ".....BBB......BBB....",
        "....BBB........BBB...",
    ]
    ox, oy = cx - 10, cy - 7
    for fy, fila in enumerate(MONO):
        for fx, ch in enumerate(fila):
            if ch == "B":
                px(im, ox + fx, oy + fy, BLANCO)
            elif ch == "P":
                px(im, ox + fx, oy + fy, PLATA)
    asset_simple("VITRINA_FUNDA", "Vitrina con funda y moño", "decor", im, 4, 4)


# ── Letrero JH AUTOS con el logo ─────────────────────────────
def logo_pixel(ancho):
    lg = Image.open(LOGO).convert("RGBA")
    lg = lg.crop(lg.getbbox())
    alto = max(1, round(lg.height * ancho / lg.width))
    peq = lg.resize((ancho, alto), Image.LANCZOS)
    out = lienzo(ancho, alto)
    for y in range(alto):
        for x in range(ancho):
            a = peq.getpixel((x, y))[3]
            if a > 70:
                out.putpixel((x, y), BLANCO)
    return out


def item_letrero():
    im = lienzo(96, 48)
    # postes plateados
    rect(im, 12, 26, 14, 45, PLATA)
    rect(im, 81, 26, 83, 45, PLATA)
    rect(im, 13, 26, 14, 45, (140, 143, 147, 255))
    rect(im, 82, 26, 83, 45, (140, 143, 147, 255))
    rect(im, 10, 45, 16, 46, (60, 60, 62, 255))
    rect(im, 79, 45, 85, 46, (60, 60, 62, 255))
    # panel negro con filete plata
    rect(im, 2, 4, 93, 28, NEGRO)
    for x in range(2, 94):
        px(im, x, 4, PLATA)
        px(im, x, 28, PLATA)
    for y in range(4, 29):
        px(im, 2, y, PLATA)
        px(im, 93, y, PLATA)
    lg = logo_pixel(80)
    im.alpha_composite(lg, (8, 16 - lg.height // 2))
    asset_simple("LETRERO_JH_AUTOS", "Letrero JH AUTOS", "decor", im, 6, 3)


def item_logo_pared():
    im = lienzo(64, 32)
    rect(im, 0, 8, 63, 23, NEGRO)
    for x in range(64):
        px(im, x, 8, PLATA)
        px(im, x, 23, PLATA)
    lg = logo_pixel(62)
    im.alpha_composite(lg, (1, 16 - lg.height // 2))
    asset_simple("LOGO_PARED_JH", "Logo JH AUTOS de pared", "wall", im, 4, 2, paredes=True)


# ── Escritorio negro de la marca ─────────────────────────────
def item_escritorio():
    im = lienzo(64, 32)
    rect(im, 0, 2, 63, 19, (20, 20, 21, 255))           # superficie
    rect(im, 0, 20, 63, 27, (8, 8, 9, 255))             # frente
    for x in range(64):
        px(im, x, 2, PLATA)
        px(im, x, 19, PLATA)
    rect(im, 1, 3, 62, 3, (48, 48, 50, 255))
    rect(im, 2, 28, 4, 31, (8, 8, 9, 255))              # patas
    rect(im, 59, 28, 61, 31, (8, 8, 9, 255))
    asset_simple("ESCRITORIO_JH", "Escritorio JH", "desks", im, 4, 2, fondo=1)


# ── Placas con el nombre de cada puesto ──────────────────────
PUESTOS = [
    ("GERENTE", "GERENTE"), ("SECRETARIA", "SECRETARIA"),
    ("ESPIA", "ESPÍA"), ("CREATIVO", "CREATIVO"), ("GUIONISTA", "GUIONISTA"),
    ("DISENADOR", "DISEÑADOR"), ("ESTRATEGA_IG", "ESTRATEGA IG"),
    ("INVENTARIO", "INVENTARIO"), ("TASADOR", "TASADOR"), ("CONTADOR", "CONTADOR"), ("PAUTA", "PAUTA"),
]


def item_placa(clave, rotulo):
    im = lienzo(48, 16)
    w = ancho_texto(rotulo) + 6
    x0 = (48 - w) // 2
    rect(im, x0, 2, x0 + w - 1, 13, GRAFITO)
    for x in range(x0, x0 + w):
        px(im, x, 2, PLATA)
        px(im, x, 13, PLATA)
    for y in range(2, 14):
        px(im, x0, y, PLATA)
        px(im, x0 + w - 1, y, PLATA)
    texto(im, x0 + 3, 6, rotulo, BLANCO)
    asset_simple(f"PLACA_{clave}", f"Placa {rotulo.title()}", "decor", im, 3, 1, superficie=True)


def item_senal_zona(clave, rotulo):
    im = lienzo(48, 32)
    rect(im, 1, 10, 46, 22, NEGRO)
    for x in range(1, 47):
        px(im, x, 10, PLATA)
        px(im, x, 22, PLATA)
    texto(im, (48 - ancho_texto(rotulo)) // 2, 14, rotulo, BLANCO)
    asset_simple(f"ZONA_{clave}", f"Zona {rotulo.title()}", "wall", im, 3, 2, paredes=True)


# ── Ventanal de vidrio para las paredes ──────────────────────
def item_vidrio():
    im = lienzo(16, 32)
    rect(im, 0, 0, 15, 31, (150, 172, 182, 255))
    rect(im, 0, 0, 15, 1, PLATA)
    rect(im, 0, 30, 15, 31, PLATA)
    rect(im, 0, 0, 0, 31, PLATA)
    for i in range(6):
        px(im, 3 + i, 12 - i, (214, 228, 234, 255))
        px(im, 4 + i, 12 - i, (214, 228, 234, 255))
        px(im, 8 + i, 26 - i, (190, 208, 216, 255))
    rect(im, 1, 18, 15, 18, (130, 152, 162, 255))
    asset_simple("VENTANAL", "Ventanal de vidrio", "wall", im, 1, 2, paredes=True)


# ── Plano del concesionario ──────────────────────────────────
COLS, ROWS = 48, 36
WALL, VOID = 0, 255
PISO_OFICINA, PISO_SHOWROOM, ASFALTO = 3, 8, 1

C_ASFALTO = {"h": 0, "s": 0, "b": -97, "c": 0}
C_OFICINA = {"h": 0, "s": 0, "b": 28, "c": 0}
C_SHOWROOM = {"h": 0, "s": 0, "b": 0, "c": 15}
C_PARED = {"h": 0, "s": 0, "b": -100, "c": 0}
C_NEGRO = {"h": 0, "s": 0, "b": -70, "c": 0, "colorize": True}
C_GRAFITO = {"h": 0, "s": 0, "b": -45, "c": 0, "colorize": True}


def plano():
    tiles = [VOID] * (COLS * ROWS)
    colores = [None] * (COLS * ROWS)
    areas = [None] * (COLS * ROWS)
    muebles = []
    uid = [0]

    def poner_tile(c, r, t, color):
        i = r * COLS + c
        tiles[i] = t
        colores[i] = color

    def mueble(tipo, c, r, color=None):
        uid[0] += 1
        m = {"uid": f"jh-{uid[0]:03d}", "type": tipo, "col": c, "row": r}
        if color:
            m["color"] = color
        muebles.append(m)

    # Edificio: filas 1..19, columnas 0..47
    for r in range(1, 20):
        for c in range(0, 48):
            borde = r in (1, 19) or c in (0, 47)
            interior = c in (15, 23, 35) and r <= 13
            if borde or interior:
                poner_tile(c, r, WALL, C_PARED)
            elif c < 15:
                poner_tile(c, r, PISO_SHOWROOM, C_SHOWROOM)
            else:
                poner_tile(c, r, PISO_OFICINA, C_OFICINA)
    # puertas
    for c in (6, 7, 8, 9, 28, 29):
        poner_tile(c, 19, PISO_SHOWROOM if c < 15 else PISO_OFICINA, C_SHOWROOM if c < 15 else C_OFICINA)
    for r in (8, 9):
        poner_tile(15, r, PISO_OFICINA, C_OFICINA)
    for r in (16, 17, 18):
        poner_tile(15, r, PISO_OFICINA, C_OFICINA)
    # Lote: filas 20..37
    for r in range(20, ROWS):
        for c in range(0, 48):
            poner_tile(c, r, ASFALTO, C_ASFALTO)

    # Áreas
    for r in range(2, 19):
        for c in range(16, 47):
            if tiles[r * COLS + c] == WALL:
                continue
            if c <= 22:
                areas[r * COLS + c] = "Gerencia"
            elif c <= 34:
                areas[r * COLS + c] = "Contenido"
            else:
                areas[r * COLS + c] = "Operación"

    # Ventanales en paredes interiores y fachada
    for r in range(2, 14):
        for c in (15, 23, 35):
            if tiles[r * COLS + c] == WALL and r % 2 == 1:
                mueble("VENTANAL", c, r - 1)
    for c in range(1, 47):
        if tiles[19 * COLS + c] == WALL and c not in (15, 23, 35):
            mueble("VENTANAL", c, 18)

    # Señales de zona y logo en la pared superior
    mueble("LOGO_PARED_JH", 5, 0)
    mueble("ZONA_GERENCIA", 17, 0)
    mueble("ZONA_CONTENIDO", 27, 0)
    mueble("ZONA_OPERACION", 39, 0)

    # Puestos: escritorio (4x2) + PC + placa + silla
    def puesto(c, r, placa):
        mueble("ESCRITORIO_JH", c, r)
        mueble("PC_FRONT_OFF", c + 3, r)
        mueble(f"PLACA_{placa}", c, r + 1)
        mueble("CUSHIONED_CHAIR_BACK", c + 2, r + 2, C_NEGRO)

    puesto(17, 3, "GERENTE")
    puesto(17, 8, "SECRETARIA")
    puesto(24, 3, "ESPIA")
    puesto(30, 3, "CREATIVO")
    puesto(24, 7, "GUIONISTA")
    puesto(30, 7, "DISENADOR")
    puesto(27, 11, "ESTRATEGA_IG")
    puesto(36, 3, "INVENTARIO")
    puesto(42, 3, "TASADOR")
    puesto(36, 8, "CONTADOR")
    puesto(42, 8, "PAUTA")

    # Decoración de oficina
    mueble("PLANT", 21, 12)
    mueble("LARGE_PLANT", 45, 13)
    mueble("WHITEBOARD", 31, 0)
    mueble("PLANT_2", 16, 15)
    mueble("COFFEE_TABLE", 39, 15, C_NEGRO)
    mueble("SOFA_FRONT", 39, 13, C_GRAFITO)

    # Showroom
    mueble("VITRINA_FUNDA", 5, 6)
    mueble("CARRO_DEPORTIVO_NEGRO_FRONT", 10, 12)
    mueble("CARRO_CAMIONETA_BLANCO_FRONT", 2, 12)
    mueble("CARRO_SEDAN_PLATA_FRONT", 6, 13)
    mueble("LARGE_PLANT", 1, 3)
    mueble("LARGE_PLANT", 13, 3)

    # Lote de parqueo
    for c in range(1, 47, 3):
        mueble("LINEA_PARQUEO_FRONT", c, 21)
        mueble("LINEA_PARQUEO_FRONT", c, 27)
    fila_a = [(2, "SEDAN_NEGRO"), (5, "CAMIONETA_PLATA"), (11, "DEPORTIVO_BLANCO"), (17, "PICKUP_NEGRO"),
              (26, "SEDAN_BLANCO"), (35, "CAMIONETA_NEGRO")]
    fila_b = [(5, "SEDAN_PLATA"), (14, "CAMIONETA_BLANCO"), (32, "DEPORTIVO_PLATA"), (41, "PICKUP_BLANCO")]
    for c, carro_id in fila_a:
        mueble(f"CARRO_{carro_id}_BACK", c, 21)
    for c, carro_id in fila_b:
        mueble(f"CARRO_{carro_id}_FRONT", c, 27)
    # Letrero de entrada
    mueble("LETRERO_JH_AUTOS", 21, 32)

    return {
        "version": 1, "cols": COLS, "rows": ROWS, "layoutRevision": 1,
        "tiles": tiles, "tileColors": colores, "furniture": muebles,
        "areas": [
            {"label": "Gerencia", "color": "#B4B7BB"},
            {"label": "Contenido", "color": "#FFFFFF"},
            {"label": "Operación", "color": "#8A8A8A"},
        ],
        "areaTiles": areas,
    }


def main():
    if os.path.isdir(SALIDA):
        shutil.rmtree(SALIDA)
    os.makedirs(SALIDA)
    for modelo in MODELOS:
        for pintura in PINTURAS:
            item_carro(modelo, pintura)
    item_linea()
    item_vitrina()
    item_letrero()
    item_logo_pared()
    item_escritorio()
    item_vidrio()
    for clave, rotulo in PUESTOS:
        item_placa(clave, rotulo)
    for clave, rotulo in [("GERENCIA", "GERENCIA"), ("CONTENIDO", "CONTENIDO"), ("OPERACION", "OPERACIÓN")]:
        item_senal_zona(clave, rotulo)
    with open(os.path.join(AQUI, "layout-concesionario.json"), "w") as f:
        json.dump(plano(), f, ensure_ascii=False)
    print("Listo:", len(os.listdir(SALIDA)), "muebles")


if __name__ == "__main__":
    main()
