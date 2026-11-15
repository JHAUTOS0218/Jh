# Manual de marca JH AUTOS

Fuente del manual: `fuente/plantilla.html` (diseño) y `fuente/build.py` (montaje).

1. Pon en esta carpeta `logo-blanco-sobre-negro.png` y `logo-negro-sobre-blanco.png`
   y la fuente Monument (.otf) en `privado/` (no se sube a git: su licencia gratuita es solo de uso personal).
2. Ejecuta `python3 fuente/build.py --pdf`.

Se generan `manual-jh-autos.html` (autocontenido), `manual-jh-autos.pdf` (horizontal, una sección
por página) y `logos/` con las versiones transparentes del logo.
Para revisar: `node fuente/exportar.js manual-jh-autos.html "" --revisar carpeta` guarda una captura
por sección y un reporte de contraste.

Fuentes: Monument Extended (logo y títulos) y Open Sans (textos y nombres de carros). Fotos de ejemplo en `fuente/fotos/`.
