# JH Finanzas · Guía para ponerla en tu iPhone (Fase 1)

Tiempo aproximado: **30 a 40 minutos**, una sola vez. Todo se hace desde el navegador (computador o iPhone).
No necesitas instalar programas.

Vas a usar 3 servicios gratis:

| Servicio | Para qué | Costo |
|---|---|---|
| **GitHub** (ya lo tienes) | Guarda el código de la app | $0 |
| **Supabase** | Base de datos + tu usuario y contraseña | $0 |
| **Vercel** | Publica la app en internet | $0 |

---

## Paso 1 · GitHub: dejar la rama de la app como principal (2 min)

La app está en la rama `claude/jh-finanzas-pwa-app-4vkrpv` (también trae el manual de marca, no se pierde nada).

1. Entra a **github.com/JHAUTOS0218/Jh**.
2. Arriba a la derecha, clic en **⚙ Settings**.
3. En **General → Default branch**, clic en el ícono de las dos flechas ⇄.
4. Elige `claude/jh-finanzas-pwa-app-4vkrpv` → **Update** → confirma.

---

## Paso 2 · Supabase: crear la base de datos (10 min)

1. Entra a **supabase.com** → **Start your project** → **Continue with GitHub**.
2. Clic en **New project**:
   - **Name:** `jh-finanzas`
   - **Database Password:** clic en *Generate a password* y **guárdala** (en Notas o en tu llavero).
   - **Region:** `South America (São Paulo)` (la más cercana a Colombia).
   - Clic en **Create new project** y espera 1–2 minutos.
3. **Crear las tablas.** En el menú izquierdo, clic en **SQL Editor** → **New query**.
   - Abre este archivo en otra pestaña: `finanzas/supabase/01-fase1.sql` en tu GitHub
     (github.com/JHAUTOS0218/Jh → carpeta `finanzas` → `supabase` → `01-fase1.sql`).
   - Clic en el ícono **Copy raw file** (dos cuadritos), vuelve a Supabase, pega todo y clic en **Run**.
   - Debe decir **Success. No rows returned**. ✅
4. **Crear tu usuario.** Menú izquierdo → **Authentication** → **Users** → **Add user** → **Create new user**:
   - Escribe tu correo y una contraseña fuerte.
   - Marca ✅ **Auto Confirm User** → **Create user**.
5. **Cerrar el registro a extraños.** En **Authentication → Sign In / Providers**, apaga
   **Allow new users to sign up** → **Save**. Así nadie más puede crearse una cuenta.
6. **Copiar las 2 llaves.** Clic en **Project Settings** (engranaje abajo a la izquierda) → **Data API** / **API Keys**:
   - **Project URL** (algo como `https://abcdxyz.supabase.co`)
   - **anon public** key (o **Publishable key**, empieza por `sb_publishable_` o `eyJ…`)

   Déjalas a mano para el paso 3. Estas dos son seguras para la app; **nunca** copies la `service_role` / `secret`.

---

## Paso 3 · Vercel: publicar la app (10 min)

1. Entra a **vercel.com** → **Sign Up** → plan **Hobby** → **Continue with GitHub**.
2. Clic en **Add New… → Project**. En la lista, busca **Jh** → **Import**.
   (Si no aparece: *Adjust GitHub App Permissions* → dale acceso al repositorio `Jh`.)
3. En la pantalla de configuración:
   - **Root Directory:** clic en **Edit** → elige la carpeta **`finanzas`** → **Continue**.
   - **Framework Preset:** debe decir **Next.js** (se pone solo).
   - Abre **Environment Variables** y agrega dos:

     | Key | Value |
     |---|---|
     | `NEXT_PUBLIC_SUPABASE_URL` | tu Project URL |
     | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tu anon / publishable key |

4. Clic en **Deploy** y espera ~1 minuto. 🎉
5. Te queda una dirección tipo **`jh-finanzas.vercel.app`**. Ábrela: debe aparecer la pantalla de entrada con el logo JH.

> Si en algún momento ves la pantalla “Falta un paso”, revisa que las 2 variables estén bien escritas
> y en Vercel ve a **Deployments → ⋯ → Redeploy**.

