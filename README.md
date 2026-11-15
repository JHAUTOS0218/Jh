# Manual de marca JH AUTOS

Fuente del manual: `fuente/plantilla.html` (diseño) y `fuente/build.py` (montaje).

1. Pon en esta carpeta `logo-blanco-sobre-negro.png` y `logo-negro-sobre-blanco.png`
   (y, si la tienes, la fuente Monument en .otf/.ttf/.woff).
2. Ejecuta `python3 fuente/build.py --pdf`.

Se generan `manual-jh-autos.html` (autocontenido), `manual-jh-autos.pdf` (horizontal, una sección
por página) y `logos/` con las versiones transparentes del logo.
Para revisar: `node fuente/exportar.js manual-jh-autos.html "" --revisar carpeta` guarda una captura
por sección y un reporte de contraste.
