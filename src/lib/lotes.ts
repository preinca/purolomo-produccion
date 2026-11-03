import type { SqliteDb } from "./db";
import { destinoValido } from "./destinos";
import { lineaPorId } from "./lineas";
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
  destino: string;
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
  destino: string;
  linea: string;
  creadoEn: string;
};

export type NuevoLote = {
  fecha: string;
  tag: string;
  codigo: string;
  kgRecibidos: number;
  observaciones?: string;
  destino?: string;
  semana?: string;
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
    destino: String(row.destino ?? ""),
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
    destino: String(row.destino ?? ""),
    linea: String(row.linea ?? ""),
    creadoEn: String(row.creado_en),
  };
}

export function kgRestantes(lote: Lote) {
  return Math.round((lote.kgRecibidos - lote.kgDespachados - lote.kgConsumidos) * 1000) / 1000;
}

/** Kilos que ya salieron del TAG. La salida se guarda como despacho. */
export function kgConsumidosDe(lote: Pick<Lote, "kgDespachados" | "kgConsumidos">) {
  return Math.round((lote.kgDespachados + lote.kgConsumidos) * 1000) / 1000;
}

export function kgDisponiblesDe(lote: Pick<Lote, "kgRecibidos" | "kgDespachados" | "kgConsumidos">) {
  return Math.round((lote.kgRecibidos - kgConsumidosDe(lote)) * 1000) / 1000;
}

export function tagAgotado(lote: Pick<Lote, "kgRecibidos" | "kgDespachados" | "kgConsumidos">) {
  return kgDisponiblesDe(lote) <= 0.001;
}

