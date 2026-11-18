<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Purolomo Producción

Panel de recepción de materia prima cárnica del almacén de producción de Cagua (planta de embutidos, almacén 40602-1). Cada paleta es un TAG: se guarda en Postgres, lleva kilos y un QR. La app publicada está en https://purolomo-produccion.vercel.app.

Antes de cambiar un flujo, lee el archivo de `docs/` que le corresponde. Ahí están el propósito, quién entra, los pasos, las rutas, las consultas y los archivos del código.

## Stack

- Next.js 16 (`next` 16.4.3) con App Router, React 19 y TypeScript.
- Tailwind CSS 4 y componentes en `src/components/ui`.
- Postgres en Supabase, con el driver `postgres`. Las consultas se escriben con `?` y `src/lib/db.ts` las convierte a `$1`, `$2`…
- La sesión es una cookie firmada (`SESION_SECRETO`). No usa Supabase Auth.
- El esquema está en `supabase/esquema.sql`. Las tablas tienen RLS activado y ninguna política: la API pública de Supabase no las lee. La aplicación entra con la conexión directa y no pasa por RLS.
- El catálogo MPC que ven las pantallas es la constante `PRODUCTOS_MPC` en `src/lib/mpc.ts`. La tabla `productos` se llena al migrar y las pantallas no la consultan.
- Despliegue en Vercel. La impresora Zebra no corre en Vercel: `scripts/agente-zebra.mjs` pide los trabajos a `/api/impresion`.

## Cómo correrlo

Hace falta Node.js 20 o superior. La migración desde SQLite usa el módulo `node:sqlite` de Node 22.

```bash
npm install
npm run dev
```

`npm run dev` escucha en el puerto 47231 (`http://127.0.0.1:47231`). Copia `.env.example` a `.env.local` y define `DATABASE_URL` y `SESION_SECRETO`. No hace falta una base local: el desarrollo usa el mismo Postgres. Si `usuarios` está vacía, `/entrar` pide crear el administrador.

```bash
npm test
npm run lint
npm run db:migrar
```

`npm test` corre `src/lib/*.test.ts` contra PGlite, con el mismo esquema, y no toca Supabase. `npm run db:migrar` aplica `supabase/esquema.sql`. Si existe `data/produccion.sqlite` (o la ruta de `SQLITE_PATH`) y Supabase no tiene lotes, movimientos, pesajes ni mini lotes, copia usuarios, catálogo y recetas.

## Cómo se despliega

El proyecto se publica en Vercel, en https://purolomo-produccion.vercel.app. En **Settings → Environment Variables** hacen falta los mismos nombres que en local:

- `DATABASE_URL`: cadena del pooler de Supabase (transaction pooler, puerto 6543). Si no está, el código también acepta `POSTGRES_URL`.
- `SESION_SECRETO`: secreto de la cookie. Hay que definirlo en producción.
- `IMPRESION_CLAVE`: solo si la impresora Zebra va a pedir trabajos. El agente, en la máquina de la oficina, usa además `PUROLOMO_URL`, `ZEBRA_HOST`, `ZEBRA_PUERTO` y `ZEBRA_IMPRESORA`. Esos nombres no van en el build de Vercel.

`DB_MAX_CONEXIONES` limita el pool fuera de Vercel. Cuando existe la variable `VERCEL`, el código abre una sola conexión. No pongas valores de estas variables en la documentación ni en commits.

`src/proxy.ts` corre antes de las páginas: exige la cookie `sesion` y el rango, y deja pasar `/entrar` y `/api/impresion` sin sesión. La API de impresión compara la cabecera `x-impresion-clave`.

## Flujos

Lee el doc del flujo antes de tocar su código.

- [docs/autenticacion.md](docs/autenticacion.md) — iniciar sesión, crear el primer administrador, cookie y **Salir**.
- [docs/usuarios.md](docs/usuarios.md) — alta y activación de cuentas por rango.
- [docs/panel-de-administracion.md](docs/panel-de-administracion.md) — portada `/` (el menú dice Dashboard): totales y últimas paletas.
- [docs/catalogo-cdm.md](docs/catalogo-cdm.md) — leyenda MPC. `/nomenclatura` redirige a `/inventario`.
- [docs/registrar-entradas.md](docs/registrar-entradas.md) — proceso de recepción y alta de cada TAG.
- [docs/registro-de-entrada.md](docs/registro-de-entrada.md) — consulta de recepciones y PDF del día.
- [docs/etiquetas-en-cava.md](docs/etiquetas-en-cava.md) — historial de etiquetas y descarga NLBL o PDF.
- [docs/impresion-zebra.md](docs/impresion-zebra.md) — cola de impresión, `/api/impresion` y el agente de la Zebra.
- [docs/cargar-receta.md](docs/cargar-receta.md) — Excel de la receta de Alibal 1 kg por línea.
- [docs/registrar-salidas.md](docs/registrar-salidas.md) — pesaje de consumo y traslado a logística.
- [docs/registro-de-pesajes.md](docs/registro-de-pesajes.md) — planilla de pesajes finalizados y su PDF.
- [docs/registro-de-logistica.md](docs/registro-de-logistica.md) — consulta de traslados a logística.
- [docs/buscar-tag.md](docs/buscar-tag.md) — QR de paletas y de pesajes, lector de imagen e impresión de un TAG.
- [docs/ficha-de-tag.md](docs/ficha-de-tag.md) — detalle `/lote/[tag]`, observación y movimientos.
- [docs/buscar-mini-lote.md](docs/buscar-mini-lote.md) — búsqueda de un retiro `ML…`.
- [docs/buscar-pesaje.md](docs/buscar-pesaje.md) — búsqueda en `/consulta-pesaje`.
- [docs/busqueda-global.md](docs/busqueda-global.md) — campo del encabezado **Buscar TAG o pesaje**.
- [docs/stock-disponible.md](docs/stock-disponible.md) — `/stock`, fuera del menú.
- [docs/historial-de-entradas.md](docs/historial-de-entradas.md) — `/historial/entradas`, fuera del menú.
- [docs/historial-de-salidas.md](docs/historial-de-salidas.md) — `/historial/salidas`, fuera del menú.
- [docs/eliminar-tag.md](docs/eliminar-tag.md) — borrado de un TAG por el administrador.

`/hello` es una página de demostración de Next.js. No lee la base ni forma parte de los flujos del almacén. `src/app/error.tsx` solo muestra el fallo cuando la base no responde.

Rangos (`src/lib/acceso.ts` y el menú de `src/components/shell.tsx`): administrador entra a todo; recepcionista suma `/entradas`; pesador suma `/salidas`; consulta, recepcionista y pesador comparten el resto de las rutas de lectura. La salida a logística, dentro de `/salidas`, la ve y la ejecuta solo el administrador.
