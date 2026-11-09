import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { asegurarCatalogo, sembrarSiVacia } from "./seed";

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
      destino TEXT NOT NULL DEFAULT '',
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
      destino TEXT NOT NULL DEFAULT '',
      linea TEXT NOT NULL DEFAULT '',
      creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_lotes_fecha ON lotes (fecha DESC, tag DESC);
    CREATE INDEX IF NOT EXISTS idx_lotes_estado ON lotes (estado, fecha DESC);
    CREATE INDEX IF NOT EXISTS idx_lotes_codigo ON lotes (codigo);
    CREATE INDEX IF NOT EXISTS idx_mov_tag ON movimientos (tag, id DESC);
    CREATE INDEX IF NOT EXISTS idx_mov_tipo ON movimientos (tipo, fecha DESC);
  `);
  asegurarEsquema(db);
  sembrarSiVacia(db);
  return db;
}

function asegurarEsquema(db: SqliteDb) {
  asegurarColumna(db, "lotes", "destino", "TEXT NOT NULL DEFAULT ''");
  asegurarColumna(db, "movimientos", "destino", "TEXT NOT NULL DEFAULT ''");
  asegurarColumna(db, "movimientos", "linea", "TEXT NOT NULL DEFAULT ''");
  db.exec(`
    CREATE TABLE IF NOT EXISTS recetas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      destino TEXT NOT NULL,
      linea TEXT NOT NULL DEFAULT '1',
      objetivo_kg REAL NOT NULL,
      tolerancia_kg REAL NOT NULL,
      creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS receta_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receta_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      kg REAL NOT NULL CHECK (kg > 0),
      UNIQUE (receta_id, tipo)
    );

    CREATE TABLE IF NOT EXISTS pesajes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      destino TEXT NOT NULL,
      linea TEXT NOT NULL,
      receta_id INTEGER NOT NULL,
      creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE (fecha, destino, linea, numero)
    );

    CREATE TABLE IF NOT EXISTS minilotes (
      token TEXT PRIMARY KEY,
      tag TEXT NOT NULL,
      pesaje_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      kg REAL NOT NULL CHECK (kg > 0),
      destino TEXT NOT NULL,
      linea TEXT NOT NULL,
      creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_mini_pesaje ON minilotes (pesaje_id, tipo, creado_en);

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      usuario TEXT NOT NULL UNIQUE COLLATE NOCASE,
      clave TEXT NOT NULL,
      rango TEXT NOT NULL CHECK (rango IN ('administrador', 'consulta', 'recepcionista', 'pesador')),
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  asegurarColumna(db, "recetas", "linea", "TEXT NOT NULL DEFAULT '1'");
  asegurarColumna(db, "receta_items", "tolerancia_kg", "REAL NOT NULL DEFAULT 15");
  asegurarColumna(db, "recetas", "minimo_kg", "REAL");
  asegurarColumna(db, "recetas", "maximo_kg", "REAL");
  asegurarColumna(db, "receta_items", "minimo_kg", "REAL");
  asegurarColumna(db, "receta_items", "maximo_kg", "REAL");
  asegurarColumna(db, "pesajes", "observaciones", "TEXT NOT NULL DEFAULT ''");
  asegurarColumna(db, "pesajes", "finalizado", "INTEGER NOT NULL DEFAULT 0");
  asegurarColumna(db, "pesajes", "registrado_en", "TEXT NOT NULL DEFAULT ''");
  ampliarRangos(db);
  db.prepare("UPDATE lotes SET estado = 'RECIBIDO' WHERE estado = 'PENDIENTE POR TRANSFERIR'").run();
  db.prepare("UPDATE movimientos SET estado = 'RECIBIDO' WHERE estado = 'PENDIENTE POR TRANSFERIR'").run();
}

function ampliarRangos(db: SqliteDb) {
  const def = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'usuarios'").get() as
    | { sql: string }
    | undefined;
  if (!def || def.sql.includes("recepcionista")) return;
  db.pragma("foreign_keys = OFF");
  const migrar = db.transaction(() => {
    db.exec(`
      CREATE TABLE usuarios_nueva (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        usuario TEXT NOT NULL UNIQUE COLLATE NOCASE,
        clave TEXT NOT NULL,
        rango TEXT NOT NULL CHECK (rango IN ('administrador', 'consulta', 'recepcionista', 'pesador')),
        activo INTEGER NOT NULL DEFAULT 1,
        creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      INSERT INTO usuarios_nueva (id, nombre, usuario, clave, rango, activo, creado_en)
      SELECT id, nombre, usuario, clave, rango, activo, creado_en FROM usuarios;
      DROP TABLE usuarios;
      ALTER TABLE usuarios_nueva RENAME TO usuarios;
    `);
  });
  migrar();
  db.pragma("foreign_keys = ON");
}

function asegurarColumna(
  db: SqliteDb,
  tabla: "lotes" | "movimientos" | "recetas" | "receta_items" | "pesajes",
  columna: string,
  definicion: string,
) {
  const columnas = db.prepare(`PRAGMA table_info(${tabla})`).all() as { name: string }[];
  if (!columnas.some((fila) => fila.name === columna)) {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
  }
}

export function getDb() {
  if (!globalForDb.sqlite) {
    globalForDb.sqlite = abrirBase(rutaBaseDatos());
  } else {
    asegurarEsquema(globalForDb.sqlite);
    asegurarCatalogo(globalForDb.sqlite);
  }
  return globalForDb.sqlite;
}
