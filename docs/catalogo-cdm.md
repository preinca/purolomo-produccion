# Catálogo CDM

## Propósito

Muestra la leyenda de materia prima cárnica (MPC) y los códigos del CDM de octubre 2026: tipo, producto, código y descripción. Es la misma lista que usa el formulario de recepción para validar el producto. La pantalla no edita el catálogo.

`/nomenclatura` no tiene contenido propio: redirige a `/inventario`.

## Quién lo usa

Cualquier rango con sesión. El menú lo llama **Catálogo CDM** y lo muestra a todos.

## Pasos

1. El usuario abre `/inventario` desde el menú, o llega por `/nomenclatura`.
2. La página recorre la constante `PRODUCTOS_MPC` y arma una ficha por producto en pantallas chicas y una tabla en pantallas medianas.
3. No hay filtro, alta ni consulta a la base en esta pantalla.

Para cambiar un código hay que editar `PRODUCTOS_MPC` en `src/lib/mpc.ts`. `asegurarCatalogo` (`src/lib/seed.ts`) copia esa misma lista a la tabla `productos` cuando corre `npm run db:migrar`. Las pantallas de recepción y de consulta leen el arreglo del código, no la tabla.

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/inventario` | Lista el catálogo |
| `/nomenclatura` | Redirige a `/inventario` |

## Componentes

- `PageFrame`
- `Card`, `CardHeader`, `CardTitle`, `CardContent`
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`

## Server actions y API routes

Ninguna. La página es estática respecto a la base.

## Tablas y consultas

Esta pantalla no consulta Supabase.

La tabla `productos` existe en el esquema (`codigo`, `nombre`, `tipo`, `descripcion`) y tiene RLS activado sin políticas. La llena `asegurarCatalogo` durante la migración:

```sql
INSERT INTO productos (codigo, nombre, tipo, descripcion) VALUES (?, ?, ?, ?)
ON CONFLICT (codigo) DO UPDATE
SET nombre = excluded.nombre, tipo = excluded.tipo, descripcion = excluded.descripcion
```

Los tipos que usa el resto de la aplicación (Z, C, BF, CH, DD, GP, GL, RR, R#2 y el resto del arreglo) salen de `PRODUCTOS_MPC`. Los estados de un lote están en `ESTADOS_LOTE`: `TRANSFIRIO`, `RECIBIDO`, `CONSUMIDOS`, `DEVUELTO` y `LOGISTICA`.

## Variables de entorno

Ninguna propia de esta pantalla. La sesión sigue usando `SESION_SECRETO`. Ver [autenticacion.md](autenticacion.md).

## Archivos relacionados

- [src/app/(panel)/inventario/page.tsx](<../src/app/(panel)/inventario/page.tsx>)
- [src/app/(panel)/nomenclatura/page.tsx](<../src/app/(panel)/nomenclatura/page.tsx>)
- [src/lib/mpc.ts](../src/lib/mpc.ts)
- [src/lib/seed.ts](../src/lib/seed.ts)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/components/ui/card.tsx](../src/components/ui/card.tsx)
- [src/components/ui/table.tsx](../src/components/ui/table.tsx)
- [src/app/(panel)/layout.tsx](<../src/app/(panel)/layout.tsx>)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [src/proxy.ts](../src/proxy.ts)
- [src/lib/acceso.ts](../src/lib/acceso.ts)
- [scripts/migrar-supabase.ts](../scripts/migrar-supabase.ts)
- [supabase/esquema.sql](../supabase/esquema.sql)