---

## Paso 4 · Instalarla en tu iPhone (1 min)

1. En el iPhone abre **Safari** (tiene que ser Safari) y entra a tu dirección `….vercel.app`.
2. Toca el botón **Compartir** (cuadrito con flecha ↑).
3. Baja y toca **Agregar a pantalla de inicio** → nombre **JH Finanzas** → **Agregar**.
4. Ábrela desde el ícono: se abre a pantalla completa, sin barras de Safari, como una app.
5. Entra con el correo y contraseña del paso 2.

---

## Paso 5 · Prueba la Fase 1 (lista de chequeo)

La primera vez la app crea sola tus 4 negocios (JH Autos, Personal, JH Bikes con socio 40 %, Oro) y sus categorías.

- [ ] **Cuentas:** toca *Crear mi primera cuenta*. Crea tus cuentas reales con el saldo de hoy: bolsillos de
      Bancolombia 1 y 2 (escribe el banco exacto, ej. “Bancolombia 2”), efectivo, tarjeta (escribe la deuda) y una de **Dólares** (moneda USD).
      Pon un **saldo mínimo** a alguna para probar la alerta.
- [ ] **Tasa del dólar:** *Más → Tasa del dólar* → escribe la de hoy.
- [ ] **Gasto cruzado:** botón **+** → Gasto de $80.000 desde tu cuenta *Personal* pero negocio **JH Autos**.
      Verás el aviso “Baja el saldo de… pero cuenta en la utilidad de JH Autos”.
- [ ] **Ingreso:** + → Ingreso → una venta de JH Autos.
- [ ] **Transferencia:** + → Transferencia de JH Autos a Personal. Revisa en Estadísticas que **no** cuenta como gasto ni ingreso.
- [ ] **Dólares:** registra un gasto en la cuenta de dólares y un cambio de dólares a pesos (transferencia: te pregunta cuánto llegó).
- [ ] **Negocios (como “Espacios” de Lukas):** toca la pastilla de arriba (GLOBAL ▾) y cambia de negocio,
      o **desliza la tarjeta verde** de Inicio a la izquierda/derecha.
- [ ] **Deslizar movimientos:** en *Movimientos*, desliza un movimiento a la izquierda → **Editar / Borrar**.
- [ ] **Buscar y filtrar:** busca “gasolina”, filtra por tipo, cuenta y mes.
- [ ] **Estadísticas:** mira ingresos, egresos, utilidad, gráfica de 6 meses (toca una barra para ir a ese mes)
      y gastos por categoría. En **JH Bikes** verás el reparto con tu socio.
- [ ] **Cuadre por banco:** *Más → Cuadre por banco* y compara con la app de Bancolombia.
      Si algo no cuadra, entra a la cuenta y escribe el saldo real: la app lo ajusta.
- [ ] **Exportar:** *Más → Exportar todo a Excel* (o el ícono ↓ en Movimientos). Se abre en Excel o Numbers.

Cuéntame qué te gustó y qué cambiarías, y seguimos con la **Fase 2** (deudas, pagos fijos, presupuestos y metas).

---

## Preguntas frecuentes

**¿Mis datos están seguros?** Sí. Cada tabla tiene seguridad por usuario (solo tu usuario las puede leer),
el registro de nuevos usuarios está cerrado y la conexión es cifrada.

**¿Y si pierdo el celular?** Los datos viven en Supabase, no en el teléfono. Instalas la app en el nuevo y entras con tu correo.

**Respaldo:** cada mes usa *Más → Exportar todo a Excel* y guarda el archivo en iCloud/Drive.
(Supabase gratis no ofrece copias descargables automáticas.)

**Supabase “pausó” el proyecto:** pasa si nadie la usa en 7 días. Entra a supabase.com → tu proyecto → **Restore**.

**¿Cómo se actualiza la app?** Cada vez que yo suba cambios a GitHub, Vercel la publica sola en 1 minuto.
En el iPhone basta con cerrarla y abrirla otra vez.
