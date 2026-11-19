# Buscar pesaje

## Propósito

Encuentra un pesaje por parte de su código, de una sigla de MPC o de un mini lote. Muestra el total, el avance de cada tipo contra la receta y los retiros que lo componen.

El menú lo llama **Buscar pesaje**. La ruta es `/consulta-pesaje`, no `/pesajes`. La planilla imprimible está en [registro-de-pesajes.md](registro-de-pesajes.md).

## Quién lo usa

Cualquier rango con sesión. El menú lo muestra a todos y `/consulta-pesaje` está en las rutas de consulta.

## Pasos

1. El usuario abre `/consulta-pesaje`, o llega con `?codigo=` desde el buscador del encabezado.
2. El servidor carga todos los pesajes, sus progresos, sus códigos, todos los mini lotes y los lotes de esos TAG.
3. `BuscarPesaje` filtra en el navegador mientras se escribe.
4. Cada ficha muestra número, fecha, destino, línea, total, código, observación, kilos usados contra el objetivo de cada tipo y los mini lotes con los kilos que aún quedan en el TAG.

Incluye pesajes en curso y finalizados, porque `listarPesajesTodos` no filtra `finalizado`.

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/consulta-pesaje` | Búsqueda |
| `/consulta-pesaje?codigo=` | Misma búsqueda con texto inicial |

## Componentes

- `BuscarPesaje`
- `CampoFiltro`
- `Card`
- `PageFrame`

## Server actions y API routes

Ninguna. La página arma las fichas en el servidor y el filtro queda en el cliente.

## Tablas y consultas

Tablas `pesajes`, `minilotes`, `recetas`, `receta_items` y `lotes`. RLS activado, sin políticas. La app usa la conexión directa.

- `SELECT * FROM pesajes ORDER BY fecha DESC, numero DESC`
- Mini lotes unidos a `pesajes` para traer el número (`listarMiniLotesTodos`)
- `SELECT * FROM lotes WHERE tag = ANY(?::text[])`
- Ítems y límites de las recetas de esos pesajes: `receta_items` y `recetas` por `id = ANY(...)`
- Mini lotes de esos pesajes para el código: `minilotes` por `pesaje_id = ANY(...)`

`progresosDePesajes` suma los kilos de `minilotes` y los compara con el objetivo, el mínimo y el máximo de cada tipo de la receta guardada en el pesaje.

## Variables de entorno

- `DATABASE_URL` o `POSTGRES_URL`.
- `SESION_SECRETO`. Ver [autenticacion.md](autenticacion.md).

## Archivos relacionados

- [src/app/(panel)/consulta-pesaje/page.tsx](<../src/app/(panel)/consulta-pesaje/page.tsx>)
- [src/components/buscar-pesaje.tsx](../src/components/buscar-pesaje.tsx)
- [src/components/campo-filtro.tsx](../src/components/campo-filtro.tsx)
- [src/components/ui/card.tsx](../src/components/ui/card.tsx)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/lib/pesajes.ts](../src/lib/pesajes.ts)
- [src/lib/lotes.ts](../src/lib/lotes.ts)
- [src/lib/minilote.ts](../src/lib/minilote.ts)
- [src/lib/coincide.ts](../src/lib/coincide.ts)
- [src/lib/formato.ts](../src/lib/formato.ts)
- [src/lib/arreglo-pg.ts](../src/lib/arreglo-pg.ts)
- [src/lib/db.ts](../src/lib/db.ts)
- [src/app/(panel)/layout.tsx](<../src/app/(panel)/layout.tsx>)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [src/proxy.ts](../src/proxy.ts)
- [src/lib/acceso.ts](../src/lib/acceso.ts)
- [supabase/esquema.sql](../supabase/esquema.sql)
