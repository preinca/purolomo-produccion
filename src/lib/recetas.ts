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

export type ItemReceta = {
  tipo: string;
  kg: number;
  tolerancia?: number;
  minimo?: number;
  maximo?: number;
};

export type FilasReceta = {
  items: ItemReceta[];
  toleranciaKg: number;
  minimoKg: number;
  maximoKg: number;
};

export type LimitesGuardados = { tolerancia?: number; minimo?: number; maximo?: number };

export type Receta = {
  id: number;
  destino: string;
  linea: string;
  objetivoKg: number;
  toleranciaKg: number;
  minimoKg: number;
  maximoKg: number;
  items: ItemReceta[];
};

export function limitesLinea(linea: string) {
  const factor = linea === "2" ? 2 : 1;
  const objetivo = ALIBAL_1K.objetivoLinea1 * factor;
  const tolerancia = ALIBAL_1K.toleranciaLinea1 * factor;
  return { factor, objetivo, tolerancia, minimo: objetivo - tolerancia, maximo: objetivo + tolerancia };
}

export function metaLinea(linea: string, items: ItemReceta[], guardados?: LimitesGuardados) {
  const limites = limitesLinea(linea);
  const tolerancia = guardados?.tolerancia ?? limites.tolerancia;
  const minimo = guardados?.minimo ?? limites.objetivo - tolerancia;
  const maximo = guardados?.maximo ?? limites.objetivo + tolerancia;
  return {
    factor: limites.factor,
    objetivo: limites.objetivo,
    tolerancia,
    minimo,
    maximo,
    items: items.map((item) => {
      const toleranciaItem = item.tolerancia ?? tolerancia;
      return {
        tipo: item.tipo,
        kg: item.kg,
        tolerancia: toleranciaItem,
        minimo: item.minimo ?? item.kg,
        maximo: item.maximo ?? redondear(item.kg + toleranciaItem),
      };
    }),
  };
}

export function interpretarFilasReceta(filas: unknown[][], linea = "1"): Resultado<FilasReceta> {
  const datos = filas
    .map((fila) => (Array.isArray(fila) ? fila : []))
    .filter((fila) => fila.some((celda) => String(celda ?? "").trim() !== ""));
  if (datos.length === 0) return { ok: false, error: "El Excel no tiene filas." };

  const indiceEncabezado = datos.findIndex((fila) => columnasReceta(fila));
  const columnas = indiceEncabezado >= 0 ? columnasReceta(datos[indiceEncabezado]) : null;
  const cuerpo = columnas ? datos.slice(indiceEncabezado + 1) : datos;
  const colTipo = columnas?.tipo ?? 0;
  const colKg = columnas?.kg ?? 1;
  const colTolerancia = columnas?.tolerancia ?? -1;
  const colMinimo = columnas?.minimo ?? -1;
  const colMaximo = columnas?.maximo ?? -1;
  const colRango = columnas?.rango ?? -1;
  const producto = limitesDelProducto(indiceEncabezado >= 0 ? datos.slice(0, indiceEncabezado) : [], linea);
  const items: ItemReceta[] = [];

  for (const fila of cuerpo) {
    const tipo = String(fila[colTipo] ?? "").trim().toUpperCase();
    const kg = Number(String(fila[colKg] ?? "").trim().replace(",", "."));
    if (tipo === "TOTAL" || tipo === "SUMA") break;
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
    const kilos = redondear(kg);
    const toleranciaCelda = colTolerancia >= 0 ? numeroCelda(fila[colTolerancia]) : null;
    if (toleranciaCelda !== null && toleranciaCelda < 0) {
      return { ok: false, error: `La tolerancia de ${tipo} no puede ser negativa.` };
    }
    const tolerancia = toleranciaCelda ?? producto.tolerancia;
    const rango = colRango >= 0 ? rangoDeTexto(fila[colRango]) : null;
    const minimo = (colMinimo >= 0 ? numeroCelda(fila[colMinimo]) : null) ?? rango?.minimo ?? kilos;
    const maximo = (colMaximo >= 0 ? numeroCelda(fila[colMaximo]) : null) ?? rango?.maximo ?? redondear(kilos + tolerancia);
    if (minimo > maximo) {
      return { ok: false, error: `El rango de ${tipo} tiene el mínimo por encima del máximo.` };
    }
    if (kilos + 0.001 < minimo || kilos > maximo + 0.001) {
      return {
        ok: false,
        error: `Los ${kilos} kg de ${tipo} quedan fuera de su rango, de ${minimo} a ${maximo} kg.`,
      };
    }
    items.push({ tipo, kg: kilos, tolerancia, minimo, maximo });
  }

  if (items.length < 1) return { ok: false, error: "La receta no tiene materias primas." };
  const total = redondear(items.reduce((suma, item) => suma + item.kg, 0));
  if (producto.minimo > producto.maximo) {
    return { ok: false, error: "El mínimo del pesaje está por encima del máximo." };
  }
  if (total < producto.minimo || total > producto.maximo) {
    return {
      ok: false,
      error: `La receta suma ${total} kg. El pesaje de Alibal queda entre ${producto.minimo} y ${producto.maximo} kg.`,
    };
  }
  return {
    ok: true,
    value: { items, toleranciaKg: producto.tolerancia, minimoKg: producto.minimo, maximoKg: producto.maximo },
  };
}

