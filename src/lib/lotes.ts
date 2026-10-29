import type { SqliteDb } from "./db";
import { fechaValida, semanaDe } from "./formato";
import { productoPorCodigo, type EstadoLote } from "./mpc";

export type Lote = {
  tag: string;
  fecha: string;
  semana: string;
  codigo: string;
  producto: string;
  kgRecibidos: number;
  kgDespachados: number;
  kgConsumidos: number;
  estado: string;
  observaciones: string;
  creadoEn: string;
};

export type Movimiento = {
  id: number;
  tag: string;
  tipo: "recepcion" | "despacho" | "consumo" | "devolucion" | "transferencia";
  fecha: string;
  semana: string;
  kg: number;
  estado: string;
  nota: string;
  creadoEn: string;
};

export type NuevoLote = {
  fecha: string;
  tag: string;
  codigo: string;
  kgRecibidos: number;
  observaciones?: string;
};

export type Resultado<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: string };

type SqlRow = Record<string, unknown>;

function filaLote(row: SqlRow): Lote {
  return {
    tag: String(row.tag),
    fecha: String(row.fecha),
    semana: String(row.semana),
    codigo: String(row.codigo),
    producto: String(row.producto),
    kgRecibidos: Number(row.kg_recibidos),
    kgDespachados: Number(row.kg_despachados),
    kgConsumidos: Number(row.kg_consumidos),
    estado: String(row.estado),
    observaciones: String(row.observaciones ?? ""),
    creadoEn: String(row.creado_en),
  };
}

function filaMov(row: SqlRow): Movimiento {
  return {
    id: Number(row.id),
    tag: String(row.tag),
    tipo: String(row.tipo) as Movimiento["tipo"],
    fecha: String(row.fecha),
    semana: String(row.semana),
    kg: Number(row.kg),
    estado: String(row.estado),
    nota: String(row.nota ?? ""),
    creadoEn: String(row.creado_en),
  };
}

export function kgRestantes(lote: Lote) {
  return Math.round((lote.kgRecibidos - lote.kgDespachados - lote.kgConsumidos) * 1000) / 1000;
}

export function validarRecepcion(input: {
  fecha: string;
  tag: string;
  codigo: string;
  cantidad: string;
}): Resultado<NuevoLote> {
  const fecha = input.fecha.trim();
  const tag = input.tag.trim();
  const codigo = input.codigo.trim();
  const kgRecibidos = Number(input.cantidad.trim().replace(",", "."));

  if (!fechaValida(fecha)) return { ok: false, error: "Indica una fecha válida." };
  if (!/^\d{4,8}$/.test(tag)) {
    return { ok: false, error: "El TAG debe ser un número de 4 a 8 dígitos." };
  }
  const producto = productoPorCodigo(codigo);
  if (!producto) return { ok: false, error: "Elige un tipo de materia prima del catálogo." };
  if (!Number.isFinite(kgRecibidos) || kgRecibidos <= 0 || kgRecibidos > 1_000_000) {
    return { ok: false, error: "Los kilos recibidos tienen que ser mayores que 0." };
  }

  return {
    ok: true,
    value: {
      fecha,
      tag,
      codigo,
      kgRecibidos: Math.round(kgRecibidos * 1000) / 1000,
    },
  };
}

export function siguienteTag(db: SqliteDb) {
  const row = db.prepare("SELECT MAX(CAST(tag AS INTEGER)) AS n FROM lotes").get() as
    | { n: number | null }
    | undefined;
  const max = Number(row?.n ?? 400000);
  return String(Math.max(max + 1, 400001));
}

