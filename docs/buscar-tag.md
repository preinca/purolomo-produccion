# Buscar TAG

## Propósito

Muestra los QR de la materia prima que está registrada y los QR de cada pesaje que ya tiene retiros. Permite filtrar por TAG o producto, leer un QR desde una imagen y, según el rango, imprimir en la Zebra o eliminar el TAG.

El menú lo llama **Buscar TAG**. La ficha de una sola paleta está en [ficha-de-tag.md](ficha-de-tag.md).

## Quién lo usa

Cualquier rango con sesión puede abrir `/qr` y descargar las imágenes. El menú lo muestra a todos.

- **Imprimir Zebra** aparece para `administrador` y `recepcionista`. La acción también lo exige.
- **Eliminar** el TAG desde la tarjeta aparece solo para `administrador`. El borrado está documentado en [eliminar-tag.md](eliminar-tag.md).
- El botón **Imprimir etiquetas** del encabezado imprime la página del navegador (`window.print`). No encola la Zebra.

## Pasos

1. El usuario abre `/qr`. La vista por defecto es **Materia prima en cava**.
2. Se listan hasta 300 lotes, del más reciente, con los mini lotes de cada TAG.
3. `QrEnVivo` filtra en el navegador por TAG, producto, código, destino o token, y muestra como máximo 48 tarjetas.
4. Cada tarjeta (`QrEtiqueta`) pinta el QR corto `PUROLOMO MPC` / `TAG:<número>`, los kilos y el enlace para descargar el PNG en `/qr/imagen/<tag>`.
5. **Pesajes** (`/qr?vista=pesajes`) lista `fichasQrPesajes`: pesajes que ya tienen retiros. Cada uno se dibuja con `QrPesaje` y su PNG está en `/qr/pesaje/<id>`.
6. **Lector de QR** sube una imagen. `decodificarImagen` la lee en el navegador y `loteActualDesdeQr` interpreta el texto.
   - Si el texto trae `TOKEN:ML...`, busca el mini lote y muestra el consumo.
   - Si trae `TAG:`, busca el lote.
   - Si no reconoce el formato, responde que no es una paleta de este almacén.
7. Tras eliminar un TAG desde aquí, la página vuelve con `?eliminado=` y muestra el aviso.

El QR impreso de la etiqueta de cava es el texto corto. El QR de pantalla de la ficha puede incluir kilos, estado y mini lotes (`textoQr`). El lector acepta los dos, porque `leerTextoQr` busca la línea `TAG:`.

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/qr` | QR de lotes |
| `/qr?vista=pesajes` | QR de pesajes con retiros |
| `/qr?eliminado=` | Aviso de un TAG borrado |
| `/qr/imagen/[tag]` | PNG del QR corto del TAG |
| `/qr/pesaje/[id]` | PNG del QR del pesaje |

Un TAG que no tiene de 4 a 8 dígitos responde 400. Si no existe el lote, 404. Un pesaje sin retiros también responde 404.

## Componentes

- `LectorQr`
- `QrEnVivo`
- `QrEtiqueta`
- `QrPesaje`
- `BotonImprimir`
- `BotonImprimirZebra`
- `BotonEliminarTag`
- `CampoFiltro`
- `PageFrame` y `Card`

## Server actions y API routes

- `loteActualDesdeQr` y `loteActualDesdeTag` en `src/app/actions.ts`. Exigen sesión.
- `imprimirEtiquetaZebra`, documentada en [impresion-zebra.md](impresion-zebra.md).
- `GET` `src/app/(panel)/qr/imagen/[tag]/route.ts`
- `GET` `src/app/(panel)/qr/pesaje/[id]/route.ts`

Las dos rutas de imagen pasan por el proxy, así que piden sesión.

## Tablas y consultas

Tablas `lotes`, `minilotes` y `pesajes`. RLS activado, sin políticas. La app usa la conexión directa.

- `listarLotes` con límite 300 (la consulta filtrable de `lotes`, aquí sin texto ni estado).
- Retiros de esos TAG:

```sql
SELECT m.tag, m.token, m.kg, m.tipo, m.linea, m.destino, p.numero AS numero
FROM minilotes m
JOIN pesajes p ON p.id = m.pesaje_id
WHERE m.tag = ANY(?::text[])
```

- `SELECT * FROM lotes WHERE tag = ?` al generar el PNG.
- `fichaQrPesaje` lee el pesaje, sus mini lotes y arma el texto del QR. Si no hay retiros, no hay imagen.

## Variables de entorno

- `DATABASE_URL` o `POSTGRES_URL`.
- `SESION_SECRETO`. Ver [autenticacion.md](autenticacion.md).
- `IMPRESION_CLAVE` solo cuando se encola la Zebra. Ver [impresion-zebra.md](impresion-zebra.md).

## Archivos relacionados

- [src/app/(panel)/qr/page.tsx](<../src/app/(panel)/qr/page.tsx>)
- [src/app/(panel)/qr/imagen/[tag]/route.ts](<../src/app/(panel)/qr/imagen/[tag]/route.ts>)
- [src/app/(panel)/qr/pesaje/[id]/route.ts](<../src/app/(panel)/qr/pesaje/[id]/route.ts>)
- [src/components/qr-en-vivo.tsx](../src/components/qr-en-vivo.tsx)
- [src/components/qr-etiqueta.tsx](../src/components/qr-etiqueta.tsx)
- [src/components/qr-pesaje.tsx](../src/components/qr-pesaje.tsx)
- [src/components/lector-qr.tsx](../src/components/lector-qr.tsx)
- [src/components/decodificar-imagen-qr.ts](../src/components/decodificar-imagen-qr.ts)
- [src/components/campo-filtro.tsx](../src/components/campo-filtro.tsx)
- [src/components/boton-imprimir.tsx](../src/components/boton-imprimir.tsx)
- [src/components/boton-imprimir-zebra.tsx](../src/components/boton-imprimir-zebra.tsx)
- [src/components/boton-eliminar-tag.tsx](../src/components/boton-eliminar-tag.tsx)
- [src/components/estado-badge.tsx](../src/components/estado-badge.tsx)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/components/ui/card.tsx](../src/components/ui/card.tsx)
- [src/components/ui/button.tsx](../src/components/ui/button.tsx)
- [src/app/actions.ts](../src/app/actions.ts)
- [src/lib/qr.ts](../src/lib/qr.ts)
- [src/lib/png-qr.ts](../src/lib/png-qr.ts)
- [src/lib/pesajes.ts](../src/lib/pesajes.ts)
- [src/lib/lotes.ts](../src/lib/lotes.ts)
- [src/lib/mpc.ts](../src/lib/mpc.ts)
- [src/lib/coincide.ts](../src/lib/coincide.ts)
- [src/lib/formato.ts](../src/lib/formato.ts)
- [src/lib/usuarios.ts](../src/lib/usuarios.ts)
- [src/lib/db.ts](../src/lib/db.ts)
- [src/app/(panel)/layout.tsx](<../src/app/(panel)/layout.tsx>)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [src/proxy.ts](../src/proxy.ts)
- [src/lib/acceso.ts](../src/lib/acceso.ts)
- [public/logo-purolomo.png](../public/logo-purolomo.png)
- [supabase/esquema.sql](../supabase/esquema.sql)
