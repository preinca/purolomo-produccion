import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { sembrarSiVacia } from "./seed";

export type SqliteDb = Database.Database;

const globalForDb = globalThis as unknown as { sqlite?: SqliteDb };

export function rutaBaseDatos() {
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

export function abrirBase(archivo: string) {
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  const db = new Database(archivo);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS productos (
      codigo TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL,
      descripcion TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lotes (
      tag TEXT PRIMARY KEY,
      fecha TEXT NOT NULL,
      semana TEXT NOT NULL,
      codigo TEXT NOT NULL,
      producto TEXT NOT NULL,
      kg_recibidos REAL NOT NULL DEFAULT 0 CHECK (kg_recibidos >= 0),
      kg_despachados REAL NOT NULL DEFAULT 0 CHECK (kg_despachados >= 0),
      kg_consumidos REAL NOT NULL DEFAULT 0 CHECK (kg_consumidos >= 0),
      estado TEXT NOT NULL,
      observaciones TEXT NOT NULL DEFAULT '',
      creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('recepcion', 'despacho', 'consumo', 'devolucion', 'transferencia')),
      fecha TEXT NOT NULL,
      semana TEXT NOT NULL,
      kg REAL NOT NULL CHECK (kg >= 0),
      estado TEXT NOT NULL,
      nota TEXT NOT NULL DEFAULT '',
      creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_lotes_fecha ON lotes (fecha DESC, tag DESC);
    CREATE INDEX IF NOT EXISTS idx_lotes_estado ON lotes (estado, fecha DESC);
    CREATE INDEX IF NOT EXISTS idx_lotes_codigo ON lotes (codigo);
    CREATE INDEX IF NOT EXISTS idx_mov_tag ON movimientos (tag, id DESC);
    CREATE INDEX IF NOT EXISTS idx_mov_tipo ON movimientos (tipo, fecha DESC);
  `);
  sembrarSiVacia(db);
  return db;
}

export function getDb() {
  if (!globalForDb.sqlite) {
    globalForDb.sqlite = abrirBase(rutaBaseDatos());
  }
  return globalForDb.sqlite;
}
