# Panel de administración

## Propósito

Es la portada del panel (`/`, etiqueta del menú **Dashboard**, título **Panel de administración**). Resume cuántas paletas hay y los kilos recibidos, consumidos y en inventario, y lista las últimas paletas.

## Quién lo usa

Cualquier rango con sesión. Es la ruta de inicio después de entrar y también el destino cuando el proxy rechaza una ruta no permitida.

## Pasos

1. El layout del panel confirma la sesión.
2. La página llama a `resumir` y a `listarLotes` con límite 12, en paralelo.
3. Cuatro tarjetas muestran total de paletas, kg recibidos, kg consumidos (despachados más consumidos) y kg en inventario (recibidos menos despachados y consumidos).
4. **Últimas paletas** pinta esas filas con `TablaLotes`, sin la columna de estado. Cada TAG enlaza a `/lote/[tag]`.

No hay formulario ni escritura en esta pantalla.

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/` | Resumen y últimas paletas |

## Componentes

- `PageFrame`
- `TablaLotes`
- `Card`, `CardHeader`, `CardTitle`, `CardContent`
- Las tarjetas KPI están definidas en la misma página.

## Server actions y API routes

Esta pantalla no llama server actions ni route handlers. Lee con `getDb()` en el servidor.

Otras acciones revalidan `/` cuando cambian lotes, pesajes o recetas (`refrescar` en `src/app/actions.ts`).

## Tablas y consultas

Tabla `lotes`. RLS activado, sin políticas. La app usa la conexión directa y no depende de políticas de la API pública.

`resumir`:

```sql
SELECT
  COUNT(*) AS paletas,
  COALESCE(SUM(kg_recibidos), 0) AS kg_recibidos,
  COALESCE(SUM(kg_despachados), 0) AS kg_despachados,
  COALESCE(SUM(kg_consumidos), 0) AS kg_consumidos
FROM lotes
```

`listarLotes` con límite 12 y sin filtro de estado ni texto:

```sql
SELECT * FROM lotes
WHERE (?::text = '' OR estado = ?)
  AND (?::text = '' OR tag ILIKE ? OR producto ILIKE ? OR codigo ILIKE ? OR semana ILIKE ? OR destino ILIKE ?)
ORDER BY fecha DESC, tag DESC
LIMIT ?
```

En esta página los filtros van vacíos, así que entran todas las paletas, incluidas las de estado `LOGISTICA`.

## Variables de entorno

- `DATABASE_URL` o `POSTGRES_URL`.
- `SESION_SECRETO` para la cookie que exige el layout. Ver [autenticacion.md](autenticacion.md).

## Archivos relacionados

- [src/app/(panel)/page.tsx](<../src/app/(panel)/page.tsx>)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/components/tabla-lotes.tsx](../src/components/tabla-lotes.tsx)
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
