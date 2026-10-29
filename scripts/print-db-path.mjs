import fs from "node:fs";
import path from "node:path";

function rutaBaseDatos() {
  if (process.env.SQLITE_PATH) return process.env.SQLITE_PATH;
  const local = path.join(process.cwd(), "data", "produccion.sqlite");
  try {
    fs.mkdirSync(path.dirname(local), { recursive: true });
    fs.accessSync(path.dirname(local), fs.constants.W_OK);
    return local;
  } catch {
    return path.join("/tmp", "produccion.sqlite");
  }
}

const archivo = rutaBaseDatos();
const existe = fs.existsSync(archivo);
console.log(`Ruta de SQLite: ${archivo}`);
console.log(existe ? "El archivo ya existe. Ahí se guardan lotes y movimientos." : "Todavía no existe. Se crea al abrir el panel (npm run dev).");
