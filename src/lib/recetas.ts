import type { SqliteDb } from "./db";
import type { Resultado } from "./lotes";
import { productoPorTipo } from "./mpc";
import * as XLSX from "xlsx";

/** Alibal 1 kg: la línea 1 usa 740 kg de CDM y la línea 2 el doble. */
export const ALIBAL_1K = {
  destino: "ALIBAL 1 K",
  objetivoLinea1: 740,
  toleranciaLinea1: 15,
} as const;

export type ItemReceta = { tipo: string; kg: number };

export type Receta = {
  id: number;
  destino: string;
  linea: string;
  objetivoKg: number;
  toleranciaKg: number;
  items: ItemReceta[];
};

export function limitesLinea(linea: string) {
  const factor = linea === "2" ? 2 : 1;
  const objetivo = ALIBAL_1K.objetivoLinea1 * factor;
  const tolerancia = ALIBAL_1K.toleranciaLinea1 * factor;
  return { factor, objetivo, tolerancia, minimo: objetivo - tolerancia, maximo: objetivo + tolerancia };
}

export function metaLinea(linea: string, items: ItemReceta[]) {
  const limites = limitesLinea(linea);
  return {
    factor: limites.factor,
    objetivo: limites.objetivo,
    tolerancia: limites.tolerancia,
    items: items.map((item) => ({ tipo: item.tipo, kg: item.kg })),
  };
}

export function interpretarFilasReceta(filas: unknown[][], linea = "1"): Resultado<ItemReceta[]> {
  const datos = filas
    .map((fila) => (Array.isArray(fila) ? fila : []))
    .filter((fila) => fila.some((celda) => String(celda ?? "").trim() !== ""));
  if (datos.length === 0) return { ok: false, error: "El Excel no tiene filas." };

  const encabezado = datos[0].map((celda) => String(celda ?? "").trim().toLowerCase());
  const pareceEncabezado = encabezado.some((celda) => /tipo|mpc|kg|kilo/.test(celda));
  const cuerpo = pareceEncabezado ? datos.slice(1) : datos;
  const items: ItemReceta[] = [];

  for (const fila of cuerpo) {
    const tipo = String(fila[0] ?? "").trim().toUpperCase();
    const kg = Number(String(fila[1] ?? "").trim().replace(",", "."));
    if (!tipo && !Number.isFinite(kg)) continue;
    if (!tipo) return { ok: false, error: "Hay una fila sin el tipo de MPC." };
    if (!productoPorTipo(tipo)) {
      return { ok: false, error: `El tipo ${tipo} no está en la leyenda MPC.` };
    }
    if (!Number.isFinite(kg) || kg <= 0) {
      return { ok: false, error: `Los kilos de ${tipo} tienen que ser mayores que 0.` };
    }
    if (items.some((item) => item.tipo === tipo)) {
      return { ok: false, error: `El tipo ${tipo} está repetido en la receta.` };
    }
    items.push({ tipo, kg: Math.round(kg * 1000) / 1000 });
  }

  if (items.length < 1) return { ok: false, error: "La receta no tiene materias primas." };
  const total = Math.round(items.reduce((suma, item) => suma + item.kg, 0) * 1000) / 1000;
  const limites = limitesLinea(linea);
  if (total < limites.minimo || total > limites.maximo) {
    return {
      ok: false,
      error: `La receta de la línea ${limites.factor === 2 ? "2" : "1"} suma ${total} kg. Tiene que quedar entre ${limites.minimo} y ${limites.maximo} kg.`,
    };
  }
  return { ok: true, value: items };
}

export function leerRecetaExcel(archivo: Buffer, linea = "1"): Resultado<ItemReceta[]> {
  let libro: XLSX.WorkBook;
  try {
    libro = XLSX.read(archivo, { type: "buffer" });
  } catch {
    return { ok: false, error: "No se pudo leer ese Excel." };
  }
  const nombre = libro.SheetNames[0];
  if (!nombre) return { ok: false, error: "El Excel no tiene hojas." };
  const hoja = libro.Sheets[nombre];
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "", raw: false }) as unknown[][];
  return interpretarFilasReceta(filas, linea);
}

export function guardarReceta(db: SqliteDb, items: ItemReceta[], linea = "1"): Receta {
  const limites = limitesLinea(linea);
  const total = Math.round(items.reduce((suma, item) => suma + item.kg, 0) * 1000) / 1000;
  const lineaGuardada = limites.factor === 2 ? "2" : "1";
  db.exec("BEGIN");
  try {
    const insertada = db
      .prepare("INSERT INTO recetas (destino, linea, objetivo_kg, tolerancia_kg) VALUES (?, ?, ?, ?)")
      .run(ALIBAL_1K.destino, lineaGuardada, total, limites.tolerancia);
    const recetaId = Number(insertada.lastInsertRowid);
    const insertarItem = db.prepare("INSERT INTO receta_items (receta_id, tipo, kg) VALUES (?, ?, ?)");
    for (const item of items) insertarItem.run(recetaId, item.tipo, item.kg);
    db.exec("COMMIT");
    return {
      id: recetaId,
      destino: ALIBAL_1K.destino,
      linea: lineaGuardada,
      objetivoKg: total,
      toleranciaKg: limites.tolerancia,
      items,
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function armarReceta(db: SqliteDb, fila: Record<string, unknown>): Receta {
  const items = db
    .prepare("SELECT tipo, kg FROM receta_items WHERE receta_id = ? ORDER BY id")
    .all(Number(fila.id)) as { tipo: string; kg: number }[];
  return {
    id: Number(fila.id),
    destino: String(fila.destino),
    linea: String(fila.linea ?? "1"),
    objetivoKg: Number(fila.objetivo_kg),
    toleranciaKg: Number(fila.tolerancia_kg),
    items: items.map((item) => ({ tipo: item.tipo, kg: Number(item.kg) })),
  };
}

export function recetaVigente(db: SqliteDb, linea = "1", destino: string = ALIBAL_1K.destino): Receta | null {
  const lineaBuscada = linea === "2" ? "2" : "1";
  const fila = db
    .prepare("SELECT * FROM recetas WHERE destino = ? AND linea = ? ORDER BY id DESC LIMIT 1")
    .get(destino, lineaBuscada) as Record<string, unknown> | undefined;
  return fila ? armarReceta(db, fila) : null;
}

export function recetasCargadas(db: SqliteDb) {
  const filas = db
    .prepare(
      `SELECT r.* FROM recetas r
       INNER JOIN (
         SELECT destino, linea, MAX(id) AS id FROM recetas GROUP BY destino, linea
       ) ultima ON ultima.id = r.id
       ORDER BY r.destino, r.linea`,
    )
    .all() as Record<string, unknown>[];
  return filas.map((fila) => armarReceta(db, fila));
}
