# Eliminar TAG

## Propósito

Borra un TAG y el historial de movimientos de esa paleta. La página lo dice así: solo el administrador puede borrar un TAG generado antes. Hay dos entradas: la pantalla **Eliminar TAG** (`/eliminar`, fuera del menú) y el botón de la tarjeta QR en **Buscar TAG**. La ficha `/lote/[tag]` no muestra ese botón.

## Quién lo usa

Solo `administrador`.

`/eliminar` no está en el menú ni en las rutas de consulta, recepción o pesaje. El proxy manda a los demás rangos a `/`. La página además llama a `exigirAdmin`. `eliminarLoteFormulario` también llama a `exigirAdmin`, así que el botón de la tarjeta QR no sirve con otro rango.

## Pasos

1. Desde `/eliminar`, el administrador ve hasta 300 lotes. `EliminarEnVivo` filtra por TAG, producto o código.
2. Al elegir una paleta, `EliminarLoteForm` pide marcar la confirmación.
3. Desde **Buscar TAG**, `BotonEliminarTag` usa la misma action y también pide la confirmación. La ficha del TAG no pasa `puedeEliminar`, así que ese botón no sale ahí.
4. `eliminarLoteFormulario` rechaza el envío si `confirmar` no es `si`.
5. `eliminarLote` borra los movimientos de ese TAG y después el lote, en una transacción.
6. Desde el formulario redirige a `/qr?eliminado=<tag>`. La pantalla `/eliminar` también lee `?eliminado=` si se abre con ese parámetro; la action de borrado no redirige ahí.

La función no borra filas de `minilotes` ni de `impresion_items`. Si el TAG ya se usó en un pesaje, el mini lote puede quedar apuntando a un TAG que ya no está en `lotes`.

Tampoco es el borrado de una etiqueta todavía dentro del proceso de recepción. Ese está en [registrar-entradas.md](registrar-entradas.md) y sí comprueba que el lote no se haya usado.

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/eliminar` | Buscar y confirmar el borrado |
| `/eliminar?eliminado=` | Aviso, si se abre la ruta con ese parámetro |
| `/qr` y `/lote/[tag]` | El mismo borrado desde la tarjeta |
| `/qr?eliminado=` | Aviso después de borrar |

## Componentes

- `EliminarEnVivo`
- `EliminarLoteForm`
- `BotonEliminarTag`
- `PageFrame`

## Server actions

`eliminarLoteFormulario` en `src/app/actions.ts`.

## Tablas y consultas

Tablas `lotes` y `movimientos`. RLS activado, sin políticas. La app usa la conexión directa.

La lista usa `listarLotes` con límite 300.

El borrado:

```sql
DELETE FROM movimientos WHERE tag = ?
```

```sql
DELETE FROM lotes WHERE tag = ?
```

Antes comprueba `SELECT * FROM lotes WHERE tag = ?`. Si no existe, devuelve «No existe ese TAG.»

## Variables de entorno

- `DATABASE_URL` o `POSTGRES_URL`.
- `SESION_SECRETO`. Ver [autenticacion.md](autenticacion.md).

## Archivos relacionados

- [src/app/(panel)/eliminar/page.tsx](<../src/app/(panel)/eliminar/page.tsx>)
- [src/components/eliminar-en-vivo.tsx](../src/components/eliminar-en-vivo.tsx)
- [src/components/eliminar-lote-form.tsx](../src/components/eliminar-lote-form.tsx)
- [src/components/boton-eliminar-tag.tsx](../src/components/boton-eliminar-tag.tsx)
- [src/components/campo-filtro.tsx](../src/components/campo-filtro.tsx)
- [src/components/estado-badge.tsx](../src/components/estado-badge.tsx)
- [src/components/ui/card.tsx](../src/components/ui/card.tsx)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/app/actions.ts](../src/app/actions.ts)
- [src/lib/lotes.ts](../src/lib/lotes.ts)
- [src/lib/lotes.test.ts](../src/lib/lotes.test.ts)
- [src/lib/usuarios.ts](../src/lib/usuarios.ts)
- [src/lib/acceso.ts](../src/lib/acceso.ts)
- [src/lib/formato.ts](../src/lib/formato.ts)
- [src/lib/coincide.ts](../src/lib/coincide.ts)
- [src/lib/db.ts](../src/lib/db.ts)
- [src/app/(panel)/layout.tsx](<../src/app/(panel)/layout.tsx>)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [src/proxy.ts](../src/proxy.ts)
- [supabase/esquema.sql](../supabase/esquema.sql)
