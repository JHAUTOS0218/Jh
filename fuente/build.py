"""Genera el manual de marca de JH AUTOS.

Uso:
    python3 fuente/build.py            # HTML + logos transparentes
    python3 fuente/build.py --pdf      # además exporta el PDF horizontal

Lee desde la raíz del repositorio:
    logo-blanco-sobre-negro.png   (versión principal)
    logo-negro-sobre-blanco.png   (versión secundaria)
    *monument*.otf|ttf|woff|woff2 (opcional; si no existe se usa Michroma)
"""
import base64
import glob
import io
import os
import random
import re
import sys

from PIL import Image, ImageOps

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
LOGO_BN = os.path.join(RAIZ, os.environ.get("LOGO_BLANCO", "logo-blanco-sobre-negro.png"))
LOGO_NB = os.path.join(RAIZ, os.environ.get("LOGO_NEGRO", "logo-negro-sobre-blanco.png"))
SALIDA_HTML = os.path.join(RAIZ, "manual-jh-autos.html")
SALIDA_PDF = os.path.join(RAIZ, "manual-jh-autos.pdf")
DIR_LOGOS = os.path.join(RAIZ, "logos")


def b64(data, mime):
    return f"data:{mime};base64," + base64.b64encode(data).decode()


def png_bytes(img):
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def fondo_solido(img):
    """True si las cuatro esquinas son opacas y del mismo color."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    esquinas = [rgba.getpixel(p) for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]]
    opacas = all(c[3] == 255 for c in esquinas)
    iguales = max(max(abs(a - b) for a, b in zip(c[:3], esquinas[0][:3])) for c in esquinas) < 12
    return opacas and iguales


def a_transparente(img, tinta):
    """Convierte un logo de dos tonos a un PNG de un solo color con alfa.

    tinta = "blanco": el logo es claro sobre fondo oscuro.
    tinta = "negro":  el logo es oscuro sobre fondo claro.
    El alfa sale de la luminancia, así los bordes suavizados se conservan.
    """
    rgba = img.convert("RGBA")
    if not fondo_solido(rgba):
        alfa = rgba.getchannel("A")
    else:
        lum = rgba.convert("L")
        alfa = lum if tinta == "blanco" else ImageOps.invert(lum)
        # limpia ruido de compresión en el fondo y satura el trazo
        alfa = alfa.point(lambda v: 0 if v < 10 else (255 if v > 245 else v))
    color = (255, 255, 255) if tinta == "blanco" else (0, 0, 0)
    out = Image.new("RGBA", rgba.size, color + (0,))
    out.putalpha(alfa)
    caja = alfa.point(lambda v: 255 if v > 24 else 0).getbbox()
    return out.crop(caja), fondo_solido(rgba)


def medir_j(logo):
    """Caja de la primera letra (la J) en fracciones del logo recortado."""
    alfa = logo.getchannel("A").point(lambda v: 255 if v > 64 else 0)
    w, h = alfa.size
    px = alfa.load()
    cols = [any(px[x, y] for y in range(h)) for x in range(w)]
    x0 = cols.index(True)
    x1 = x0
    while x1 < w and cols[x1]:
        x1 += 1
    filas = [y for y in range(h) if any(px[x, y] for x in range(x0, x1))]
    y0, y1 = filas[0], filas[-1] + 1
    return {"l": x0 / w, "t": y0 / h, "w": (x1 - x0) / w, "h": (y1 - y0) / h}


def foto_simulada(seed, w=640, h=400, n=2600, oscuro_hasta=0.0):
    """Mosaico con mucho detalle hecho solo con los colores de la marca."""
    rnd = random.Random(seed)
    colores = ["#000000", "#FFFFFF", "#B4B7BB", "#8A8A8A", "#1A1A1A"]
    rects = []
    for _ in range(n):
        rw, rh = rnd.randint(3, 22), rnd.randint(2, 14)
        x = rnd.randint(-10, w)
        y0 = int(h * oscuro_hasta)
        y = rnd.randint(y0 - 10, h)
        if y < y0:
            rh -= y0 - y
            y = y0
            if rh <= 0:
                continue
        rects.append(f'<rect x="{x}" y="{y}" width="{rw}" height="{rh}" fill="{rnd.choice(colores)}"/>')
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid slice">'
        f'<rect width="{w}" height="{h}" fill="#8A8A8A"/>'
        + (f'<rect width="{w}" height="{int(h*oscuro_hasta)}" fill="#1A1A1A"/>' if oscuro_hasta else "")
        + "".join(rects)
        + "</svg>"
    )
    return b64(svg.encode(), "image/svg+xml")


def fuente_titulos():
    candidatos = []
    for ext in ("otf", "ttf", "woff", "woff2"):
        candidatos += glob.glob(os.path.join(RAIZ, f"**/*[Mm]onument*.{ext}"), recursive=True)
    if candidatos:
        ruta = sorted(candidatos)[0]
        ext = ruta.rsplit(".", 1)[1].lower()
        mime = {"otf": "font/otf", "ttf": "font/ttf", "woff": "font/woff", "woff2": "font/woff2"}[ext]
        fmt = {"otf": "opentype", "ttf": "truetype", "woff": "woff", "woff2": "woff2"}[ext]
        with open(ruta, "rb") as f:
            return b64(f.read(), mime), fmt, True
    with open(os.path.join(AQUI, "fuentes", "michroma-latin-400-normal.woff2"), "rb") as f:
        return b64(f.read(), "font/woff2"), "woff2", False


def fuente_inter(peso):
    with open(os.path.join(AQUI, "fuentes", f"inter-latin-{peso}-normal.woff2"), "rb") as f:
        return b64(f.read(), "font/woff2")


def main():
    for ruta in (LOGO_BN, LOGO_NB):
        if not os.path.exists(ruta):
            sys.exit(f"Falta el archivo del logo: {ruta}")

    blanco, solido_bn = a_transparente(Image.open(LOGO_BN), "blanco")
    negro, solido_nb = a_transparente(Image.open(LOGO_NB), "negro")

    os.makedirs(DIR_LOGOS, exist_ok=True)
    blanco.save(os.path.join(DIR_LOGOS, "jh-autos-logo-blanco-transparente.png"), optimize=True)
    negro.save(os.path.join(DIR_LOGOS, "jh-autos-logo-negro-transparente.png"), optimize=True)
    print(f"Logos: fondo sólido -> blanco={solido_bn}, negro={solido_nb}. Transparentes en /logos")

    ar = blanco.size[1] / blanco.size[0]  # alto / ancho
    j = medir_j(blanco)
    print(f"Proporción alto/ancho {ar:.4f}; J = {j}")

    # Diagrama de zona de respeto: x = altura de la J
    xr = j["h"]  # x en fracciones de la altura del logo
    W = min(860 / (1 + 2 * xr * ar), 560 / (ar * (1 + 2 * xr)))
    H = W * ar
    X = xr * H

    titulo_src, titulo_fmt, es_monument = fuente_titulos()
    nota_fuente = (
        ""
        if es_monument
        else "En este documento se muestra Michroma como reemplazo temporal de Monument."
    )

    rep = {
        "LOGO_BLANCO": b64(png_bytes(blanco), "image/png"),
        "LOGO_NEGRO": b64(png_bytes(negro), "image/png"),
        "AR": f"{ar:.5f}",
        "ZW": f"{W:.2f}",
        "ZH": f"{H:.2f}",
        "ZX": f"{X:.2f}",
        "JL": f"{j['l']:.5f}",
        "JT": f"{j['t']:.5f}",
        "JW": f"{j['w']:.5f}",
        "JH": f"{j['h']:.5f}",
        "FOTO_DETALLE": foto_simulada(7),
        "FOTO_ZONA_OSCURA": foto_simulada(11, oscuro_hasta=0.42),
        "FUENTE_TITULOS": titulo_src,
        "FUENTE_TITULOS_FMT": titulo_fmt,
        "INTER_400": fuente_inter(400),
        "INTER_500": fuente_inter(500),
        "INTER_600": fuente_inter(600),
        "NOTA_FUENTE": nota_fuente,
    }

    with open(os.path.join(AQUI, "plantilla.html"), encoding="utf-8") as f:
        html = f.read()
    html = re.sub(r"%%([A-Z0-9_]+)%%", lambda m: rep[m.group(1)], html)
    with open(SALIDA_HTML, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"HTML: {SALIDA_HTML} ({os.path.getsize(SALIDA_HTML)//1024} KB)")

    if "--pdf" in sys.argv:
        exportar_pdf()


def exportar_pdf():
    import subprocess

    subprocess.run(["node", os.path.join(AQUI, "exportar.js"), SALIDA_HTML, SALIDA_PDF], check=True)


if __name__ == "__main__":
    main()