export function insertarRecepcion(db: SqliteDb, nuevo: NuevoLote): Resultado<Lote> {
  const existe = db.prepare("SELECT tag FROM lotes WHERE tag = ?").get(nuevo.tag);
  if (existe) return { ok: false, error: `El TAG ${nuevo.tag} ya está registrado.` };

  const producto = productoPorCodigo(nuevo.codigo);
  if (!producto) return { ok: false, error: "Producto desconocido." };

  const semana = semanaDe(nuevo.fecha);
  const estado: EstadoLote = "PENDIENTE POR TRANSFERIR";

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO lotes
        (tag, fecha, semana, codigo, producto, kg_recibidos, kg_despachados, kg_consumidos, estado, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    ).run(
      nuevo.tag,
      nuevo.fecha,
      semana,
      producto.codigo,
      producto.nombre,
      nuevo.kgRecibidos,
      estado,
      nuevo.observaciones ?? "",
    );
    db.prepare(
      `INSERT INTO movimientos (tag, tipo, fecha, semana, kg, estado)
       VALUES (?, 'recepcion', ?, ?, ?, ?)`,
    ).run(nuevo.tag, nuevo.fecha, semana, nuevo.kgRecibidos, estado);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const lote = buscarLote(db, nuevo.tag);
  if (!lote) return { ok: false, error: "No se pudo leer el lote recién guardado." };
  return { ok: true, value: lote };
}

export function buscarLote(db: SqliteDb, tag: string) {
  const row = db.prepare("SELECT * FROM lotes WHERE tag = ?").get(tag.trim()) as SqlRow | undefined;
  return row ? filaLote(row) : null;
}

export function listarLotes(
  db: SqliteDb,
  filtro: { estado?: string; q?: string; limite?: number } = {},
) {
  const limite = Math.min(Math.max(filtro.limite ?? 200, 1), 500);
  const q = filtro.q?.trim() ?? "";
  const estado = filtro.estado?.trim() ?? "";
  const like = `%${q}%`;
  const rows = db
    .prepare(
      `SELECT * FROM lotes
       WHERE (? = '' OR estado = ?)
         AND (? = '' OR tag LIKE ? OR producto LIKE ? OR codigo LIKE ? OR semana LIKE ?)
       ORDER BY fecha DESC, tag DESC
       LIMIT ?`,
    )
    .all(estado, estado, q, like, like, like, like, limite) as SqlRow[];
  return rows.map(filaLote);
}

export function listarMovimientos(
  db: SqliteDb,
  tipo: Movimiento["tipo"] | null,
  limite = 200,
) {
  const rows = tipo
    ? db
        .prepare(
          `SELECT * FROM movimientos WHERE tipo = ? ORDER BY fecha DESC, id DESC LIMIT ?`,
        )
        .all(tipo, limite) as SqlRow[]
    : (db.prepare(`SELECT * FROM movimientos ORDER BY fecha DESC, id DESC LIMIT ?`).all(limite) as SqlRow[]);
  return rows.map(filaMov);
}

export function movimientosDeTag(db: SqliteDb, tag: string) {
  const rows = db
    .prepare("SELECT * FROM movimientos WHERE tag = ? ORDER BY id DESC")
    .all(tag) as SqlRow[];
  return rows.map(filaMov);
}

export function transferirLote(db: SqliteDb, tag: string, fecha: string): Resultado {
  const lote = buscarLote(db, tag);
  if (!lote) return { ok: false, error: "No existe ese TAG." };
  if (lote.estado !== "PENDIENTE POR TRANSFERIR") {
    return { ok: false, error: "Ese lote ya no está pendiente por transferir." };
  }
  const semana = semanaDe(fecha) || lote.semana;
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE lotes SET estado = 'TRANSFIRIO' WHERE tag = ?").run(tag);
    db.prepare(
      `INSERT INTO movimientos (tag, tipo, fecha, semana, kg, estado)
       VALUES (?, 'transferencia', ?, ?, 0, 'TRANSFIRIO')`,
    ).run(tag, fecha, semana);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ok: true, value: undefined };
}

