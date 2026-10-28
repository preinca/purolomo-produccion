import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalForDb = globalThis as unknown as { sqlite?: DatabaseSync };

export function rutaBaseDatos() {
  if (process.env.SQLITE_PATH) return process.env.SQLITE_PATH;
  const local = path.join(process.cwd(), "data", "produccion.sqlite");
  try {
    fs.mkdirSync(path.dirname(local), { recursive: true });
    fs.accessSync(path.dirname(local), fs.constants.W_OK);
    return local;
  } catch {
    // En Vercel el disco del proyecto es de solo lectura. /tmp sí se puede escribir.
    return path.join("/tmp", "produccion.sqlite");
  }
}

export function abrirBase(archivo: string) {
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  const db = new DatabaseSync(archivo);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS registros_produccion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      turno TEXT NOT NULL CHECK (turno IN ('manana', 'tarde', 'noche')),
      linea TEXT NOT NULL,
      producto TEXT NOT NULL,
      cantidad_kg REAL NOT NULL CHECK (cantidad_kg > 0),
      observaciones TEXT NOT NULL DEFAULT '',
      creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_registros_fecha
      ON registros_produccion (fecha DESC, id DESC);
  `);
  return db;
}

export function getDb() {
  if (!globalForDb.sqlite) {
    globalForDb.sqlite = abrirBase(rutaBaseDatos());
  }
  return globalForDb.sqlite;
}
