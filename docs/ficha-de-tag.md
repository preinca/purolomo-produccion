# Ficha de TAG

## Propósito

Abre una paleta por su número: kilos recibidos, consumidos y disponibles, estado, observación, QR, movimientos y mini lotes. Desde aquí un administrador o un recepcionista puede guardar la observación, y cualquier rango puede imprimir la vista o seguir hacia salidas.

La ruta no está en el menú. Se llega desde el panel, las tablas, el registro de entrada, logística, el historial de salidas y el buscador del encabezado.

## Quién lo usa

Cualquier rango con sesión. `/lote` está en las rutas de consulta, así que el proxy deja pasar a todos.

Guardar la observación exige `administrador` o `recepcionista`. Los demás ven el texto y no el formulario de edición, porque la página solo monta `FormObservacion` cuando `puedeAvisar` es verdadero. La action igual vuelve a comprobar el rango.

El botón **Imprimir QR** usa la impresión del navegador. **Despachar** enlaza a `/salidas?tag=<tag>`; esa página no rellena el TAG sola. Ver [registrar-salidas.md](registrar-salidas.md).

La ficha monta `QrEtiqueta` sin `puedeImprimir` ni `puedeEliminar`, así que aquí no aparecen **Imprimir Zebra** ni **Eliminar**. Esos botones están en [buscar-tag.md](buscar-tag.md).

## Pasos

1. El usuario abre `/lote/<tag>`.
2. `buscarLote` lee la fila. Si no existe, la app responde con `not-found`: «No está esa paleta».
3. La cabecera muestra producto, código y, si el código está en el catálogo, tipo y descripción.
4. Tres fichas muestran kilos recibidos, kilos consumidos (despachados más consumidos) y kilos disponibles.
5. El estado usa `EstadoBadge`. Si el lote está en `LOGISTICA` o no le quedan kilos, el QR lo dice en el texto largo.
6. Quien puede avisar guarda la observación con `guardarObservacionTagFormulario`. El texto se recorta a 500 caracteres y reemplaza `lotes.observaciones`.
7. La tarjeta del QR lista los mini lotes del TAG y ofrece **Descargar QR** (`/qr/imagen/<tag>`).
8. La tabla **Movimientos** lista recepción, despacho, consumo o transferencia, con hora, destino, línea, kilos y estado.

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/lote/[tag]` | Ficha |
| `/qr/imagen/[tag]` | PNG del QR corto |
| `/salidas?tag=` | Enlace **Despachar** |

## Componentes

- `PageFrame`
- `QrEtiqueta`
- `FormObservacion`
- `EstadoBadge`
- `BotonImprimir`
- `BotonImprimirZebra` y `BotonEliminarTag`, dentro de `QrEtiqueta` según los permisos que reciba
- `Card` y `Table`

## Server actions

`guardarObservacionTagFormulario` en `src/app/actions.ts`.

No hay route handler propio de la ficha. El PNG es el de Buscar TAG.

## Tablas y consultas

Tablas `lotes`, `movimientos` y `minilotes`. RLS activado, sin políticas. La app usa la conexión directa.

- `SELECT * FROM lotes WHERE tag = ?`
- `SELECT * FROM movimientos WHERE tag = ? ORDER BY id DESC`
- Retiros del TAG: `minilotes` unidos a `pesajes` para el número del pesaje (`retirosDeTag`)
- `UPDATE lotes SET observaciones = ? WHERE tag = ?`

`eliminarLote`, si se usa desde la tarjeta, borra `movimientos` y `lotes` de ese TAG. No borra `minilotes` en `eliminarLote`. El detalle está en [eliminar-tag.md](eliminar-tag.md).

## Variables de entorno

- `DATABASE_URL` o `POSTGRES_URL`.
- `SESION_SECRETO`. Ver [autenticacion.md](autenticacion.md).

## Archivos relacionados

- [src/app/(panel)/lote/[tag]/page.tsx](<../src/app/(panel)/lote/[tag]/page.tsx>)
- [src/app/not-found.tsx](../src/app/not-found.tsx)
- [src/components/qr-etiqueta.tsx](../src/components/qr-etiqueta.tsx)
- [src/components/form-observacion.tsx](../src/components/form-observacion.tsx)
- [src/components/estado-badge.tsx](../src/components/estado-badge.tsx)
- [src/components/boton-imprimir.tsx](../src/components/boton-imprimir.tsx)
- [src/components/boton-imprimir-zebra.tsx](../src/components/boton-imprimir-zebra.tsx)
- [src/components/boton-eliminar-tag.tsx](../src/components/boton-eliminar-tag.tsx)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/components/ui/card.tsx](../src/components/ui/card.tsx)
- [src/components/ui/table.tsx](../src/components/ui/table.tsx)
- [src/components/ui/button.tsx](../src/components/ui/button.tsx)
- [src/app/actions.ts](../src/app/actions.ts)
- [src/lib/lotes.ts](../src/lib/lotes.ts)
- [src/lib/pesajes.ts](../src/lib/pesajes.ts)
- [src/lib/mpc.ts](../src/lib/mpc.ts)
- [src/lib/qr.ts](../src/lib/qr.ts)
- [src/lib/formato.ts](../src/lib/formato.ts)
- [src/lib/lineas.ts](../src/lib/lineas.ts)
- [src/lib/usuarios.ts](../src/lib/usuarios.ts)
- [src/lib/db.ts](../src/lib/db.ts)
- [src/app/(panel)/layout.tsx](<../src/app/(panel)/layout.tsx>)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [src/proxy.ts](../src/proxy.ts)
- [src/lib/acceso.ts](../src/lib/acceso.ts)
- [public/logo-purolomo.png](../public/logo-purolomo.png)
- [supabase/esquema.sql](../supabase/esquema.sql)
