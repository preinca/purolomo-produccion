# Búsqueda global

## Propósito

El campo **Buscar TAG o pesaje** del encabezado propone TAG, mini lotes y pesajes sin salir de la pantalla. No es una página propia: está en el `Shell` de todo el panel.

## Quién lo usa

Cualquier rango con sesión, porque el encabezado solo se monta después de que el layout confirma la sesión. La action vuelve a llamar a `exigirSesion`.

## Pasos

1. El usuario escribe al menos dos caracteres.
2. Tras 300 ms, `BuscadorGlobal` llama a `buscarSugerenciasAccion` con el texto recortado a 40 caracteres.
3. `buscarSugerencias` consulta en paralelo hasta seis lotes, seis mini lotes y seis pesajes.
4. Cada sugerencia es un enlace:
   - el lote va a `/lote/<tag>`;
   - el mini lote va a `/minilotes?codigo=<token>`;
   - el pesaje va a `/consulta-pesaje?codigo=<código del pesaje>`.
5. Al cambiar de ruta, el campo se vacía y se cierra la lista.
6. Si la consulta falla, la lista queda vacía.

El código del pesaje que se usa de título y de enlace se calcula con los mini lotes y el orden de la receta. Si el pesaje todavía no tiene retiros, el título es «Pesaje <número>» y el enlace lleva `codigo` vacío.

## Rutas y páginas

No tiene ruta. Vive en el encabezado de las páginas del panel. Los destinos son:

| Destino | Flujo |
| --- | --- |
| `/lote/[tag]` | [ficha-de-tag.md](ficha-de-tag.md) |
| `/minilotes?codigo=` | [buscar-mini-lote.md](buscar-mini-lote.md) |
| `/consulta-pesaje?codigo=` | [buscar-pesaje.md](buscar-pesaje.md) |

## Componentes

- `BuscadorGlobal`, montado por `Shell`

## Server actions

`buscarSugerenciasAccion` en `src/app/buscar-accion.ts`.

## Tablas y consultas

Tablas `lotes`, `minilotes`, `pesajes` y `receta_items`. RLS activado, sin políticas. La app usa la conexión directa.

```sql
SELECT tag, producto, codigo FROM lotes
WHERE tag ILIKE ? OR producto ILIKE ? OR codigo ILIKE ?
ORDER BY creado_en DESC
LIMIT 6
```

```sql
SELECT token, tipo, kg, tag FROM minilotes
WHERE token ILIKE ? OR tag ILIKE ?
ORDER BY creado_en DESC
LIMIT 6
```

```sql
SELECT * FROM pesajes
WHERE numero::text ILIKE ? OR fecha ILIKE ?
ORDER BY fecha DESC, numero DESC
LIMIT 6
```

El patrón es `%texto%`. No escapa `%` ni `_` escritos por el usuario. Después, `codigosDePesajes` lee `minilotes` y `receta_items` de esos pesajes para armar el código.

## Variables de entorno

- `DATABASE_URL` o `POSTGRES_URL`.
- `SESION_SECRETO`. Ver [autenticacion.md](autenticacion.md).

## Archivos relacionados

- [src/components/buscador-global.tsx](../src/components/buscador-global.tsx)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [src/app/buscar-accion.ts](../src/app/buscar-accion.ts)
- [src/lib/busqueda.ts](../src/lib/busqueda.ts)
- [src/lib/sugerencia.ts](../src/lib/sugerencia.ts)
- [src/lib/pesajes.ts](../src/lib/pesajes.ts)
- [src/lib/minilote.ts](../src/lib/minilote.ts)
- [src/lib/usuarios.ts](../src/lib/usuarios.ts)
- [src/lib/db.ts](../src/lib/db.ts)
- [src/app/(panel)/layout.tsx](<../src/app/(panel)/layout.tsx>)
- [supabase/esquema.sql](../supabase/esquema.sql)
