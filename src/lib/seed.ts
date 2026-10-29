import type { SqliteDb } from "./db";
import { PRODUCTOS_MPC } from "./mpc";
import pendientes from "../data/lotes-pendientes.json";

type LoteSemilla = {
  fecha: string;
  semana: string;
  tag: string;
  producto: string;
  codigo: string;
  kgRecibidos: number;
  kgDespachados: number;
  kgConsumidos: number;
  estado: string;
};

export function sembrarSiVacia(db: SqliteDb) {
  const productos = Number(
    (db.prepare("SELECT COUNT(*) AS n FROM productos").get() as { n: number } | undefined)?.n ?? 0,
  );
  if (productos === 0) {
    const insertar = db.prepare(
      "INSERT INTO productos (codigo, nombre, tipo, descripcion) VALUES (?, ?, ?, ?)",
    );
    for (const producto of PRODUCTOS_MPC) {
      insertar.run(producto.codigo, producto.nombre, producto.tipo, producto.descripcion);
    }
  }

  const lotes = Number(
    (db.prepare("SELECT COUNT(*) AS n FROM lotes").get() as { n: number } | undefined)?.n ?? 0,
  );
  if (lotes > 0) return;

  // Solo para demos: SEED_LOTES_CDM=1 carga las paletas del Excel en lotes-pendientes.json
  if (process.env.SEED_LOTES_CDM !== "1") return;

  const insertarLote = db.prepare(
    `INSERT INTO lotes
      (tag, fecha, semana, codigo, producto, kg_recibidos, kg_despachados, kg_consumidos, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertarMov = db.prepare(
    `INSERT INTO movimientos (tag, tipo, fecha, semana, kg, estado, nota)
     VALUES (?, 'recepcion', ?, ?, ?, ?, 'Carga inicial desde CDM octubre 2026')`,
  );

  db.exec("BEGIN");
  try {
    for (const lote of pendientes as LoteSemilla[]) {
      insertarLote.run(
        lote.tag,
        lote.fecha,
        lote.semana,
        lote.codigo,
        lote.producto,
        lote.kgRecibidos,
        lote.kgDespachados,
        lote.kgConsumidos,
        lote.estado,
      );
      insertarMov.run(lote.tag, lote.fecha, lote.semana, lote.kgRecibidos, lote.estado);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