export function registrarDespacho(
  db: SqliteDb,
  input: { tag: string; fecha: string; kg: number; nota?: string },
): Resultado {
  const lote = buscarLote(db, input.tag);
  if (!lote) return { ok: false, error: "No existe ese TAG." };
  if (input.kg <= 0) return { ok: false, error: "Los kilos despachados tienen que ser mayores que 0." };
  const resto = kgRestantes(lote);
  if (input.kg > resto + 0.001) {
    return { ok: false, error: `Solo quedan ${resto} kg en el TAG ${lote.tag}.` };
  }
  const semana = semanaDe(input.fecha) || lote.semana;
  const kgDespachados = Math.round((lote.kgDespachados + input.kg) * 1000) / 1000;
  const restoFinal = Math.round((lote.kgRecibidos - kgDespachados - lote.kgConsumidos) * 1000) / 1000;
  const estado = restoFinal <= 0 ? "RECIBIDO" : lote.estado;

  db.exec("BEGIN");
  try {
    db.prepare("UPDATE lotes SET kg_despachados = ?, estado = ? WHERE tag = ?").run(
      kgDespachados,
      estado,
      lote.tag,
    );
    db.prepare(
      `INSERT INTO movimientos (tag, tipo, fecha, semana, kg, estado, nota)
       VALUES (?, 'despacho', ?, ?, ?, 'RECIBIDO', ?)`,
    ).run(lote.tag, input.fecha, semana, input.kg, input.nota ?? "");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ok: true, value: undefined };
}

export function registrarConsumo(
  db: SqliteDb,
  input: { tag: string; fecha: string; kg: number; nota?: string },
): Resultado {
  const lote = buscarLote(db, input.tag);
  if (!lote) return { ok: false, error: "No existe ese TAG." };
  if (input.kg <= 0) return { ok: false, error: "Los kilos consumidos tienen que ser mayores que 0." };
  const resto = kgRestantes(lote);
  if (input.kg > resto + 0.001) {
    return { ok: false, error: `Solo quedan ${resto} kg en el TAG ${lote.tag}.` };
  }
  const semana = semanaDe(input.fecha) || lote.semana;
  const kgConsumidos = Math.round((lote.kgConsumidos + input.kg) * 1000) / 1000;
  const restoFinal = Math.round((lote.kgRecibidos - lote.kgDespachados - kgConsumidos) * 1000) / 1000;
  const estado = restoFinal <= 0 ? "CONSUMIDOS" : lote.estado;

  db.exec("BEGIN");
  try {
    db.prepare("UPDATE lotes SET kg_consumidos = ?, estado = ? WHERE tag = ?").run(
      kgConsumidos,
      estado,
      lote.tag,
    );
    db.prepare(
      `INSERT INTO movimientos (tag, tipo, fecha, semana, kg, estado, nota)
       VALUES (?, 'consumo', ?, ?, ?, 'CONSUMIDOS', ?)`,
    ).run(lote.tag, input.fecha, semana, input.kg, input.nota ?? "");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ok: true, value: undefined };
}

export function eliminarLote(db: SqliteDb, tag: string): Resultado {
  const limpio = tag.trim();
  const lote = buscarLote(db, limpio);
  if (!lote) return { ok: false, error: "No existe ese TAG." };

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM movimientos WHERE tag = ?").run(limpio);
    db.prepare("DELETE FROM lotes WHERE tag = ?").run(limpio);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ok: true, value: undefined };
}

export function resumir(db: SqliteDb) {
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS paletas,
         COALESCE(SUM(kg_recibidos), 0) AS kg_recibidos,
         COALESCE(SUM(kg_despachados), 0) AS kg_despachados,
         COALESCE(SUM(kg_consumidos), 0) AS kg_consumidos,
         COALESCE(SUM(CASE WHEN estado = 'PENDIENTE POR TRANSFERIR' THEN 1 ELSE 0 END), 0) AS pendientes
       FROM lotes`,
    )
    .get() as
    | {
        paletas: number;
        pendientes: number;
        kg_recibidos: number;
        kg_despachados: number;
        kg_consumidos: number;
      }
    | undefined;
  const paletas = Number(row?.paletas ?? 0);
  const pendientes = Number(row?.pendientes ?? 0);
  const kgRecibidos = Number(row?.kg_recibidos ?? 0);
  const kgDespachados = Number(row?.kg_despachados ?? 0);
  const kgConsumidos = Number(row?.kg_consumidos ?? 0);
  return {
    paletas,
    pendientes,
    kgRecibidos,
    kgDespachados,
    kgConsumidos,
    kgInventario: Math.round((kgRecibidos - kgDespachados - kgConsumidos) * 1000) / 1000,
  };
}
