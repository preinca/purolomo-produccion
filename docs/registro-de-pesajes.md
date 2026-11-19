# Registro de pesajes

## Propósito

Muestra la planilla de pesajes finalizados de un producto: número, código, fecha, hora, línea, uso, observación, kilos por tipo de MPC (con TAG y mini lote) y total. Permite filtrar por día y descargar un PDF con espacio para la firma del pesador y del supervisor.

El menú lo llama **Registro de pesajes**. Abrir el pesaje y cargar los kilos es [registrar-salidas.md](registrar-salidas.md).

## Quién lo usa

Cualquier rango con sesión. El menú lo muestra a todos y `/pesajes` está en las rutas de consulta. El PDF también exige sesión.

## Pasos

1. El usuario abre `/pesajes`. Si no indica producto, la página usa `ALIBAL 1 K`.
2. Las pestañas son los destinos de `DESTINOS`: PDM 1K, PDM 1/2 K, ALIBAL 1 K, HM ESP 1 KG, HM SUP 1KG, CON TODO 900 GR, BOLOGNA y PDM 3 KG. Hoy el alta de pesajes solo crea ALIBAL 1 K; el resto sale vacío salvo que existan filas viejas.
3. Opcionalmente elige un día y pulsa **Ver ese día**. **Todos los días** quita la fecha.
4. `planillaDeProducto` arma las filas de pesajes con `finalizado = 1`. El filtro de día se aplica en memoria sobre `fila.fecha`.
5. Cada celda de tipo lista los aportes (kilos, TAG y token de mini lote) y, si hay más de uno, la suma.
6. **Descargar PDF** abre `/pesajes/pdf?producto=&fecha=`. Sin fecha, el PDF trae todos los días de ese producto. Un producto que no esté en `DESTINOS` responde 400.

El código visible (por ejemplo `12L1-Z00AB`) lo arma `codigoDePesaje` con el número, la línea y el sufijo de cada mini lote. No es una columna de `pesajes`.

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/pesajes` | Planilla. Producto por defecto: ALIBAL 1 K |
| `/pesajes?producto=&fecha=` | Mismo producto y, si la fecha es válida, un solo día |
| `/pesajes/pdf?producto=&fecha=` | PDF de la planilla |

## Componentes

La planilla está escrita en la página. Usa `PageFrame` y `Card`.

## API routes

`GET` en `src/app/(panel)/pesajes/pdf/route.ts`. No hay server action.

## Tablas y consultas

Tablas `pesajes`, `minilotes`, `recetas` y `receta_items`. RLS activado, sin políticas. La app usa la conexión directa.

`planillaDeProducto` parte de:

```sql
SELECT * FROM pesajes
WHERE destino = ? AND finalizado = 1
ORDER BY fecha, numero
```

```sql
SELECT ri.tipo FROM receta_items ri
WHERE ri.receta_id IN (
  SELECT r.id FROM recetas r
  WHERE r.destino = ?
    AND r.id = (
      SELECT MAX(r2.id) FROM recetas r2
      WHERE r2.destino = r.destino AND r2.linea = r.linea
    )
)
ORDER BY ri.id
```

La columna de un tipo se omite cuando el tipo, en mayúsculas, es `C`. Los aportes de cada celda salen de `minilotes` de esos pesajes (`tag`, `token`, `kg`, `tipo`), ordenados por `creado_en` y `token`. El código del pesaje usa el orden de `receta_items` de la receta guardada en el pesaje, no el de la receta vigente de hoy.

## Variables de entorno

- `DATABASE_URL` o `POSTGRES_URL`.
- `SESION_SECRETO`. Ver [autenticacion.md](autenticacion.md).

## Archivos relacionados

- [src/app/(panel)/pesajes/page.tsx](<../src/app/(panel)/pesajes/page.tsx>)
- [src/app/(panel)/pesajes/pdf/route.ts](<../src/app/(panel)/pesajes/pdf/route.ts>)
- [src/lib/pesajes.ts](../src/lib/pesajes.ts)
- [src/lib/pesajes.test.ts](../src/lib/pesajes.test.ts)
- [src/lib/pdf-pesajes.ts](../src/lib/pdf-pesajes.ts)
- [src/lib/pdf-pesajes.test.ts](../src/lib/pdf-pesajes.test.ts)
- [src/lib/destinos.ts](../src/lib/destinos.ts)
- [src/lib/minilote.ts](../src/lib/minilote.ts)
- [src/lib/formato.ts](../src/lib/formato.ts)
- [src/lib/arreglo-pg.ts](../src/lib/arreglo-pg.ts)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/components/ui/card.tsx](../src/components/ui/card.tsx)
- [src/lib/db.ts](../src/lib/db.ts)
- [src/app/(panel)/layout.tsx](<../src/app/(panel)/layout.tsx>)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [src/proxy.ts](../src/proxy.ts)
- [src/lib/acceso.ts](../src/lib/acceso.ts)
- [supabase/esquema.sql](../supabase/esquema.sql)
