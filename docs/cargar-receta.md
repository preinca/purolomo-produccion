# Cargar receta

## Propósito

Al empezar la jornada se carga la receta de Alibal de 1 kg para la línea 1 o la línea 2. Después, en **Registrar salidas**, solo se puede retirar lo que esa receta permite: kilos por tipo de MPC, tolerancia y rango mínimo y máximo.

El menú lo llama **Cargar receta**.

## Quién lo usa

Solo `administrador`. El menú no muestra el ítem a los demás rangos, `/receta` no está en las rutas de consulta y `cargarRecetaAlibal` y `eliminarRecetaFormulario` llaman a `exigirAdmin`.

La descarga del Excel también pasa por el proxy, así que un rango que no es administrador vuelve a `/` antes de llegar a la ruta.

## Pasos

1. El administrador abre `/receta`.
2. **Nueva receta** pide la línea (1 o 2) y un Excel `.xlsx`.
3. `cargarRecetaAlibal` lee la primera hoja. Tiene que haber columnas de tipo (`Tipo` o `MPC`) y de kilos (`Kg`, `Kilos` o `Kilo`). Puede traer tolerancia, mínimo, máximo o rango.
4. `guardarReceta` inserta una fila en `recetas` con destino `ALIBAL 1 K` y una fila por tipo en `receta_items`. El objetivo es la suma de los kilos. La línea 2 usa el factor de esa línea al interpretar el archivo.
5. La página redirige a `/receta` y lista las recetas vigentes.
6. **Descargar Excel** abre `/receta/excel/1` o `/receta/excel/2`. Si no hay receta vigente, el archivo sale de la plantilla vacía de esa línea.
7. **Eliminar receta** exige la casilla «Confirmo eliminar». No deja borrar la línea si hay un pesaje de Alibal sin finalizar en esa misma línea.
8. Al eliminar, las recetas de esa línea y destino que ningún pesaje referencia se borran con sus ítems. Las que ya usó un pesaje se conservan con `vigente = 0`, para no perder el histórico.

La página avisa con `?alerta=` cuando falta la confirmación o la eliminación no procede.

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/receta` | Cargar, ver y eliminar |
| `/receta?alerta=` | Error de eliminación |
| `/receta/excel/[linea]` | Excel de la línea 1 o 2 |
| Enlace a `/salidas` | Sigue el flujo de consumo |

## Componentes

- `CargarRecetaForm`
- `PageFrame`
- `Card`
- `buttonVariants` de `src/components/ui/button.tsx`

## Server actions y API routes

- `cargarRecetaAlibal`
- `eliminarRecetaFormulario`

`GET` en `src/app/(panel)/receta/excel/[linea]/route.ts`. Una línea distinta de `1` o `2` responde 400.

## Tablas y consultas

Tablas `recetas`, `receta_items` y, para impedir el borrado, `pesajes`. RLS activado, sin políticas. La app usa la conexión directa.

Alta:

```sql
INSERT INTO recetas (destino, linea, objetivo_kg, tolerancia_kg, minimo_kg, maximo_kg)
VALUES (?, ?, ?, ?, ?, ?)
RETURNING id
```

```sql
INSERT INTO receta_items (receta_id, tipo, kg, tolerancia_kg, minimo_kg, maximo_kg)
VALUES (?, ?, ?, ?, ?, ?)
```

Lectura de las vigentes: la receta de mayor `id` por destino y línea con `vigente = 1`, y sus ítems en `receta_items`.

Pesaje que bloquea el borrado:

```sql
SELECT numero, linea FROM pesajes
WHERE destino = ? AND finalizado = 0
ORDER BY id DESC
LIMIT 1
```

Borrado: si el `receta_id` no está en `pesajes`, `DELETE` de `receta_items` y de `recetas`. Si está, `UPDATE recetas SET vigente = 0`.

`pesajeEnCurso` en la página usa `SELECT * FROM pesajes WHERE destino = ? AND finalizado = 0`.

## Variables de entorno

- `DATABASE_URL` o `POSTGRES_URL`.
- `SESION_SECRETO`. Ver [autenticacion.md](autenticacion.md).

## Archivos relacionados

- [src/app/(panel)/receta/page.tsx](<../src/app/(panel)/receta/page.tsx>)
- [src/app/(panel)/receta/excel/[linea]/route.ts](<../src/app/(panel)/receta/excel/[linea]/route.ts>)
- [src/components/cargar-receta-form.tsx](../src/components/cargar-receta-form.tsx)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/components/ui/card.tsx](../src/components/ui/card.tsx)
- [src/components/ui/button.tsx](../src/components/ui/button.tsx)
- [src/app/actions.ts](../src/app/actions.ts)
- [src/lib/recetas.ts](../src/lib/recetas.ts)
- [src/lib/excel-receta.ts](../src/lib/excel-receta.ts)
- [src/lib/pesajes.ts](../src/lib/pesajes.ts)
- [src/lib/pesajes.test.ts](../src/lib/pesajes.test.ts)
- [src/lib/formato.ts](../src/lib/formato.ts)
- [src/lib/usuarios.ts](../src/lib/usuarios.ts)
- [src/lib/acceso.ts](../src/lib/acceso.ts)
- [src/proxy.ts](../src/proxy.ts)
- [src/lib/db.ts](../src/lib/db.ts)
- [src/app/(panel)/layout.tsx](<../src/app/(panel)/layout.tsx>)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [supabase/esquema.sql](../supabase/esquema.sql)
