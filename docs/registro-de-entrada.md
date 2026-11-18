# Registro de entrada

## Propósito

Consulta las recepciones ya guardadas, en el orden en que se registraron. Se puede filtrar por producto del catálogo CDM y por día, ver los kilos totales y descargar el PDF de un día.

El menú lo llama **Registro de entrada**. Cargar paletas nuevas es [registrar-entradas.md](registrar-entradas.md).

## Quién lo usa

Cualquier rango con sesión. El menú lo muestra a todos y `/registro-entrada` está en las rutas de consulta.

## Pasos

1. El usuario abre `/registro-entrada`.
2. Elige un producto (o **Todos los productos**) y, si quiere, un día, y pulsa **Ver registro**.
3. El formulario hace GET a `/registro-entrada?producto=<codigo>&fecha=<día>`. El código tiene que existir en `PRODUCTOS_MPC`. Una fecha que no sea válida se ignora.
4. La tabla muestra fecha, hora de `creado_en` en `America/Caracas`, TAG (enlace a `/lote/[tag]`), producto, código, kilos, destino y observación.
5. Arriba de la tabla está la suma de `kg_recibidos` del filtro.
6. **Ver todas** quita el filtro. **Descargar PDF del día** solo aparece cuando hay un día válido y abre `/registro-entrada/pdf` con la misma consulta.
7. El PDF repite producto, día, filas y kilos. Si el día no es válido, la ruta responde 400.

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/registro-entrada` | Filtro y tabla |
| `/registro-entrada/pdf?producto=&fecha=` | PDF del día. `producto` puede ir vacío para todos |

## Componentes

La tabla y el filtro están en la página. Usa `PageFrame` y `Card`. El enlace de cada TAG lleva a la ficha documentada en [ficha-de-tag.md](ficha-de-tag.md).

## API routes

`GET` en `src/app/(panel)/registro-entrada/pdf/route.ts`. No hay server action: filtrar es un formulario GET.

La ruta exige sesión porque el proxy cubre `/registro-entrada/pdf`.

## Tablas y consultas

Tabla `lotes`. RLS activado, sin políticas. La app usa la conexión directa.

`listarEntradas`:

```sql
SELECT * FROM lotes
WHERE (? = '' OR codigo = ?)
  AND (? = '' OR fecha = ?)
ORDER BY fecha, creado_en, tag
```

El nombre visible sale de `productoPorCodigo` cuando el código está en el catálogo del código. La hora sale de `creado_en` con `formatoHora`.

## Variables de entorno

- `DATABASE_URL` o `POSTGRES_URL`.
- `SESION_SECRETO`. Ver [autenticacion.md](autenticacion.md).

## Archivos relacionados

- [src/app/(panel)/registro-entrada/page.tsx](<../src/app/(panel)/registro-entrada/page.tsx>)
- [src/app/(panel)/registro-entrada/pdf/route.ts](<../src/app/(panel)/registro-entrada/pdf/route.ts>)
- [src/lib/pdf-entradas.ts](../src/lib/pdf-entradas.ts)
- [src/lib/pdf-entradas.test.ts](../src/lib/pdf-entradas.test.ts)
- [src/lib/lotes.ts](../src/lib/lotes.ts)
- [src/lib/mpc.ts](../src/lib/mpc.ts)
- [src/lib/formato.ts](../src/lib/formato.ts)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/components/ui/card.tsx](../src/components/ui/card.tsx)
- [src/lib/db.ts](../src/lib/db.ts)
- [src/app/(panel)/layout.tsx](<../src/app/(panel)/layout.tsx>)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [src/proxy.ts](../src/proxy.ts)
- [src/lib/acceso.ts](../src/lib/acceso.ts)
- [supabase/esquema.sql](../supabase/esquema.sql)
