# Etiquetas en Cava

## Propósito

Historial de las etiquetas que se generan al registrar cada entrada. Se puede ver la etiqueta de un TAG y descargarla en NLBL (Zebra Designer 3.3) o en PDF, de 5,7 cm × 3,2 cm.

El menú la llama **Etiquetas en Cava**. Mandar un lote a la impresora de la oficina es otro flujo: [impresion-zebra.md](impresion-zebra.md). La vista previa durante la recepción está en [registrar-entradas.md](registrar-entradas.md).

## Quién lo usa

Cualquier rango con sesión. El menú lo muestra a todos y `/etiquetas` está en las rutas de consulta. Las descargas `/etiquetas/nlbl/[tag]` y `/etiquetas/pdf/[tag]` también pasan por el proxy, así que hace falta sesión.

## Pasos

1. El usuario abre `/etiquetas`.
2. La página lista los lotes por `creado_en` descendente, hasta 1000.
3. Si la URL trae `?tag=` con 4 a 8 dígitos y ese TAG existe, se muestra esa etiqueta. Si no, se muestra la más reciente.
4. La vista previa la arma `EtiquetaCava`: líneas de producto, fecha, hora, código y kilos, más el QR corto `PUROLOMO MPC` / `TAG:<tag>`.
5. **Descargar NLBL** abre `/etiquetas/nlbl/<tag>` y **Descargar PDF** abre `/etiquetas/pdf/<tag>`.
6. En el historial, **Ver** vuelve a `/etiquetas?tag=`. **NLBL** y **PDF** descargan sin cambiar la ficha.
7. Un TAG que no cumple el patrón responde 400. Un TAG con el patrón pero sin lote responde 404.

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/etiquetas` | Historial y vista de la más reciente |
| `/etiquetas?tag=` | Vista de ese TAG |
| `/etiquetas/nlbl/[tag]` | Archivo `.nlbl` |
| `/etiquetas/pdf/[tag]` | Archivo `.pdf` |

## Componentes

- `EtiquetaCava`, con `enlaceNlbl` y `enlacePdf`
- `PageFrame`
- `Card` y `Table`

## API routes

- `GET` `src/app/(panel)/etiquetas/nlbl/[tag]/route.ts`
- `GET` `src/app/(panel)/etiquetas/pdf/[tag]/route.ts`

No hay server action en esta pantalla. El contenido sale de `etiquetaDeLote` y de `textoQrDeEtiqueta`.

## Tablas y consultas

Tabla `lotes`. RLS activado, sin políticas. La app usa la conexión directa.

- `SELECT * FROM lotes ORDER BY creado_en DESC, tag DESC LIMIT ?` (`listarLotesPorRecepcion`, tope 1000 en la página y máximo 2000 en la función)
- `SELECT * FROM lotes WHERE tag = ?` al elegir un TAG o al generar el archivo

El texto de la etiqueta (nombre, descripción, tipo, hora en `America/Caracas`) se calcula en `src/lib/etiqueta-cava.ts` a partir del lote y de `PRODUCTOS_MPC`. No hay una tabla de etiquetas.

## Variables de entorno

- `DATABASE_URL` o `POSTGRES_URL`.
- `SESION_SECRETO`. Ver [autenticacion.md](autenticacion.md).

## Archivos relacionados

- [src/app/(panel)/etiquetas/page.tsx](<../src/app/(panel)/etiquetas/page.tsx>)
- [src/app/(panel)/etiquetas/nlbl/[tag]/route.ts](<../src/app/(panel)/etiquetas/nlbl/[tag]/route.ts>)
- [src/app/(panel)/etiquetas/pdf/[tag]/route.ts](<../src/app/(panel)/etiquetas/pdf/[tag]/route.ts>)
- [src/components/etiqueta-cava.tsx](../src/components/etiqueta-cava.tsx)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/components/ui/card.tsx](../src/components/ui/card.tsx)
- [src/components/ui/table.tsx](../src/components/ui/table.tsx)
- [src/lib/etiqueta-cava.ts](../src/lib/etiqueta-cava.ts)
- [src/lib/etiqueta-cava.test.ts](../src/lib/etiqueta-cava.test.ts)
- [src/lib/nlbl-etiqueta.ts](../src/lib/nlbl-etiqueta.ts)
- [src/lib/pdf-etiqueta.ts](../src/lib/pdf-etiqueta.ts)
- [src/lib/qr.ts](../src/lib/qr.ts)
- [src/lib/png-qr.ts](../src/lib/png-qr.ts)
- [src/lib/lotes.ts](../src/lib/lotes.ts)
- [src/lib/mpc.ts](../src/lib/mpc.ts)
- [src/lib/formato.ts](../src/lib/formato.ts)
- [src/lib/db.ts](../src/lib/db.ts)
- [src/app/(panel)/layout.tsx](<../src/app/(panel)/layout.tsx>)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [src/proxy.ts](../src/proxy.ts)
- [src/lib/acceso.ts](../src/lib/acceso.ts)
- [supabase/esquema.sql](../supabase/esquema.sql)
