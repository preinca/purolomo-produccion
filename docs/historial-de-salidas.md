# Historial de salidas

## Propósito

Lista consumos y despachos por TAG: fecha, tipo, producto de destino, línea, kilos y nota. El título de la página es **Historial de salidas**.

No está en el menú. Los traslados a logística no entran aquí; están en [registro-de-logistica.md](registro-de-logistica.md). El despacho de un pesaje sí, porque se guarda como movimiento `despacho`.

## Quién lo usa

Cualquier rango con sesión. `/historial` está en las rutas de consulta.

## Pasos

1. El usuario abre `/historial/salidas`.
2. La página pide hasta 200 movimientos `despacho` y hasta 200 `consumo`.
3. Junta las dos listas, las ordena por `id` descendente y se queda con 200.
4. La tabla muestra fecha, tipo, TAG (enlace a `/lote/[tag]`), destino, línea, kilos y nota.
5. Si no hay filas, dice «Todavía no hay salidas.»

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/historial/salidas` | Despachos y consumos recientes |

## Componentes

- `PageFrame`
- `Card`
- `Table`

La línea se traduce con `lineaPorId`: `1` es Línea 1 y `2` es Línea 2.

## Server actions y API routes

Ninguna.

## Tablas y consultas

Tabla `movimientos`. RLS activado, sin políticas. La app usa la conexión directa.

```sql
SELECT * FROM movimientos
WHERE tipo = ?
ORDER BY fecha DESC, id DESC
LIMIT 200
```

Se ejecuta dos veces, con `despacho` y con `consumo`. No une con `lotes`: el producto que se ve es `movimientos.destino` (el uso, por ejemplo ALIBAL 1 K), no el nombre MPC de la paleta.

## Variables de entorno

- `DATABASE_URL` o `POSTGRES_URL`.
- `SESION_SECRETO`. Ver [autenticacion.md](autenticacion.md).

## Archivos relacionados

- [src/app/(panel)/historial/salidas/page.tsx](<../src/app/(panel)/historial/salidas/page.tsx>)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/components/ui/card.tsx](../src/components/ui/card.tsx)
- [src/components/ui/table.tsx](../src/components/ui/table.tsx)
- [src/lib/lotes.ts](../src/lib/lotes.ts)
- [src/lib/lineas.ts](../src/lib/lineas.ts)
- [src/lib/formato.ts](../src/lib/formato.ts)
- [src/lib/db.ts](../src/lib/db.ts)
- [src/app/(panel)/layout.tsx](<../src/app/(panel)/layout.tsx>)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [src/proxy.ts](../src/proxy.ts)
- [src/lib/acceso.ts](../src/lib/acceso.ts)
- [supabase/esquema.sql](../supabase/esquema.sql)
