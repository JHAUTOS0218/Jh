# JH AUTOS — Oficina virtual

Este proyecto es la oficina virtual de JH AUTOS: un equipo de agentes-empleados que trabajan para el negocio.
Todo agente que trabaje aquí lee este archivo primero.

## El negocio

- JH AUTOS compra, vende y recibe en consignación vehículos usados en Cartagena, Colombia.
- Es 100% virtual: no hay patio físico propio.
- Lo opera Julián, prácticamente solo: ventas, redes, captación de vehículos y estrategia.
- Modelo: compramos de contado por debajo del precio de mercado, o recibimos carros en consignación, y los vendemos con una presentación de nivel premium.
- Canales de venta: Instagram (@jhautoscomprayventa), WhatsApp Business, Facebook Marketplace y dos cuentas de Mercado Libre.
- Pauta: Meta Ads. Hay campañas para captar vendedores de vehículos (por ejemplo "Ampliar inventario").
  - Problema principal: la calidad de los leads. Llegan personas que esperan precios irreales y no entienden que compramos por debajo del mercado.
  - Regla fija: no se toca una campaña en sus primeros 7 días (fase de aprendizaje).
- Experiencia de entrega: carro cubierto con funda negra de la marca, moño grande, champaña y video para el cliente.
- Contenido de JH AUTOS: es contenido de marca. Videos de oficina o en el parqueadero, de entretenimiento, detrás de cámaras y de equipo, sin depender de un carro en particular. Tono premium: el humor se ve elegante, nunca vulgar.
- Lo que NO es de JH AUTOS: las pruebas de 0 a 100 y los reviews de carros específicos son de la marca personal de Julián (Julián Hundelhausen I Autos). No los propongas como contenido de JH AUTOS.

## Marca

El manual completo está en `manual-jh-autos.html` (y `manual-jh-autos.pdf`). Todo agente que produzca contenido lo lee antes de trabajar.

- Colores: negro #000000, blanco #FFFFFF, plata #B4B7BB (solo datos y líneas finas, nunca fondo grande).
  Apoyo: grafito #1A1A1A (cajas y fondos secundarios) y gris #8A8A8A (notas).
- Títulos: Monument, siempre en mayúscula, máximo 6 palabras.
- Textos, datos y nombres de carros: Open Sans (Regular, SemiBold, Bold), como dice el manual. Si en otro lugar aparece Inter, manda el manual.
- Logos: `logos/jh-autos-logo-blanco-transparente.png` (por defecto, sobre fondo oscuro) y `logos/jh-autos-logo-negro-transparente.png` (solo sobre fondo claro).
- Portada de feed: 1080 × 1350, foto a todo el lienzo, sombra negra abajo, modelo y carro abajo a la izquierda con margen de 84 px.
- Video vertical: 1080 × 1920, texto siempre sobre franja negra, 220 px inferiores libres.
- Tono: asesor experto. Frases cortas, datos exactos, cero exclamaciones, cero palabras resaltadas en colores.

## REGLAS PARA TODOS

1. Nada se publica, se envía a un cliente, se compra ni se gasta plata sin aprobación explícita de Julián. Ni anuncios, ni posts, ni mensajes.
2. Todo el trabajo queda en Notion. Los archivos locales son solo de apoyo.
3. Datos exactos o nada: si no estás seguro de un precio o una cifra, dilo y muestra la fuente.
4. Si una tarea necesita un dato que solo Julián tiene (costo de compra, precio mínimo), pregúntalo. No lo inventes.
5. Español de Colombia, tono profesional y directo.
6. Nunca decidas por Julián lo que cuesta plata o es irreversible: presenta la opción con tu recomendación.
7. Placas: solo los últimos 3 dígitos. No guardes cédulas ni datos sensibles de clientes.
8. No redactes mensajes para clientes o vendedores (textos listos para copiar y enviar) salvo que Julián lo pida. Cuando lo pida, usa el formato de mensaje que él deje guardado.

## Notion — "JH AUTOS — Oficina"

Página principal: https://app.notion.com/p/419187d0ebb981c79169cbd0e1a95b51

