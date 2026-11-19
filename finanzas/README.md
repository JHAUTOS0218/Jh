# JH Finanzas

PWA de finanzas personales y de negocios (JH Autos, JH Bikes, Oro, Personal).
Next.js + Supabase + Vercel. Guía de instalación en español: **[GUIA.md](./GUIA.md)**.

## Estructura
- `supabase/00-instalar-todo.sql` — instalación nueva en un solo paso (01 + 02 + 03).
- `supabase/01-fase1.sql` — esquema (tablas, seguridad RLS, saldos, conversión USD, datos iniciales).
- `supabase/02-deudas-y-apariencia.sql` — deudas/cuentas por cobrar, movimientos `debt_in`/`debt_out` (no son ingreso ni gasto), color de la app.
- `supabase/03-pagos-fijos.sql` — pagos fijos mensuales; `transactions.recurring_id` marca el pago del mes.
- `src/lib/` — formato de pesos/fechas, conexión a Supabase, estado global, estadísticas, CSV.
- `src/components/` — barra inferior, hojas, filas deslizables, formulario de movimientos, gráficas.
- `src/app/` — pantallas: Inicio, Movimientos, Estadísticas, Más (Cuentas, Negocios, Cuadre).

## Conceptos
- **Cuenta** = dónde está la plata (mueve saldos). **Negocio** del movimiento = a qué utilidad afecta.
- Transferencias no cuentan como ingreso ni gasto.
- Montos en la moneda de la cuenta; `amount_cop` lo calcula la base de datos con la tasa del dólar.
- Categoría con `special = 'partner_payout'` = pago de utilidad al socio (no reduce la utilidad del negocio).

## Desarrollo local (opcional)
```bash
cp .env.example .env.local   # y pon tus llaves de Supabase
npm install
npm run dev
```

Fuentes: Michroma (títulos) y Open Sans, ambas con licencia OFL (ver `public/fonts`).
