# Buscar mini lote

## Propósito

Encuentra un retiro de materia prima (mini lote) por parte del token, del TAG, del número de pesaje o del código del pesaje. Muestra kilos, tipo, línea, destino y cuánto queda en la paleta de origen.

El menú lo llama **Buscar mini lote**.

## Quién lo usa

Cualquier rango con sesión. El menú lo muestra a todos y `/minilotes` está en las rutas de consulta.

## Pasos

1. El usuario abre `/minilotes`, o llega con `?codigo=` desde el buscador del encabezado.
2. En el servidor se cargan todos los pesajes, todos los mini lotes, los códigos de pesaje y los lotes de esos TAG.
3. `BuscarMiniLote` filtra en el navegador mientras se escribe. No vuelve a consultar la base en cada tecla.
4. Cada coincidencia muestra el token (`ML` y cuatro caracteres, o el formato viejo de seis dígitos), el tipo, los kilos, el TAG, el pesaje, la línea, el destino, el código del pesaje y los kilos recibidos, consumidos y disponibles del TAG.
5. Si el TAG ya no tiene kilos, la ficha lo marca como agotado.

El parámetro `codigo` solo precarga el texto. La página no rechaza un código inexistente: la lista queda vacía al filtrar.

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/minilotes` | Búsqueda con la lista completa en el cliente |
| `/minilotes?codigo=` | La misma página con el texto inicial |

## Componentes

- `BuscarMiniLote`
- `CampoFiltro`
- `EstadoBadge`
- `Card`
- `PageFrame`

## Server actions y API routes

Ninguna en esta página. El armado de las fichas está en el servidor de la página.

## Tablas y consultas

Tablas `minilotes`, `pesajes`, `lotes` y `receta_items` (para armar el código del pesaje). RLS activado, sin políticas. La app usa la conexión directa.

- `SELECT * FROM pesajes ORDER BY fecha DESC, numero DESC`
- Mini lotes con el número del pesaje:

```sql
SELECT m.*, p.numero AS numero
FROM minilotes m
JOIN pesajes p ON p.id = m.pesaje_id
ORDER BY m.creado_en DESC, m.token DESC
```

- `SELECT * FROM lotes WHERE tag = ANY(?::text[])`
- `SELECT pesaje_id, tipo, token, tag, kg FROM minilotes WHERE pesaje_id = ANY(?::int[]) ORDER BY creado_en, token`
- `SELECT receta_id, tipo FROM receta_items WHERE receta_id = ANY(?::int[]) ORDER BY id`

`listarMiniLotesTodos` es la consulta con el `JOIN`. El código del pesaje se calcula en memoria con `codigoDePesaje`.

## Variables de entorno

- `DATABASE_URL` o `POSTGRES_URL`.
- `SESION_SECRETO`. Ver [autenticacion.md](autenticacion.md).

## Archivos relacionados

- [src/app/(panel)/minilotes/page.tsx](<../src/app/(panel)/minilotes/page.tsx>)
- [src/components/buscar-minilote.tsx](../src/components/buscar-minilote.tsx)
- [src/components/campo-filtro.tsx](../src/components/campo-filtro.tsx)
- [src/components/estado-badge.tsx](../src/components/estado-badge.tsx)
- [src/components/ui/card.tsx](../src/components/ui/card.tsx)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/lib/pesajes.ts](../src/lib/pesajes.ts)
- [src/lib/minilote.ts](../src/lib/minilote.ts)
- [src/lib/lotes.ts](../src/lib/lotes.ts)
- [src/lib/mpc.ts](../src/lib/mpc.ts)
- [src/lib/coincide.ts](../src/lib/coincide.ts)
- [src/lib/formato.ts](../src/lib/formato.ts)
- [src/lib/arreglo-pg.ts](../src/lib/arreglo-pg.ts)
- [src/lib/db.ts](../src/lib/db.ts)
- [src/app/(panel)/layout.tsx](<../src/app/(panel)/layout.tsx>)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [src/proxy.ts](../src/proxy.ts)
- [src/lib/acceso.ts](../src/lib/acceso.ts)
- [supabase/esquema.sql](../supabase/esquema.sql)
