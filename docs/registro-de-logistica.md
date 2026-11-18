# Registro de Logística

## Propósito

Lista las salidas de materia prima que se trasladaron a logística: fecha, semana, TAG, tipo MPC, producto, kilos y observación. El menú lo llama **Registro de Logística**.

El traslado se hace en **Registrar salidas**, modo logística. Esta pantalla solo consulta.

## Quién lo usa

Cualquier rango con sesión. El menú lo muestra a todos y `/logistica` está en las rutas de consulta.

## Pasos

1. El usuario abre `/logistica`.
2. La página pide los movimientos de tipo `transferencia`, hasta 300, del más reciente al más antiguo.
3. Con esos TAG busca los lotes y el tipo en el catálogo en memoria.
4. Cada TAG enlaza a `/lote/[tag]`.
5. Si no hay traslados, dice «Todavía no hay salidas hacia logística.»

No hay filtro ni exportación.

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/logistica` | Relación de traslados |

## Componentes

- `PageFrame`
- `Card`
- `Table` y celdas, en pantallas medianas. En pantallas chicas la lista es un `article` por movimiento.

## Server actions y API routes

Ninguna. La lectura ocurre en el servidor de la página.

## Tablas y consultas

Tablas `movimientos` y `lotes`. RLS activado, sin políticas. La app usa la conexión directa.

```sql
SELECT * FROM movimientos
WHERE tipo = 'transferencia'
ORDER BY fecha DESC, id DESC
LIMIT 300
```

```sql
SELECT * FROM lotes WHERE tag = ANY(?::text[])
```

El tipo (Z, C, DD, etc.) no está en el movimiento: se obtiene con `productoPorCodigo` a partir de `lotes.codigo`. La nota del movimiento es la observación que se escribió al trasladar, con el prefijo «Trasladado a logística.»

## Variables de entorno

- `DATABASE_URL` o `POSTGRES_URL`.
- `SESION_SECRETO`. Ver [autenticacion.md](autenticacion.md).

## Archivos relacionados

- [src/app/(panel)/logistica/page.tsx](<../src/app/(panel)/logistica/page.tsx>)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/components/ui/card.tsx](../src/components/ui/card.tsx)
- [src/components/ui/table.tsx](../src/components/ui/table.tsx)
- [src/lib/lotes.ts](../src/lib/lotes.ts)
- [src/lib/mpc.ts](../src/lib/mpc.ts)
- [src/lib/formato.ts](../src/lib/formato.ts)
- [src/lib/arreglo-pg.ts](../src/lib/arreglo-pg.ts)
- [src/lib/db.ts](../src/lib/db.ts)
- [src/app/(panel)/layout.tsx](<../src/app/(panel)/layout.tsx>)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [src/proxy.ts](../src/proxy.ts)
- [src/lib/acceso.ts](../src/lib/acceso.ts)
- [supabase/esquema.sql](../supabase/esquema.sql)
