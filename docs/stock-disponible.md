# Stock disponible

## Propósito

Lista las paletas que no están en logística y deja filtrarlas por TAG, producto o código mientras se escribe. El título de la página es **Stock disponible**.

No está en el menú lateral. Cualquier rango puede abrir `/stock` si conoce la ruta, porque está en las rutas de consulta del proxy.

## Quién lo usa

Cualquier rango con sesión.

## Pasos

1. El usuario abre `/stock`.
2. `listarLotes` trae hasta 300 lotes, ordenados por fecha y TAG descendentes.
3. La página descarta los de estado `LOGISTICA`.
4. `StockEnVivo` filtra en el navegador por TAG, producto, código, semana o destino. No hay una consulta nueva por cada letra. El texto de la página nombra TAG, producto o código.
5. La lista muestra el lote y enlaza el TAG a su ficha.

No se registran salidas ni entradas desde esta pantalla.

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/stock` | Stock filtrable |

## Componentes

- `StockEnVivo`
- `CampoFiltro`
- `TablaLotes`
- `Card`
- `PageFrame`

## Server actions y API routes

Ninguna.

## Tablas y consultas

Tabla `lotes`. RLS activado, sin políticas. La app usa la conexión directa.

`listarLotes` con límite 300 y sin filtro de texto ni de estado:

```sql
SELECT * FROM lotes
WHERE (?::text = '' OR estado = ?)
  AND (?::text = '' OR tag ILIKE ? OR producto ILIKE ? OR codigo ILIKE ? OR semana ILIKE ? OR destino ILIKE ?)
ORDER BY fecha DESC, tag DESC
LIMIT ?
```

El estado `LOGISTICA` se quita después, en la página. Un lote agotado que no esté en ese estado sigue en la lista.

## Variables de entorno

- `DATABASE_URL` o `POSTGRES_URL`.
- `SESION_SECRETO`. Ver [autenticacion.md](autenticacion.md).

## Archivos relacionados

- [src/app/(panel)/stock/page.tsx](<../src/app/(panel)/stock/page.tsx>)
- [src/components/stock-en-vivo.tsx](../src/components/stock-en-vivo.tsx)
- [src/components/campo-filtro.tsx](../src/components/campo-filtro.tsx)
- [src/components/tabla-lotes.tsx](../src/components/tabla-lotes.tsx)
- [src/components/ui/card.tsx](../src/components/ui/card.tsx)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/components/ui/table.tsx](../src/components/ui/table.tsx)
- [src/lib/lotes.ts](../src/lib/lotes.ts)
- [src/lib/coincide.ts](../src/lib/coincide.ts)
- [src/lib/formato.ts](../src/lib/formato.ts)
- [src/lib/db.ts](../src/lib/db.ts)
- [src/app/(panel)/layout.tsx](<../src/app/(panel)/layout.tsx>)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [src/proxy.ts](../src/proxy.ts)
- [src/lib/acceso.ts](../src/lib/acceso.ts)
- [supabase/esquema.sql](../supabase/esquema.sql)
