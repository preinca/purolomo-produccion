import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const nombres = [
  "produccion.sqlite",
  "produccion.sqlite-wal",
  "produccion.sqlite-shm",
];

const carpetas = [path.join(process.cwd(), "data"), os.tmpdir()];
if (process.env.SQLITE_PATH) {
  carpetas.push(path.dirname(process.env.SQLITE_PATH));
  nombres.push(path.basename(process.env.SQLITE_PATH));
}

let borrados = 0;
for (const carpeta of carpetas) {
  for (const nombre of nombres) {
    const archivo = path.join(carpeta, nombre);
    if (!fs.existsSync(archivo)) continue;
    fs.rmSync(archivo, { force: true });
    console.log(`Borrado ${archivo}`);
    borrados += 1;
  }
}

if (borrados === 0) {
  console.log("No había archivos SQLite que borrar. La próxima vez que abras el panel se crea data/produccion.sqlite.");
} else {
  console.log("Base vaciada. Reinicia npm run dev; el catálogo MPC se crea solo y los lotes los cargas tú.");
}
