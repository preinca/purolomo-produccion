import { arregloPg } from "./arreglo-pg";
import type { Db } from "./db";
import { destinoValido } from "./destinos";
import { lineaPorId } from "./lineas";
import { fechaValida, semanaDe } from "./formato";
import { siguienteToken } from "./minilote";
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

export async function siguienteTag(db: Db) {
  const row = await db.get<{ n: number | null }>("SELECT MAX(CAST(tag AS INTEGER)) AS n FROM lotes");
  const max = Number(row?.n ?? 400000);
  return String(Math.max(max + 1, 400001));
}

export async function insertarRecepcion(db: Db, nuevo: NuevoLote): Promise<Resultado<Lote>> {
  const existe = await db.get("SELECT tag FROM lotes WHERE tag = ?", nuevo.tag);
  if (existe) return { ok: false, error: `El TAG ${nuevo.tag} ya está registrado.` };

  const producto = productoPorCodigo(nuevo.codigo);
  if (!producto) return { ok: false, error: "Producto desconocido." };
  const destino = (nuevo.destino ?? "").trim();
  if (destino && !destinoValido(destino)) {
    return { ok: false, error: "Elige el producto y la presentación donde se va a usar." };
  }

  const semana = nuevo.semana || semanaDe(nuevo.fecha);
  const estado: EstadoLote = "RECIBIDO";

  const guardado = await db.transaction(async (tx) => {
    const insertado = await tx.run(
      `INSERT INTO lotes
        (tag, fecha, semana, codigo, producto, kg_recibidos, kg_despachados, kg_consumidos, estado, observaciones, destino)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
       ON CONFLICT (tag) DO NOTHING`,
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
    if (insertado === 0) return false;
    await tx.run(
      `INSERT INTO movimientos (tag, tipo, fecha, semana, kg, estado)
       VALUES (?, 'recepcion', ?, ?, ?, ?)`,
      nuevo.tag,
      nuevo.fecha,
      semana,
      nuevo.kgRecibidos,
      estado,
    );
    return true;
  });
  if (!guardado) return { ok: false, error: `El TAG ${nuevo.tag} ya está registrado.` };

  const lote = await buscarLote(db, nuevo.tag);
  if (!lote) return { ok: false, error: "No se pudo leer el lote recién guardado." };
  return { ok: true, value: lote };
}

export async function listarLotesDeProceso(db: Db, procesoId: number) {
  const rows = await db.all<SqlRow>(
    "SELECT * FROM lotes WHERE proceso_id = ? ORDER BY creado_en, tag",
    procesoId,
  );
  return rows.map(filaLote);
}

export async function listarLotesPorRecepcion(db: Db, limite = 1000) {
  const tope = Math.min(Math.max(limite, 1), 2000);
  const rows = await db.all<SqlRow>("SELECT * FROM lotes ORDER BY creado_en DESC, tag DESC LIMIT ?", tope);
  return rows.map(filaLote);
}

export async function buscarLote(db: Db, tag: string) {
  const row = await db.get<SqlRow>("SELECT * FROM lotes WHERE tag = ?", tag.trim());
  return row ? filaLote(row) : null;
}

/** Varios lotes en una sola consulta, indexados por TAG. */
export async function buscarLotes(db: Db, tags: string[]) {
  const unicos = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  if (unicos.length === 0) return new Map<string, Lote>();
  const rows = await db.all<SqlRow>("SELECT * FROM lotes WHERE tag = ANY(?::text[])", arregloPg(unicos));
  return new Map(rows.map((row) => [String(row.tag), filaLote(row)]));
}

/** Lee el lote bloqueándolo hasta que termine la transacción, para que dos salidas no se pisen. */
async function bloquearLote(tx: Db, tag: string) {
  const row = await tx.get<SqlRow>("SELECT * FROM lotes WHERE tag = ? FOR UPDATE", tag.trim());
  return row ? filaLote(row) : null;
}

export async function listarLotes(
  db: Db,
  filtro: { estado?: string; q?: string; limite?: number } = {},
) {
  const limite = Math.min(Math.max(filtro.limite ?? 200, 1), 500);
  const q = filtro.q?.trim() ?? "";
  const estado = filtro.estado?.trim() ?? "";
  const like = `%${q}%`;
  const rows = await db.all<SqlRow>(
    `SELECT * FROM lotes
     WHERE (?::text = '' OR estado = ?)
       AND (?::text = '' OR tag ILIKE ? OR producto ILIKE ? OR codigo ILIKE ? OR semana ILIKE ? OR destino ILIKE ?)
     ORDER BY fecha DESC, tag DESC
     LIMIT ?`,
    estado,
    estado,
    q,
    like,
    like,
    like,
    like,
    like,
    limite,
  );
  return rows.map(filaLote);
}

export async function listarMovimientos(
  db: Db,
  tipo: Movimiento["tipo"] | null,
  limite = 200,
) {
  const rows = tipo
    ? await db.all<SqlRow>(`SELECT * FROM movimientos WHERE tipo = ? ORDER BY fecha DESC, id DESC LIMIT ?`, tipo, limite)
    : await db.all<SqlRow>(`SELECT * FROM movimientos ORDER BY fecha DESC, id DESC LIMIT ?`, limite);
  return rows.map(filaMov);
}

export async function movimientosDeTag(db: Db, tag: string) {
  const rows = await db.all<SqlRow>("SELECT * FROM movimientos WHERE tag = ? ORDER BY id DESC", tag);
  return rows.map(filaMov);
}

export async function transferirLote(db: Db, tag: string, fecha: string): Promise<Resultado> {
  return db.transaction(async (tx): Promise<Resultado> => {
    const lote = await bloquearLote(tx, tag);
    if (!lote) return { ok: false, error: "No existe ese TAG." };
    if (lote.estado !== "RECIBIDO") {
      return { ok: false, error: "Ese lote no se puede marcar como transferido." };
    }
    const semana = semanaDe(fecha) || lote.semana;
    await tx.run("UPDATE lotes SET estado = 'TRANSFIRIO' WHERE tag = ?", lote.tag);
    await tx.run(
      `INSERT INTO movimientos (tag, tipo, fecha, semana, kg, estado)
       VALUES (?, 'transferencia', ?, ?, 0, 'TRANSFIRIO')`,
      lote.tag,
      fecha,
      semana,
    );
    return { ok: true, value: undefined };
  });
}

export async function registrarDespacho(
  db: Db,
  input: {
    tag: string;
    fecha: string;
    kg: number;
    nota?: string;
    destino: string;
    linea: string;
    minilote?: { pesajeId: number; tipo: string };
  },
): Promise<Resultado<{ token: string | null }>> {
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

  return db.transaction(async (tx): Promise<Resultado<{ token: string | null }>> => {
    const lote = await bloquearLote(tx, input.tag);
    if (!lote) return { ok: false, error: "No existe ese TAG." };
    if (lote.estado === "LOGISTICA") {
      return { ok: false, error: `El TAG ${lote.tag} fue trasladado a logística y ya no se puede consumir.` };
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

    let token: string | null = null;
    await tx.run(
      "UPDATE lotes SET kg_despachados = ?, estado = ?, destino = ? WHERE tag = ?",
      kgDespachados,
      estado,
      destinoLote,
      lote.tag,
    );
    await tx.run(
      `INSERT INTO movimientos (tag, tipo, fecha, semana, kg, estado, nota, destino, linea)
       VALUES (?, 'despacho', ?, ?, ?, 'RECIBIDO', ?, ?, ?)`,
      lote.tag,
      input.fecha,
      semana,
      input.kg,
      input.nota ?? "",
      destino,
      linea.id,
    );
    if (input.minilote) {
      token = await siguienteToken(tx);
      await tx.run(
        `INSERT INTO minilotes (token, tag, pesaje_id, tipo, kg, destino, linea)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        token,
        lote.tag,
        input.minilote.pesajeId,
        input.minilote.tipo,
        input.kg,
        destino,
        linea.id,
      );
    }
    return { ok: true, value: { token } };
  });
}

export async function guardarObservacionLote(db: Db, tag: string, observacion: string): Promise<Resultado<Lote>> {
  const lote = await buscarLote(db, tag);
  if (!lote) return { ok: false, error: "Ese TAG no existe." };
  const texto = observacion.trim();
  if (texto.length > 500) return { ok: false, error: "La observación no puede pasar de 500 caracteres." };
  await db.run("UPDATE lotes SET observaciones = ? WHERE tag = ?", texto, lote.tag);
  const actualizado = await buscarLote(db, lote.tag);
  if (!actualizado) return { ok: false, error: "No se pudo guardar la observación." };
  return { ok: true, value: actualizado };
}

export async function trasladarALogistica(
  db: Db,
  input: { tag: string; fecha: string; observacion: string },
): Promise<Resultado> {
  const observacion = input.observacion.trim();
  if (!observacion) return { ok: false, error: "Escribe la observación del traslado a logística." };
  if (observacion.length > 500) return { ok: false, error: "La observación no puede pasar de 500 caracteres." };

  return db.transaction(async (tx): Promise<Resultado> => {
    const lote = await bloquearLote(tx, input.tag);
    if (!lote) return { ok: false, error: "No existe ese TAG." };
    if (lote.estado === "LOGISTICA") {
      return { ok: false, error: `El TAG ${lote.tag} ya fue trasladado a logística.` };
    }
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

    await tx.run(
      "UPDATE lotes SET estado = 'LOGISTICA', observaciones = ?, destino = ? WHERE tag = ?",
      observaciones,
      usos.join(" · "),
      lote.tag,
    );
    await tx.run(
      `INSERT INTO movimientos (tag, tipo, fecha, semana, kg, estado, nota, destino)
       VALUES (?, 'transferencia', ?, ?, ?, 'LOGISTICA', ?, 'LOGISTICA')`,
      lote.tag,
      input.fecha,
      semana,
      resto,
      `Trasladado a logística. ${observacion}`,
    );
    return { ok: true, value: undefined };
  });
}

export async function registrarConsumo(
  db: Db,
  input: { tag: string; fecha: string; kg: number; nota?: string },
): Promise<Resultado> {
  return db.transaction(async (tx): Promise<Resultado> => {
    const lote = await bloquearLote(tx, input.tag);
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

    await tx.run("UPDATE lotes SET kg_consumidos = ?, estado = ? WHERE tag = ?", kgConsumidos, estado, lote.tag);
    await tx.run(
      `INSERT INTO movimientos (tag, tipo, fecha, semana, kg, estado, nota)
       VALUES (?, 'consumo', ?, ?, ?, 'CONSUMIDOS', ?)`,
      lote.tag,
      input.fecha,
      semana,
      input.kg,
      input.nota ?? "",
    );
    return { ok: true, value: undefined };
  });
}

export async function eliminarLote(db: Db, tag: string): Promise<Resultado> {
  const limpio = tag.trim();
  const lote = await buscarLote(db, limpio);
  if (!lote) return { ok: false, error: "No existe ese TAG." };

  await db.transaction(async (tx) => {
    await tx.run("DELETE FROM movimientos WHERE tag = ?", limpio);
    await tx.run("DELETE FROM lotes WHERE tag = ?", limpio);
  });
  return { ok: true, value: undefined };
}

export async function resumir(db: Db) {
  const row = await db.get<{
    paletas: number;
    kg_recibidos: number;
    kg_despachados: number;
    kg_consumidos: number;
  }>(
    `SELECT
       COUNT(*) AS paletas,
       COALESCE(SUM(kg_recibidos), 0) AS kg_recibidos,
       COALESCE(SUM(kg_despachados), 0) AS kg_despachados,
       COALESCE(SUM(kg_consumidos), 0) AS kg_consumidos
     FROM lotes`,
  );
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
