# Cómo abrir la oficina de JH AUTOS (concesionario en pixel art)

La oficina usa la extensión **Pixel Agents** (de pablodelucca) sin modificarla.
Los carros, la vitrina, el letrero y las placas de cada escritorio son "muebles" propios que la extensión carga desde esta carpeta.

## Lo que hay aquí

| Archivo | Qué es |
|---|---|
| `jh-autos-assets/` | Los dibujos: 12 carros (sedán, camioneta, deportivo y pickup en negro, blanco y plata), líneas de parqueo, vitrina con funda negra y moño, letrero JH AUTOS, logo de pared, escritorio negro, ventanal, placas de los 11 puestos y señales de zona |
| `layout-concesionario.json` | El plano: lote de parqueo, showroom con vitrina y la oficina de vidrio con Gerencia (2), Contenido (5) y Operación (4) |
| `generar.py` | El programa que dibuja todo. Si cambias algo, corre `python3 oficina/generar.py` |
| `vista-previa.png` | Cómo se ve |

## Pasos (una sola vez)

1. Instala **VS Code** (code.visualstudio.com) si no lo tienes.
2. Descarga este proyecto a tu computador. En VS Code: *Archivo → Clonar repositorio* y pega `https://github.com/JHAUTOS0218/Jh`.
3. Instala la extensión: en VS Code abre *Extensiones* (Ctrl+Shift+X o Cmd+Shift+X), busca **Pixel Agents** de *pablodelucca* e instálala.
4. Abre el panel **Pixel Agents** (aparece junto a la terminal, abajo). Si no lo ves: Ctrl+Shift+P → escribe `Pixel Agents: Show Panel`.
5. Carga los dibujos: en el panel, **Settings → Add Asset Directory** y elige la carpeta `oficina/jh-autos-assets` del proyecto.
6. Carga el plano: **Layout → Import** y elige `oficina/layout-concesionario.json`. Guarda.
7. Activa **Settings → Show Workspace Folders**. Luego pulsa **+** (abajo a la izquierda) y elige la carpeta del proyecto: se abre Claude Code y aparece tu personaje.

Desde ahí escribes `/lunes`, `/tasar`, etc. Cada empleado que trabaje aparece como un personaje que camina a un escritorio, se sienta y teclea mientras trabaja.

## Sin VS Code (en el navegador)

Con Node.js instalado, en una terminal dentro de la carpeta del proyecto:

```
npx pixel-agents
```

Abre el enlace que imprime y repite los pasos 5 a 7 desde esa página.

## Qué no se puede (por ahora)

- La extensión reparte los escritorios sola: el personaje del tasador se sienta en el primer puesto libre, no siempre en el que dice TASADOR. Las placas muestran dónde va cada rol, pero la extensión no permite fijar a cada empleado en su silla.
- Los personajes son los de la extensión. Se pueden vestir de negro, blanco y plata desde **Characters** si quieres que vayan de uniforme.
