---
description: Registra una venta; el contador hace todo lo demás
argument-hint: vendí el [carro] en [precio]
---

Julián cerró una venta: $ARGUMENTS

Usa el subagente **contador** para:
1. Encontrar el carro en Inventario (si hay duda, preguntar cuál).
2. Preguntar en un solo mensaje lo que falte: fecha, forma de pago, canal del cliente, gastos asociados y comisión si es consignación.
3. Registrar la venta en Ventas, los gastos nuevos en Gastos y marcar el carro como Vendido en Inventario.
4. Mostrar la utilidad real y el margen.

Después usa el subagente **secretaria** para anotar en Pendientes lo que falta para cerrar: traspaso, entrega con la experiencia de marca (funda, moño, champaña, video) y pedir el permiso del cliente para publicar la entrega.
