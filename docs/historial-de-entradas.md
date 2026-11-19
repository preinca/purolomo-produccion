# Historial de entradas

## Propósito

Lista las recepciones guardadas, de la más reciente a la más antigua, con TAG, producto, kilos y estado. El título de la página es **Historial de entradas**.

No está en el menú. La consulta filtrable por producto y día, con PDF, es [registro-de-entrada.md](registro-de-entrada.md). Esta ruta sigue existiendo y el proxy la deja abierta a cualquier rango.

El texto de la página dice que las recepciones están en SQLite. Los datos se leen de Postgres por `DATABASE_URL`.

## Quién lo usa

Cualquier rango con sesión. `/historial` está en las rutas de consulta, así que `/historial/entradas` también.

## Pasos

1. El usuario abre `/historial/entradas`.
2. `listarLotes` trae hasta 300 filas, sin filtrar por estado.
3. `TablaLotes` las muestra. El TAG enlaza a `/lote/[tag]`.
4. Si no hay filas, dice «Todavía no hay entradas.»

No hay filtro ni alta.

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/historial/entradas` | Últimas 300 paletas |

## Componentes

- `PageFrame`
- `TablaLotes`
- `Card`

## Server actions y API routes

Ninguna.

## Tablas y consultas

Tabla `lotes`. RLS activado, sin políticas. La app usa la conexión directa.

La misma consulta de `listarLotes` documentada en [panel-de-administracion.md](panel-de-administracion.md), con límite 300. Incluye paletas en `LOGISTICA` y el resto de estados.

## Variables de entorno

- `DATABASE_URL` o `POSTGRES_URL`.
- `SESION_SECRETO`. Ver [autenticacion.md](autenticacion.md).

## Archivos relacionados

- [src/app/(panel)/historial/entradas/page.tsx](<../src/app/(panel)/historial/entradas/page.tsx>)
- [src/components/tabla-lotes.tsx](../src/components/tabla-lotes.tsx)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/components/ui/card.tsx](../src/components/ui/card.tsx)
- [src/components/ui/table.tsx](../src/components/ui/table.tsx)
- [src/lib/lotes.ts](../src/lib/lotes.ts)
- [src/lib/formato.ts](../src/lib/formato.ts)
- [src/lib/db.ts](../src/lib/db.ts)
- [src/app/(panel)/layout.tsx](<../src/app/(panel)/layout.tsx>)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [src/proxy.ts](../src/proxy.ts)
- [src/lib/acceso.ts](../src/lib/acceso.ts)
- [supabase/esquema.sql](../supabase/esquema.sql)