function limitesDelProducto(filas: unknown[][], linea: string) {
  const defecto = limitesLinea(linea);
  let tolerancia = defecto.tolerancia;
  let minimo: number | null = null;
  let maximo: number | null = null;
  for (const fila of filas) {
    for (let indice = 0; indice < fila.length; indice += 1) {
      const etiqueta = normalizar(fila[indice]);
      const numero = numeroCelda(fila[indice + 1]);
      if (numero === null) continue;
      if (etiqueta.startsWith("tolerancia") && numero >= 0) tolerancia = numero;
      if (etiqueta === "minimo") minimo = numero;
      if (etiqueta === "maximo") maximo = numero;
    }
  }
  return {
    tolerancia,
    minimo: minimo ?? redondear(defecto.objetivo - tolerancia),
    maximo: maximo ?? redondear(defecto.objetivo + tolerancia),
  };
}

function rangoDeTexto(valor: unknown) {
  const numeros = [...String(valor ?? "").matchAll(/-?\d+(?:[.,]\d+)?/g)]
    .map((coincidencia) => numeroCelda(coincidencia[0]))
    .filter((numero): numero is number => numero !== null);
  if (numeros.length < 2) return null;
  return { minimo: numeros[0], maximo: numeros[1] };
}

function normalizar(valor: unknown) {
  return String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function numeroCelda(valor: unknown) {
  if (typeof valor === "number") return Number.isFinite(valor) ? redondear(valor) : null;
  const texto = String(valor ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  if (!texto || texto === "-" || texto === ".") return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? redondear(numero) : null;
}

function redondear(valor: number) {
  return Math.round(valor * 1000) / 1000;
}

function columnasReceta(fila: unknown[]) {
  const celdas = fila.map((celda) => String(celda ?? "").trim().toLowerCase());
  const tipo = celdas.findIndex((celda) => celda === "tipo" || celda === "mpc");
  const kg = celdas.findIndex((celda) => celda === "kg" || celda === "kilos" || celda === "kilo");
  if (tipo < 0 || kg < 0) return null;
  const tolerancia = celdas.findIndex((celda) => normalizar(celda) === "tolerancia");
  const minimo = celdas.findIndex((celda) => normalizar(celda) === "minimo");
  const maximo = celdas.findIndex((celda) => normalizar(celda) === "maximo");
  const rango = celdas.findIndex((celda) => normalizar(celda) === "rango");
  return { tipo, kg, tolerancia, minimo, maximo, rango };
}

export function leerRecetaExcel(archivo: Buffer, linea = "1"): Resultado<FilasReceta> {
  let libro: XLSX.WorkBook;
  try {
    libro = XLSX.read(archivo, { type: "buffer" });
  } catch {
    return { ok: false, error: "No se pudo leer ese Excel." };
  }
  const nombre = libro.SheetNames[0];
  if (!nombre) return { ok: false, error: "El Excel no tiene hojas." };
  return interpretarFilasReceta(filasDeHoja(libro.Sheets[nombre]), linea);
}

function filasDeHoja(hoja: XLSX.WorkSheet | undefined) {
  if (!hoja?.["!ref"]) return [];
  const rango = XLSX.utils.decode_range(hoja["!ref"]);
  const filas: unknown[][] = [];
  for (let fila = rango.s.r; fila <= rango.e.r; fila += 1) {
    const celdas: unknown[] = [];
    for (let columna = rango.s.c; columna <= rango.e.c; columna += 1) {
      const celda = hoja[XLSX.utils.encode_cell({ r: fila, c: columna })];
      celdas.push(celda?.v ?? celda?.w ?? "");
    }
    filas.push(celdas);
  }
  return filas;
}

export function guardarReceta(db: SqliteDb, receta: FilasReceta, linea = "1"): Receta {
  const limites = limitesLinea(linea);
  const total = redondear(receta.items.reduce((suma, item) => suma + item.kg, 0));
  const lineaGuardada = limites.factor === 2 ? "2" : "1";
  db.exec("BEGIN");
  try {
    const insertada = db
      .prepare(
        `INSERT INTO recetas (destino, linea, objetivo_kg, tolerancia_kg, minimo_kg, maximo_kg)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(ALIBAL_1K.destino, lineaGuardada, total, receta.toleranciaKg, receta.minimoKg, receta.maximoKg);
    const recetaId = Number(insertada.lastInsertRowid);
    const insertarItem = db.prepare(
      `INSERT INTO receta_items (receta_id, tipo, kg, tolerancia_kg, minimo_kg, maximo_kg)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const item of receta.items) {
      insertarItem.run(
        recetaId,
        item.tipo,
        item.kg,
        item.tolerancia ?? receta.toleranciaKg,
        item.minimo ?? item.kg,
        item.maximo ?? redondear(item.kg + (item.tolerancia ?? receta.toleranciaKg)),
      );
    }
    db.exec("COMMIT");
    return {
      id: recetaId,
      destino: ALIBAL_1K.destino,
      linea: lineaGuardada,
      objetivoKg: total,
      toleranciaKg: receta.toleranciaKg,
      minimoKg: receta.minimoKg,
      maximoKg: receta.maximoKg,
      items: receta.items,
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function armarReceta(db: SqliteDb, fila: Record<string, unknown>): Receta {
  const linea = String(fila.linea ?? "1");
  const toleranciaKg = Number(fila.tolerancia_kg);
  const base = limitesLinea(linea);
  const items = db
    .prepare(
      "SELECT tipo, kg, tolerancia_kg, minimo_kg, maximo_kg FROM receta_items WHERE receta_id = ? ORDER BY id",
    )
    .all(Number(fila.id)) as {
    tipo: string;
    kg: number;
    tolerancia_kg: number | null;
    minimo_kg: number | null;
    maximo_kg: number | null;
  }[];
  return {
    id: Number(fila.id),
    destino: String(fila.destino),
    linea,
    objetivoKg: Number(fila.objetivo_kg),
    toleranciaKg,
    minimoKg: fila.minimo_kg == null ? redondear(base.objetivo - toleranciaKg) : Number(fila.minimo_kg),
    maximoKg: fila.maximo_kg == null ? redondear(base.objetivo + toleranciaKg) : Number(fila.maximo_kg),
    items: items.map((item) => {
      const kg = Number(item.kg);
      const tolerancia = item.tolerancia_kg == null ? toleranciaKg : Number(item.tolerancia_kg);
      return {
        tipo: item.tipo,
        kg,
        tolerancia,
        minimo: item.minimo_kg == null ? kg : Number(item.minimo_kg),
        maximo: item.maximo_kg == null ? redondear(kg + tolerancia) : Number(item.maximo_kg),
      };
    }),
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