export function validarRecepcion(input: {
  fecha: string;
  tag: string;
  codigo: string;
  cantidad: string;
  destino?: string;
  semana?: string;
}): Resultado<NuevoLote> {
  const fecha = input.fecha.trim();
  const tag = input.tag.trim();
  const codigo = input.codigo.trim();
  const destino = (input.destino ?? "").trim();
  const kgRecibidos = Number(input.cantidad.trim().replace(",", "."));
  const semanaEscrita = (input.semana ?? "").trim();
  let semana: string | undefined;
  if (semanaEscrita) {
    const numero = Number(semanaEscrita.replace(/^semana\s*/i, ""));
    if (!Number.isInteger(numero) || numero < 1 || numero > 53) {
      return { ok: false, error: "La semana tiene que ser un número del 1 al 53." };
    }
    semana = `SEMANA ${numero}`;
  }

  if (!fechaValida(fecha)) return { ok: false, error: "Indica una fecha válida." };
  if (!/^\d{4,8}$/.test(tag)) {
    return { ok: false, error: "El TAG debe ser un número de 4 a 8 dígitos." };
  }
  const producto = productoPorCodigo(codigo);
  if (!producto) return { ok: false, error: "Elige un tipo de materia prima del catálogo." };
  if (destino && !destinoValido(destino)) {
    return { ok: false, error: "Elige el producto y la presentación donde se va a usar." };
  }
  if (!Number.isFinite(kgRecibidos) || kgRecibidos <= 0 || kgRecibidos > 1_000_000) {
    return { ok: false, error: "Los kilos recibidos tienen que ser mayores que 0." };
  }

  return {
    ok: true,
    value: {
      fecha,
      tag,
      codigo,
      destino,
      kgRecibidos: Math.round(kgRecibidos * 1000) / 1000,
      semana,
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
  const destino = (nuevo.destino ?? "").trim();
  if (destino && !destinoValido(destino)) {
    return { ok: false, error: "Elige el producto y la presentación donde se va a usar." };
  }

  const semana = nuevo.semana || semanaDe(nuevo.fecha);
  const estado: EstadoLote = "RECIBIDO";

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO lotes
        (tag, fecha, semana, codigo, producto, kg_recibidos, kg_despachados, kg_consumidos, estado, observaciones, destino)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
    ).run(
      nuevo.tag,
      nuevo.fecha,
      semana,
      producto.codigo,
      producto.nombre,
      nuevo.kgRecibidos,
      estado,
      nuevo.observaciones ?? "",
      destino,
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
         AND (? = '' OR tag LIKE ? OR producto LIKE ? OR codigo LIKE ? OR semana LIKE ? OR destino LIKE ?)
       ORDER BY fecha DESC, tag DESC
       LIMIT ?`,
    )
    .all(estado, estado, q, like, like, like, like, like, limite) as SqlRow[];
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
  if (lote.estado !== "RECIBIDO") {
    return { ok: false, error: "Ese lote no se puede marcar como transferido." };
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
  input: {
    tag: string;
    fecha: string;
    kg: number;
    nota?: string;
    destino: string;
    linea: string;
    minilote?: { pesajeId: number; tipo: string };
  },
): Resultado<{ token: string | null }> {
  const lote = buscarLote(db, input.tag);
  if (!lote) return { ok: false, error: "No existe ese TAG." };
  if (lote.estado === "LOGISTICA") {
    return { ok: false, error: `El TAG ${lote.tag} fue trasladado a logística y ya no se puede consumir.` };
  }
  if (input.kg <= 0) return { ok: false, error: "Los kilos consumidos tienen que ser mayores que 0." };
  const destino = input.destino.trim();
  if (!destinoValido(destino)) {
    return { ok: false, error: "Elige el producto y la presentación donde se va a usar." };
  }
  const linea = lineaPorId(input.linea.trim());
  if (!linea) return { ok: false, error: "Elige si se usa en la línea 1 o en la línea 2." };
  if (input.kg > linea.capacidadKg) {
    return {
      ok: false,
      error: `La ${linea.nombre} admite hasta ${linea.capacidadKg} kg.`,
    };
  }
  const resto = kgRestantes(lote);
  if (input.kg > resto + 0.001) {
    return { ok: false, error: `Solo quedan ${resto} kg en el TAG ${lote.tag}.` };
  }
  const semana = semanaDe(input.fecha) || lote.semana;
  const kgDespachados = Math.round((lote.kgDespachados + input.kg) * 1000) / 1000;
  const restoFinal = Math.round((lote.kgRecibidos - kgDespachados - lote.kgConsumidos) * 1000) / 1000;
  const estado = restoFinal <= 0 ? "RECIBIDO" : lote.estado;
  const usos = lote.destino
    .split(" · ")
    .map((parte) => parte.trim())
    .filter(Boolean);
  if (!usos.includes(destino)) usos.push(destino);
  const destinoLote = usos.join(" · ");

  db.exec("BEGIN");
  let token: string | null = null;
  try {
    db.prepare("UPDATE lotes SET kg_despachados = ?, estado = ?, destino = ? WHERE tag = ?").run(
      kgDespachados,
      estado,
      destinoLote,
      lote.tag,
    );
    db.prepare(
      `INSERT INTO movimientos (tag, tipo, fecha, semana, kg, estado, nota, destino, linea)
       VALUES (?, 'despacho', ?, ?, ?, 'RECIBIDO', ?, ?, ?)`,
    ).run(lote.tag, input.fecha, semana, input.kg, input.nota ?? "", destino, linea.id);
    if (input.minilote) {
      const correlativo = db
        .prepare("SELECT COALESCE(MAX(CAST(SUBSTR(token, 3) AS INTEGER)), 0) AS n FROM minilotes")
        .get() as { n: number };
      token = `ML${String(Number(correlativo.n) + 1).padStart(6, "0")}`;
      db.prepare(
        `INSERT INTO minilotes (token, tag, pesaje_id, tipo, kg, destino, linea)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(token, lote.tag, input.minilote.pesajeId, input.minilote.tipo, input.kg, destino, linea.id);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ok: true, value: { token } };
}

export function guardarObservacionLote(db: SqliteDb, tag: string, observacion: string): Resultado<Lote> {
  const lote = buscarLote(db, tag);
  if (!lote) return { ok: false, error: "Ese TAG no existe." };
  const texto = observacion.trim();
  if (texto.length > 500) return { ok: false, error: "La observación no puede pasar de 500 caracteres." };
  db.prepare("UPDATE lotes SET observaciones = ? WHERE tag = ?").run(texto, lote.tag);
  const actualizado = buscarLote(db, lote.tag);
  if (!actualizado) return { ok: false, error: "No se pudo guardar la observación." };
  return { ok: true, value: actualizado };
}

export function trasladarALogistica(
  db: SqliteDb,
  input: { tag: string; fecha: string; observacion: string },
): Resultado {
  const lote = buscarLote(db, input.tag);
  if (!lote) return { ok: false, error: "No existe ese TAG." };
  if (lote.estado === "LOGISTICA") {
    return { ok: false, error: `El TAG ${lote.tag} ya fue trasladado a logística.` };
  }
  const observacion = input.observacion.trim();
  if (!observacion) return { ok: false, error: "Escribe la observación del traslado a logística." };
  if (observacion.length > 500) return { ok: false, error: "La observación no puede pasar de 500 caracteres." };
  const resto = kgRestantes(lote);
  if (resto <= 0.001) return { ok: false, error: "Ese TAG ya no tiene kilos para trasladar." };
  if (!fechaValida(input.fecha)) return { ok: false, error: "Indica una fecha válida." };
  const semana = semanaDe(input.fecha) || lote.semana;
  const previa = lote.observaciones.trim();
  const observaciones = previa ? `${previa} · ${observacion}` : observacion;
  const usos = lote.destino
    .split(" · ")
    .map((parte) => parte.trim())
    .filter(Boolean);
  if (!usos.includes("LOGISTICA")) usos.push("LOGISTICA");

  db.exec("BEGIN");
  try {
    db.prepare("UPDATE lotes SET estado = 'LOGISTICA', observaciones = ?, destino = ? WHERE tag = ?").run(
      observaciones,
      usos.join(" · "),
      lote.tag,
    );
    db.prepare(
      `INSERT INTO movimientos (tag, tipo, fecha, semana, kg, estado, nota, destino)
       VALUES (?, 'transferencia', ?, ?, ?, 'LOGISTICA', ?, 'LOGISTICA')`,
    ).run(lote.tag, input.fecha, semana, resto, `Trasladado a logística. ${observacion}`);
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
         COALESCE(SUM(kg_consumidos), 0) AS kg_consumidos
       FROM lotes`,
    )
    .get() as
    | {
        paletas: number;
        kg_recibidos: number;
        kg_despachados: number;
        kg_consumidos: number;
      }
    | undefined;
  const paletas = Number(row?.paletas ?? 0);
  const kgRecibidos = Number(row?.kg_recibidos ?? 0);
  const kgDespachados = Number(row?.kg_despachados ?? 0);
  const kgConsumidos = Number(row?.kg_consumidos ?? 0);
  return {
    paletas,
    kgRecibidos,
    kgDespachados,
    kgConsumidos,
    kgInventario: Math.round((kgRecibidos - kgDespachados - kgConsumidos) * 1000) / 1000,
  };
}
