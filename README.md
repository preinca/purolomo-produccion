# Purolomo · Materia prima

Panel de recepción de materia prima cárnica para el almacén de producción de Cagua. Cada paleta (TAG) se guarda en **Supabase (Postgres)** y la aplicación genera su **código QR**. La aplicación se publica en **Vercel**.

## Qué registra cada QR

Fecha, semana, TAG, tipo de producto, código, kg recibidos, kg despachados, kg consumidos y estado.

La nomenclatura (Z, C, DD, CH, GL, GP, BF, RR, R#2, etc.) es la del control de recepción MPC. El catálogo de códigos sale del CDM de octubre 2026.

## Variables de entorno

Copia `.env.example` a `.env.local` y rellena:

- `DATABASE_URL`: cadena de conexión de Supabase. En Supabase, botón **Connect** (arriba) → **Transaction pooler** (puerto 6543). Cambia `[YOUR-PASSWORD]` por la contraseña de la base de datos.
- `SESION_SECRETO`: texto largo y aleatorio para firmar las sesiones. Genéralo con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

En Vercel pon las mismas dos variables en **Settings → Environment Variables**.

## Preparar la base de datos de Supabase

```bash
npm run db:migrar
```

Crea las tablas (`supabase/esquema.sql`) y copia desde la base SQLite antigua (`data/produccion.sqlite`, si existe) solo los usuarios, el catálogo y las recetas. Lotes, movimientos, pesajes y mini lotes empiezan vacíos. Si Supabase ya tiene datos de operación, no copia nada.

Si no hay base SQLite antigua, la primera visita a `/entrar` pide crear el administrador.

## Correrlo en tu laptop

Hace falta Node.js 22 LTS ([https://nodejs.org](https://nodejs.org)).

```bash
git clone https://github.com/preinca/purolomo-produccion.git
cd purolomo-produccion
npm install
npm run dev
```

Abre [http://127.0.0.1:47231](http://127.0.0.1:47231). En local también se usa la base de Supabase de `DATABASE_URL`: lo que registres en local aparece en Vercel.

```bash
npm test
npm run lint
```

Las pruebas usan un Postgres en memoria (PGlite) con el mismo esquema; no tocan Supabase.

## Base de datos

- `supabase/esquema.sql` — tablas e índices. Las tablas tienen RLS activado sin políticas: la API pública de Supabase no puede leerlas; la aplicación entra con la conexión directa.
- `src/lib/db.ts` — conexión a Postgres. Las consultas se escriben con `?` y se convierten a `$1, $2…`.
- `src/lib/lotes.ts` — recepciones, salidas y consumos. Las salidas bloquean el TAG mientras descuentan kilos, para que dos personas no se pisen.
- `src/lib/pesajes.ts` — pesajes, mini lotes y códigos de pesaje.
- `src/app/actions.ts` — conecta los formularios con esas funciones.

Para mirar o exportar los datos a mano: Supabase → **Table Editor**.

## Tablas

`lotes` — una fila por TAG (paleta).

`movimientos` — recepción, transferencia, despacho, consumo o devolución.

`productos` — códigos MPC (`MPCM01041` = CDM SP Z, pollo tipo pequeño, etc.).

`recetas` y `receta_items` — fórmula de Alibal por línea.

`pesajes` y `minilotes` — cada pesaje y los retiros de materia prima que lo forman.

`usuarios` — acceso y rango (administrador, recepcionista, pesador, consulta).