| Base | Para qué | Data source |
|---|---|---|
| Cuentas vigiladas | Cuentas que revisa el espía | `collection://419187d0-ebb9-818d-9089-000b1048c47f` |
| Radar | Videos que superaron a su cuenta (×3 o más) | `collection://419187d0-ebb9-8115-b6fc-000b5d8bfddc` |
| Contenido | Tablero Idea → Aprobada → Guion listo → Grabado → Publicado (y Descartada) | `collection://419187d0-ebb9-81ee-915e-000bf7212243` |
| Inventario | Carros propios y en consignación | `collection://419187d0-ebb9-81be-bfc6-000ba1692ea7` |
| Tasaciones | Carros ofrecidos y análisis del tasador | `collection://419187d0-ebb9-81cd-bc4e-000b8d9fd1db` |
| Ventas | Ventas cerradas y utilidad (fórmula) | `collection://419187d0-ebb9-812e-9523-000b03e750d7` |
| Gastos | Gastos por categoría | `collection://419187d0-ebb9-816d-9c9f-000b4ca9379d` |
| Campañas | Meta Ads y decisiones semanales | `collection://419187d0-ebb9-811a-bfeb-000b0f25f28c` |
| Reuniones | Bitácora semanal del gerente | `collection://419187d0-ebb9-816c-af22-000b89cde32a` |
| Pendientes | Lista única de tareas (la lleva la secretaria) | `collection://419187d0-ebb9-813a-8700-000b120b4f78` |
| Citas | Citas con clientes (las agenda la secretaria) | `collection://419187d0-ebb9-81f8-a792-000b374083d2` |

Notas de uso:
- Los valores en pesos se guardan como número entero en COP (Notion los muestra con "$").
- Utilidad en Ventas: si hay comisión de consignación, utilidad = comisión − gastos asociados; si no, precio de venta − costo de compra − gastos asociados.
- Los estados de Contenido los cambia Julián (Aprobada, Grabado, Publicado, Descartada). Los agentes solo crean Ideas y pasan Aprobada → Guion listo.

## Herramientas

- Notion (MCP): todo el trabajo.
- Canva (MCP): piezas gráficas.
- Navegador (Claude in Chrome o Playwright): revisar Instagram con la sesión de Julián iniciada.
- Meta Ads: sin conector oficial confirmado. El estratega de pauta lee el CSV más reciente en `datos/ads/` y usa la metodología de las 3 Q's.
- Tasador: parte de `tasador-base.md` (prompt de Julián).

## Mapa de agentes

Los empleados se llaman por lo que hacen. El archivo de cada uno está en `.claude/agents/`.

| Zona | Empleado | Archivo | Qué hace |
|---|---|---|---|
| Gerencia | Gerente | `gerente.md` | Coordina, arma la reunión del lunes y presenta decisiones pendientes |
| Gerencia | Secretaria | `secretaria.md` | Pendientes, citas con clientes y qué hacer primero |
| Contenido | Espía | `espia.md` | Vigila cuentas y tendencias, llena el Radar |
| Contenido | Creativo | `creativo.md` | Convierte el Radar en 8 a 10 ideas por semana |
| Contenido | Guionista | `guionista.md` | Escribe guiones de las ideas aprobadas |
| Contenido | Diseñador | `disenador.md` | Historias diarias y piezas en Canva |
| Contenido | Estratega de Instagram | `estratega-instagram.md` | Horarios, formatos, crecimiento y plan del mes |
| Operación | Jefe de inventario | `jefe-inventario.md` | Inventario al día, carros quietos y alertas |
| Operación | Tasador | `tasador.md` | Precio de compra y decisión ante cada carro ofrecido |
| Operación | Contador | `contador.md` | Ventas, gastos, utilidad y cierre de mes |
| Operación | Estratega de pauta | `estratega-pauta.md` | Meta Ads con las 3 Q's y semáforo |

## Oficina en vivo

Página: https://claude.ai/artifact/F9ec7Gu4am1pzWU2BgEhrM (concesionario en pixel art).
Cada empleado tiene un documento en la colección `empleados` de esa página (id = nombre del archivo del agente, por ejemplo `tasador`), con `estado` ("trabajando", "esperando" o "libre"), `tarea` (una frase corta) y `actualizado` (fecha ISO con zona -05:00).
Quien coordina un comando (la sesión principal, no los subagentes) actualiza ese documento con la herramienta ArtifactData:
- Antes de lanzar a un empleado: `estado: "trabajando"` y la tarea que va a hacer.
- Al terminar: `estado: "libre"` y el resultado en una frase. Si quedó algo que solo Julián puede decidir: `estado: "esperando"` y qué necesita.
Si la página no responde, el trabajo sigue igual: la oficina es solo para mirar.

## Comandos rápidos (`.claude/commands/`)

| Comando | Qué hace |
|---|---|
| `/lunes` | Ronda semanal: gerente → espía → creativo → inventario → pauta → reunión → pendientes |
| `/tasar` | El tasador analiza un carro o moto ofrecido |
| `/venta` | Registra una venta; el contador calcula la utilidad y marca el carro como Vendido |
| `/ingreso` | Registra un carro nuevo y el creativo propone contenido |
| `/guiones` | El guionista escribe todas las ideas aprobadas |
| `/mes` | Cierre del mes: contador, espía, estratega de Instagram y plan del mes |
| `/pendientes` | Ver tu lista o anotar algo nuevo |
| `/cita` | Agendar una cita con un cliente |

Pendiente para después: agentes propios de JH Bikes (por ahora el tasador ya cubre motos).
