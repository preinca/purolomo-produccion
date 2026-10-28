# Purolomo · Materia prima

Panel de recepción de materia prima cárnica para el almacén de producción de Cagua. Cada paleta (TAG) se guarda en **SQLite** y la aplicación genera su **código QR**.

## Qué registra cada QR

Fecha, semana, TAG, tipo de producto, código, kg recibidos, kg despachados, kg consumidos y estado.

La nomenclatura (Z, C, DD, CH, GL, GP, BF, RR, R#2, etc.) es la del control de recepción MPC. El catálogo de códigos sale del CDM de octubre 2026.

## Cómo correrlo en tu laptop

SQLite **no es un programa que haya que instalar aparte** para que el panel funcione. No hay usuario, contraseña ni puerto de base de datos. Node 22 ya trae SQLite; la aplicación guarda todo en un archivo de tu disco:

`data/produccion.sqlite`

Ese archivo es la base. Lo que registres en el panel (entradas, salidas, consumo, estados, QR) queda ahí y se lee de ahí.

### 1. Instalar Node.js 20 o 22

Descarga **Node.js 22 LTS** (o 20 LTS) desde [https://nodejs.org](https://nodejs.org) e instálalo. Cierra y abre la terminal (o PowerShell) y comprueba:

```bash
node -v
```

Tiene que salir `v20.…` o `v22.…`. La base usa el paquete **better-sqlite3** (funciona en Windows y con `npm run build`); no hace falta instalar SQLite por separado.

En Windows, si `npm install` falla compilando better-sqlite3, instala [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) con la carga **“Desarrollo de escritorio con C++”** y vuelve a ejecutar `npm install`.

### 2. Copiar el proyecto y arrancarlo

En una carpeta de tu laptop (por ejemplo Documentos):

```bash
git clone https://github.com/preinca/purolomo-produccion.git
cd purolomo-produccion
npm install
npm run dev
```

Abre [http://127.0.0.1:47231](http://127.0.0.1:47231). La primera visita crea `data/produccion.sqlite` con el catálogo MPC (códigos Z, C, DD, etc.). Los lotes los cargas tú en **Registrar entradas**. El archivo `.sqlite` no se sube a git: se queda en tu computadora.

Para ver la ruta exacta:

```bash
npm run db:info
```

### 3. (Opcional) Programa para mirar el archivo

Esto **no** lo usa la aplicación. Solo sirve si quieres abrir las tablas a mano:

- **Windows:** [DB Browser for SQLite](https://sqlitebrowser.org/) — Archivo → Abrir → `data/produccion.sqlite`
- **Windows (línea de comandos):** `winget install SQLite.SQLite`
- **macOS:** `brew install sqlite`
- **Linux (Debian/Ubuntu):** `sudo apt install sqlite3`

```bash
sqlite3 data/produccion.sqlite
.tables
SELECT tag, producto, kg_recibidos, estado FROM lotes;
```

Cierra DB Browser o `sqlite3` antes de volver a usar el panel: SQLite es un archivo y no conviene que dos programas lo escriban a la vez.

### Vaciar y volver a empezar

```bash
npm run reset-db
```

Reinicia `npm run dev`. El catálogo de productos se crea solo.

Para cargar otra vez la demo masiva del CDM de octubre 2026:

```bash
npm run reset-db
```

En Windows PowerShell:

```powershell
$env:SEED_LOTES_CDM="1"; npm run dev
```

En macOS / Linux:

```bash
SEED_LOTES_CDM=1 npm run dev
```

```bash
npm test
npm run lint
```

## SQLite

SQLite va embebido con **better-sqlite3**. No hay servidor de base de datos ni usuario/contraseña.

- `src/lib/db.ts` abre el archivo, crea las tablas y siembra el catálogo.
- `src/lib/lotes.ts` valida e inserta recepciones, despachos y consumos.
- `src/app/actions.ts` conecta el formulario con esas funciones.

Para guardar el archivo en otra carpeta (por ejemplo un disco compartido de planta), copia `.env.example` a `.env.local` y define `SQLITE_PATH`, o:

**Windows PowerShell**

```powershell
$env:SQLITE_PATH="C:\Users\TuUsuario\Documents\purolomo\produccion.sqlite"
npm run dev
```

**macOS / Linux**

```bash
SQLITE_PATH=/home/tu-usuario/Documentos/purolomo/produccion.sqlite npm run dev
```

En Vercel el disco del proyecto es de solo lectura; ahí la base cae en `/tmp` y no persiste entre reinicios. **Para producción en planta usa este panel en la laptop (o un PC de almacén) con `npm run dev` o `npm run build` + `npm start`.** El archivo `data/produccion.sqlite` es el almacén real.

## Tablas

`lotes` — una fila por TAG (paleta).

`movimientos` — recepción, transferencia, despacho, consumo o devolución.

`productos` — códigos MPC (`MPCM01041` = CDM SP Z, pollo tipo pequeño, etc.).
