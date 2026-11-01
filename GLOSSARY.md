# Glosario de Finanzas

Lenguaje del dominio compartido por la API (`v2-api-finanzas`) y el front (`gestor-Finanzas`). Los nombres de módulos nuevos salen de aquí. Vocabulario de arquitectura (módulo, interfaz, profundidad, seam, adaptador, apalancamiento, localidad): skill `codebase-design`.

## Dinero y cuentas

- **Cuenta**: lugar donde está el dinero propio (ahorros, corriente, efectivo, billetera, inversión). Tiene moneda y saldo.
- **Tarjeta**: tarjeta de crédito con cupo, fecha de corte y fecha de pago. Su saldo negativo es **deuda de tarjeta**.
- **Saldo**: lo que hay en una cuenta según los movimientos asentados. La fuente de verdad es el servidor.
- **Disponible**: suma de saldos de cuentas menos deuda de tarjetas.
- **Moneda base**: moneda de la organización; los totales se expresan en ella.

## Movimientos

- **Movimiento**: hecho económico asentado en el libro. Tiene clase (`MovementKind`), efecto (ingreso, gasto, neutro), flujo de caja (entra, sale, ninguno), monto y enlaces (cuenta, tarjeta, posición, obligación, categoría, persona).
- **Económico**: movimiento que cuenta como ingreso o gasto. Transferencias, pagos de tarjeta, préstamos y avances no son económicos.
- **Intención de movimiento**: lo que la persona quiere registrar (gasto, ingreso, transferencia, avance, pago, préstamo, compra para tercero, compra con tarjeta prestada, corrección, reclasificación) antes de convertirse en movimientos.
- **Asentar**: validar una intención contra las reglas de su clase y escribirla en el libro, con sus efectos (caché de saldos, auditoría).
- **Reversar**: anular un movimiento con otro de signo contrario.
- **Reclasificar**: cambiar categoría o datos sin tocar el monto.

## Periodo y filtros

- **Periodo**: rango de fechas activo (día, semana, mes, año o rango libre).
- **Filtro de movimientos**: periodo + cuenta + tipo de cuenta + categoría + texto + flujo. Un solo valor con tres traducciones: predicado en memoria, consulta al servidor y URL.
- **Resumen del periodo**: ingreso, gasto, neto y tasa de ahorro de los movimientos económicos de un periodo y filtro.
- **Tasa de ahorro**: neto / ingreso del periodo. Sin ingreso no hay dato (no es 0 %).

## Deudas con personas

- **Persona**: contraparte (persona o entidad) con quien hay deudas.
- **Obligación**: deuda abierta con una persona, por pagar o por cobrar. Agregado con capital, tasa, plazo y asientos.
- **Asiento de obligación**: desembolso, cargo, pago o interés que mueve el saldo de una obligación.
- **Saldo pendiente**: lo que falta pagar de una obligación según sus asientos. Nunca el capital original (`Principal`).
- **Libro de obligaciones**: módulo que carga obligaciones ya reconstruidas desde sus asientos y asienta entradas nuevas.
- **Cerrada**: obligación liquidada según su agregado (o marcada así en datos viejos). Una sola definición, en el Libro de obligaciones.
- **Otras monedas**: saldos con una persona en monedas distintas de la base; se muestran aparte, nunca se ocultan.
- **Liquidación**: cierre de cuentas con una persona en un corte; parte de los saldos pendientes.
- **Compra compartida**: compra pagada por la persona usuaria que otra persona debe en todo o en parte.

## Patrimonio

- **Inversión (posición)**: activo con instrumento, riesgo, símbolo, institución y moneda.
- **Operación de inversión**: aporte, retiro, compra, venta, dividendo o comisión; asienta su movimiento.
- **Valorización**: valor de mercado de una inversión en una fecha.
- **Costo**: lo invertido; con unidades, costo promedio ponderado; sin unidades, aportes netos.

## Organización y miembros

- **Organización**: espacio de datos compartido; cada persona usuaria es **miembro** de una o varias.
- **Datos del miembro**: todas las filas que pertenecen a un miembro dentro de una organización (cuentas, movimientos, obligaciones y sus asientos, inversiones, presupuestos, preferencias…). Se derivan de los metadatos del modelo, no de listas escritas a mano.
- **Conjunto del miembro**: una tabla de datos del miembro con su política (mudar, borrar, exportar) y su nombre de colección en la exportación.
- **Mudanza del miembro**: mover a un miembro y todos sus datos a otra organización en una sola transacción.
- **Adaptador de mudanza**: implementación de la Mudanza del miembro para Postgres o en memoria.
- **Borrado de datos personales**: eliminar todos los datos del miembro a pedido.
- **Error de negocio**: regla del dominio que no se cumple; tiene código estable y se traduce una vez a respuesta HTTP (no encontrado, inválido, no procesable, conflicto, prohibido).

## Tablero

- **Tablero**: diseño de indicadores y widgets; el principal es por persona, los demás se guardan en el servidor y se pueden compartir en solo lectura.
- **Indicador (KPI)**: cifra del tablero; fijo, precargado o propio (con fórmula).
- **Widget**: gráfica o tabla del tablero. Su tipo se define una vez en el **catálogo de widgets**.
- **Oculto**: widget o indicador quitado del tablero que se puede volver a mostrar.
- **Entidad seleccionada**: lo que muestra el inspector (movimiento, cuenta, tarjeta, día, persona o inversión).
