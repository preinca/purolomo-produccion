// Base de datos Postgres en memoria (PGlite) para las pruebas. Usa el mismo esquema que Supabase.
import fs from "node:fs";
import path from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { crearDb, type Conexion, type Db, type Fila } from "./db";
import { asegurarCatalogo } from "./seed";

export async function basePrueba(): Promise<Db> {
  const pg = await PGlite.create();
  await pg.exec(fs.readFileSync(path.join(process.cwd(), "supabase", "esquema.sql"), "utf8"));
  const sobre = (q: PGlite | Transaction): Conexion => ({
    async consultar(texto, params) {
      const resultado = await q.query<Fila>(texto, params);
      return { filas: resultado.rows, cambios: resultado.affectedRows ?? 0 };
    },
    async ejecutar(texto) {
      await q.exec(texto);
    },
  });
  const db = crearDb(sobre(pg), (fn) => pg.transaction((tx) => fn(sobre(tx))));
  await asegurarCatalogo(db);
  return db;
}
