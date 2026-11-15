"""Arma el fondo y el plano de la oficina en vivo (página web).

Uso: python3 oficina/generar.py && python3 oficina/web/construir.py
Crea oficina/web/fondo.png y oficina/web/plano.json
Todos los dibujos son propios (no usa los de la extensión Pixel Agents).
"""
import glob
import json
import os
import random

from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
OFICINA = os.path.dirname(AQUI)
ASSETS = os.path.join(OFICINA, "jh-autos-assets", "assets", "furniture")
LAYOUT = json.load(open(os.path.join(OFICINA, "layout-concesionario.json")))
T = 16
COLS, ROWS = LAYOUT["cols"], LAYOUT["rows"]
WALL, VOID = 0, 255
random.seed(7)


def lienzo(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def rect(im, x0, y0, x1, y1, c):
    for y in range(max(0, y0), min(im.height, y1 + 1)):
        for x in range(max(0, x0), min(im.width, x1 + 1)):
            im.putpixel((x, y), c)


# ── Muebles propios que reemplazan los de la extensión ───────
def pc():
    im = lienzo(16, 32)
    rect(im, 2, 3, 13, 13, (10, 10, 11, 255))      # marco
    rect(im, 3, 4, 12, 12, (34, 38, 44, 255))      # pantalla apagada
    rect(im, 7, 14, 8, 16, (60, 60, 64, 255))      # base
    rect(im, 5, 17, 10, 17, (60, 60, 64, 255))
    rect(im, 1, 19, 11, 21, (40, 40, 43, 255))     # teclado
    for x in range(2, 11, 2):
        im.putpixel((x, 20), (90, 90, 95, 255))
    return im


def silla():
    im = lienzo(16, 16)
    rect(im, 3, 1, 12, 9, (12, 12, 13, 255))
    rect(im, 4, 2, 11, 8, (30, 30, 32, 255))
    rect(im, 3, 10, 12, 12, (18, 18, 19, 255))
    rect(im, 7, 13, 8, 14, (60, 60, 64, 255))
    rect(im, 4, 15, 11, 15, (60, 60, 64, 255))
    return im


def planta(alta=False):
    h = 32 if alta else 24
    im = lienzo(16, h)
    hojas = [(46, 92, 52, 255), (64, 122, 70, 255), (34, 70, 40, 255)]
    for _ in range(70 if alta else 40):
        x = random.randint(2, 13)
        y = random.randint(1, h - 12)
        im.putpixel((x, y), random.choice(hojas))
    rect(im, 4, h - 10, 11, h - 2, (20, 20, 21, 255))
    rect(im, 4, h - 10, 11, h - 10, (180, 183, 187, 255))
    return im


def sofa():
    im = lienzo(64, 32)
    rect(im, 0, 6, 63, 14, (52, 52, 55, 255))
    rect(im, 0, 15, 63, 25, (40, 40, 43, 255))
    rect(im, 0, 6, 5, 27, (30, 30, 32, 255))
    rect(im, 58, 6, 63, 27, (30, 30, 32, 255))
    for x in (21, 42):
        rect(im, x, 15, x, 25, (30, 30, 32, 255))
    return im


def mesa():
    im = lienzo(48, 32)
    rect(im, 2, 6, 45, 20, (14, 14, 15, 255))
    rect(im, 2, 6, 45, 6, (180, 183, 187, 255))
    rect(im, 2, 21, 45, 24, (6, 6, 7, 255))
    return im


def tablero():
    im = lienzo(32, 32)
    rect(im, 1, 8, 30, 24, (240, 240, 240, 255))
    rect(im, 1, 8, 30, 8, (180, 183, 187, 255))
    rect(im, 1, 24, 30, 24, (180, 183, 187, 255))
    for y, w in [(12, 18), (15, 12), (18, 20)]:
        rect(im, 5, y, 5 + w, y, (60, 60, 64, 255))
    return im


PROPIOS = {
    "PC_FRONT_OFF": (pc(), False),
    "CUSHIONED_CHAIR_BACK": (silla(), False),
    "PLANT": (planta(), False),
    "PLANT_2": (planta(), False),
    "LARGE_PLANT": (planta(True), False),
    "SOFA_FRONT": (sofa(), False),
    "COFFEE_TABLE": (mesa(), False),
    "WHITEBOARD": (tablero(), True),
}


def sprite(tipo):
    if tipo in PROPIOS:
        return PROPIOS[tipo]
    ruta = glob.glob(os.path.join(ASSETS, "*", tipo + ".png"))
    if not ruta:
        raise SystemExit(f"No encuentro el dibujo de {tipo}")
    carpeta = os.path.dirname(ruta[0])
    m = json.load(open(os.path.join(carpeta, "manifest.json")))
    return Image.open(ruta[0]).convert("RGBA"), bool(m.get("canPlaceOnWalls"))


# ── Pisos y paredes ──────────────────────────────────────────
def piso(tipo, c, r):
    im = lienzo(T, T)
    if tipo == 1:  # asfalto
        rect(im, 0, 0, 15, 15, (33, 33, 35, 255))
        for _ in range(10):
            g = random.choice([26, 40, 44])
            im.putpixel((random.randint(0, 15), random.randint(0, 15)), (g, g, g + 2, 255))
    elif tipo == 8:  # showroom ajedrez
        for y in range(16):
            for x in range(16):
                claro = ((x // 8) + (y // 8)) % 2 == 0
                im.putpixel((x, y), (236, 236, 236, 255) if claro else (40, 44, 48, 255))
    else:  # oficina
        rect(im, 0, 0, 15, 15, (214, 215, 217, 255))
        rect(im, 0, 0, 15, 0, (190, 191, 194, 255))
        rect(im, 0, 0, 0, 15, (190, 191, 194, 255))
    return im


def tile(c, r):
    if 0 <= c < COLS and 0 <= r < ROWS:
        return LAYOUT["tiles"][r * COLS + c]
    return VOID


def main():
    fondo = lienzo(COLS * T, ROWS * T)
    for r in range(ROWS):
        for c in range(COLS):
            t = tile(c, r)
            if t not in (WALL, VOID):
                fondo.alpha_composite(piso(t, c, r), (c * T, r * T))
    # paredes en vista 3/4: cara frontal + tapa
    for r in range(ROWS):
        for c in range(COLS):
            if tile(c, r) != WALL:
                continue
            y0 = r * T - T
            rect(fondo, c * T, max(0, y0), c * T + 15, r * T + 15, (34, 34, 36, 255))
            if tile(c, r - 1) != WALL:
                rect(fondo, c * T, max(0, y0), c * T + 15, max(0, y0) + 3, (74, 75, 79, 255))
            if tile(c, r + 1) != WALL:
                rect(fondo, c * T, r * T + 14, c * T + 15, r * T + 15, (16, 16, 17, 255))

    # muebles por profundidad
    piezas = []
    bloqueado = set()
    for m in LAYOUT["furniture"]:
        im, pared = sprite(m["type"])
        x, y = m["col"] * T, m["row"] * T
        orden = (0 if pared else 1, y + im.height)
        piezas.append((orden, im, x, y))
        if pared or m["type"].startswith("PLACA_") or m["type"] in ("PC_FRONT_OFF", "CUSHIONED_CHAIR_BACK"):
            continue
        fw, fh = im.width // T, max(1, im.height // T)
        if m["type"] in ("PLANT", "PLANT_2", "LARGE_PLANT"):
            fh_real = 1
            for dc in range(fw):
                bloqueado.add((m["col"] + dc, m["row"] + fh - 1))
            continue
        for dr in range(fh):
            for dc in range(fw):
                bloqueado.add((m["col"] + dc, m["row"] + dr))
    for _, im, x, y in sorted(piezas, key=lambda p: p[0]):
        fondo.alpha_composite(im, (x, y))
    fondo.save(os.path.join(AQUI, "fondo.png"))

    # puestos: silla = escritorio + (2, 2); PC = escritorio + (3, 0)
    roles = {
        "GERENTE": "gerente", "SECRETARIA": "secretaria", "ESPIA": "espia", "CREATIVO": "creativo",
        "GUIONISTA": "guionista", "DISENADOR": "disenador", "ESTRATEGA_IG": "estratega-instagram",
        "INVENTARIO": "jefe-inventario", "TASADOR": "tasador", "CONTADOR": "contador", "PAUTA": "estratega-pauta",
    }
    puestos = {}
    for m in LAYOUT["furniture"]:
        if m["type"].startswith("PLACA_"):
            c, r = m["col"], m["row"] - 1
            puestos[roles[m["type"][6:]]] = {"silla": [c + 2, r + 2], "pc": [(c + 3) * T + 3, r * T + 4]}

    caminable = []
    for r in range(ROWS):
        fila = ""
        for c in range(COLS):
            t = tile(c, r)
            ok = t not in (WALL, VOID) and (c, r) not in bloqueado
            fila += "1" if ok else "0"
        caminable.append(fila)
    codigos = {WALL: "W", VOID: "V", 1: "A", 8: "S"}
    suelo = ["".join(codigos.get(tile(c, r), "O") for c in range(COLS)) for r in range(ROWS)]
    muebles = []
    for m in LAYOUT["furniture"]:
        im, pared = sprite(m["type"])
        muebles.append({"t": m["type"], "c": m["col"], "r": m["row"], "w": im.width // T, "h": max(1, im.height // T)})
    plano = {"cols": COLS, "rows": ROWS, "tile": T, "caminable": caminable, "puestos": puestos,
             "suelo": suelo, "muebles": muebles,
             "zonaOficina": [16, 2, 46, 18], "puerta": [28, 19]}
    json.dump(plano, open(os.path.join(AQUI, "plano.json"), "w"))
    print("Listo: fondo.png", fondo.size, "y plano.json con", len(puestos), "puestos")


if __name__ == "__main__":
    main()
