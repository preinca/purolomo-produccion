import type { SqliteDb } from "./db";
import { fechaValida, formatoHora, formatoKg } from "./formato";
import { registrarDespacho, type Resultado } from "./lotes";
import { normalizarToken, sufijoDeMiniLote } from "./minilote";
import { productoPorCodigo } from "./mpc";
import type { RetiroEnQr } from "./qr";
import { ALIBAL_1K, metaLinea, recetaVigente, type ItemReceta } from "./recetas";

export type Pesaje = {
  id: number;
  numero: number;
  fecha: string;
  destino: string;
  linea: string;
  recetaId: number;
  observaciones: string;
  finalizado: boolean;
  creadoEn: string;
  registradoEn: string;
};

export type MiniLote = {
  token: string;
  tag: string;
  pesajeId: number;
  tipo: string;
  kg: number;
  destino: string;
  linea: string;
  numeroPesaje: number;
};

function filaPesaje(row: Record<string, unknown>): Pesaje {
  return {
    id: Number(row.id),
    numero: Number(row.numero),
    fecha: String(row.fecha),
    destino: String(row.destino),
    linea: String(row.linea),
    recetaId: Number(row.receta_id),
    observaciones: String(row.observaciones ?? ""),
    finalizado: Number(row.finalizado ?? 0) === 1,
    creadoEn: String(row.creado_en ?? ""),
    registradoEn: String(row.registrado_en ?? ""),
  };
}

function alcanzoMinimo(db: SqliteDb, pesaje: Pesaje) {
  const progreso = progresoPesaje(db, pesaje);
  return progreso.total + 0.001 >= progreso.objetivo - progreso.tolerancia;
}

/** Los pesajes que ya habían llegado al mínimo siguen en el registro. Los nuevos entran al pulsar finalizar. */
function prepararCierres(db: SqliteDb) {
  db.exec("CREATE TABLE IF NOT EXISTS app_meta (clave TEXT PRIMARY KEY, valor TEXT NOT NULL)");
  const ya = db.prepare("SELECT valor FROM app_meta WHERE clave = 'pesajes_cierre_v1'").get();
  if (ya) return;
  const filas = db.prepare("SELECT * FROM pesajes").all() as Record<string, unknown>[];
  const cerrar = db.prepare("UPDATE pesajes SET finalizado = 1 WHERE id = ?");
  const guardar = db.transaction(() => {
    for (const fila of filas) {
      const pesaje = filaPesaje(fila);
      if (alcanzoMinimo(db, pesaje)) cerrar.run(pesaje.id);
    }
    db.prepare("INSERT INTO app_meta (clave, valor) VALUES ('pesajes_cierre_v1', '1')").run();
  });
  guardar();
}

export function pesajeTerminado(db: SqliteDb, pesaje: Pesaje) {
  prepararCierres(db);
  return buscarPesaje(db, pesaje.id)?.finalizado ?? pesaje.finalizado;
}

export function pesajeEnCurso(db: SqliteDb, destino: string = ALIBAL_1K.destino) {
  prepararCierres(db);
  const pesajes = listarPesajes(db, destino, 200);
  return pesajes.find((pesaje) => !pesajeTerminado(db, pesaje)) ?? null;
}

export function siguienteNumero(db: SqliteDb, _fecha?: string, destino: string = ALIBAL_1K.destino) {
  const fila = db
    .prepare("SELECT COALESCE(MAX(numero), 0) AS numero FROM pesajes WHERE destino = ?")
    .get(destino) as { numero: number };
  return Number(fila.numero) + 1;
}

export function abrirPesaje(
  db: SqliteDb,
  input: { fecha: string; numero?: number; linea: string; destino?: string },
): Resultado<Pesaje> {
  const fecha = input.fecha.trim();
  if (!fechaValida(fecha)) return { ok: false, error: "Indica una fecha válida." };
  if (input.linea !== "1" && input.linea !== "2") {
    return { ok: false, error: "Elige la línea 1 o la línea 2." };
  }
  const destino = (input.destino ?? ALIBAL_1K.destino).trim();
  const receta = recetaVigente(db, input.linea, destino);
  if (!receta) {
    return { ok: false, error: `Carga primero la receta de ${destino} para la línea ${input.linea}.` };
  }
  const enCurso = pesajeEnCurso(db, destino);
  if (enCurso) {
    return {
      ok: false,
      error: `Termina el pesaje ${enCurso.numero} antes de abrir otro.`,
    };
  }
  const numero = input.numero ?? siguienteNumero(db, fecha, destino);
  if (!Number.isInteger(numero) || numero < 1 || numero > 99) {
    return { ok: false, error: "El número de pesaje tiene que estar entre 1 y 99." };
  }

  const existente = db
    .prepare(
      "SELECT * FROM pesajes WHERE fecha = ? AND destino = ? AND linea = ? AND numero = ?",
    )
    .get(fecha, destino, input.linea, numero) as Record<string, unknown> | undefined;
  if (existente) return { ok: true, value: filaPesaje(existente) };

  const insertado = db
    .prepare("INSERT INTO pesajes (numero, fecha, destino, linea, receta_id) VALUES (?, ?, ?, ?, ?)")
    .run(numero, fecha, destino, input.linea, receta.id);
  const pesaje = db.prepare("SELECT * FROM pesajes WHERE id = ?").get(Number(insertado.lastInsertRowid)) as
    | Record<string, unknown>
    | undefined;
  if (!pesaje) return { ok: false, error: "No se pudo abrir el pesaje." };
  return { ok: true, value: filaPesaje(pesaje) };
}

export function buscarPesaje(db: SqliteDb, id: number) {
  const fila = db.prepare("SELECT * FROM pesajes WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return fila ? filaPesaje(fila) : null;
}

export function listarPesajes(db: SqliteDb, destino: string = ALIBAL_1K.destino, limite = 20) {
  const filas = db
    .prepare("SELECT * FROM pesajes WHERE destino = ? ORDER BY fecha DESC, numero DESC LIMIT ?")
    .all(destino, limite) as Record<string, unknown>[];
  return filas.map(filaPesaje);
}

/** Código corto del pesaje: número, línea y los dos últimos caracteres del mini lote de cada MPC. */
export function codigoDePesaje(
  pesaje: { numero: number; linea: string },
  partes: { tipo: string; token: string }[],
) {
  const vistos = new Set<string>();
  const tramos: string[] = [];
  for (const parte of partes) {
    const tipo = parte.tipo.trim().toUpperCase();
    const token = parte.token.trim().toUpperCase();
    if (!tipo || !token) continue;
    const clave = `${tipo}\0${token}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    tramos.push(`${tipo}${sufijoDeMiniLote(token)}`);
  }
  if (tramos.length === 0) return "";
  return `${pesaje.numero}L${pesaje.linea}-${tramos.join("-")}`;
}

export function codigoDelPesaje(db: SqliteDb, pesajeId: number) {
  const pesaje = buscarPesaje(db, pesajeId);
  if (!pesaje) return "";
  const orden = itemsDePesaje(db, pesaje).map((item) => item.tipo);
  const minis = listarMiniLotes(db, pesajeId);
  const ordenados = [...minis].sort((a, b) => {
    const ia = orden.indexOf(a.tipo);
    const ib = orden.indexOf(b.tipo);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  return codigoDePesaje(
    pesaje,
    ordenados.map((mini) => ({ tipo: mini.tipo, token: mini.token })),
  );
}

export function planillaDeProducto(db: SqliteDb, destino: string) {
  prepararCierres(db);
  const pesajes = db
    .prepare("SELECT * FROM pesajes WHERE destino = ? ORDER BY fecha, numero")
    .all(destino) as Record<string, unknown>[];
  const deReceta = db
    .prepare(
      `SELECT ri.tipo FROM receta_items ri
       WHERE ri.receta_id IN (
         SELECT r.id FROM recetas r
         WHERE r.destino = ?
           AND r.id = (
             SELECT MAX(r2.id) FROM recetas r2
             WHERE r2.destino = r.destino AND r2.linea = r.linea
           )
       )
       ORDER BY ri.id`,
    )
    .all(destino) as { tipo: string }[];
  const tipos = [...new Set(deReceta.map((fila) => fila.tipo))].filter((tipo) => tipo.trim().toUpperCase() !== "C");
  const filas = pesajes.flatMap((fila) => {
    const pesaje = filaPesaje(fila);
    if (!pesajeTerminado(db, pesaje)) return [];
    return [{
      id: pesaje.id,
      numero: pesaje.numero,
      fecha: pesaje.fecha,
      hora: formatoHora(pesaje.registradoEn || pesaje.creadoEn),
      linea: pesaje.linea,
      destino: pesaje.destino,
      observaciones: pesaje.observaciones,
      total: sumar(db, pesaje.id),
      codigo: codigoDelPesaje(db, pesaje.id),
      celdas: tipos.map((tipo) => ({
        tipo,
        kg: sumar(db, pesaje.id, tipo),
        aportes: aportesDelTipo(db, pesaje.id, tipo),
      })),
    }];
  });
  return { tipos, filas };
}

export function itemsDePesaje(db: SqliteDb, pesaje: Pesaje): ItemReceta[] {
  const filas = db
    .prepare("SELECT tipo, kg, tolerancia_kg, minimo_kg, maximo_kg FROM receta_items WHERE receta_id = ? ORDER BY id")
    .all(pesaje.recetaId) as {
    tipo: string;
    kg: number;
    tolerancia_kg: number | null;
    minimo_kg: number | null;
    maximo_kg: number | null;
  }[];
  return filas.map((fila) => ({
    tipo: fila.tipo,
    kg: Number(fila.kg),
    tolerancia: fila.tolerancia_kg == null ? undefined : Number(fila.tolerancia_kg),
    minimo: fila.minimo_kg == null ? undefined : Number(fila.minimo_kg),
    maximo: fila.maximo_kg == null ? undefined : Number(fila.maximo_kg),
  }));
}

function limitesDeReceta(db: SqliteDb, recetaId: number) {
  const fila = db.prepare("SELECT tolerancia_kg, minimo_kg, maximo_kg FROM recetas WHERE id = ?").get(recetaId) as
    | { tolerancia_kg: number; minimo_kg: number | null; maximo_kg: number | null }
    | undefined;
  if (!fila) return undefined;
  return {
    tolerancia: Number(fila.tolerancia_kg),
    minimo: fila.minimo_kg == null ? undefined : Number(fila.minimo_kg),
    maximo: fila.maximo_kg == null ? undefined : Number(fila.maximo_kg),
  };
}

function sumar(db: SqliteDb, pesajeId: number, tipo?: string) {
  const fila = tipo
    ? (db
        .prepare("SELECT COALESCE(SUM(kg), 0) AS kg FROM minilotes WHERE pesaje_id = ? AND tipo = ?")
        .get(pesajeId, tipo) as { kg: number })
    : (db.prepare("SELECT COALESCE(SUM(kg), 0) AS kg FROM minilotes WHERE pesaje_id = ?").get(pesajeId) as {
        kg: number;
      });
  return Math.round(Number(fila.kg) * 1000) / 1000;
}

export function faltantesDeReceta(db: SqliteDb, items: ItemReceta[]) {
  const existencias = existenciasDeTipos(
    db,
    items.map((item) => item.tipo),
  );
  const disponible = new Map<string, number>();
  for (const item of existencias) {
    disponible.set(item.tipo, Math.round(((disponible.get(item.tipo) ?? 0) + item.kg) * 1000) / 1000);
  }
  return items.flatMap((item) => {
    const hay = disponible.get(item.tipo) ?? 0;
    if (hay + 0.001 >= item.kg) return [];
    return [{ tipo: item.tipo, pedido: item.kg, disponible: hay }];
  });
}

export function existenciasDeTipos(db: SqliteDb, tipos: string[]) {
  const unicos = [...new Set(tipos.map((tipo) => tipo.trim()).filter(Boolean))];
  if (unicos.length === 0) return [];
  const marcas = unicos.map(() => "?").join(", ");
  const filas = db
    .prepare(
      `SELECT l.tag AS tag, p.tipo AS tipo,
              ROUND(l.kg_recibidos - l.kg_despachados - l.kg_consumidos, 3) AS resto
       FROM lotes l
       JOIN productos p ON p.codigo = l.codigo
       WHERE p.tipo IN (${marcas})
         AND l.estado != 'LOGISTICA'
         AND l.kg_recibidos - l.kg_despachados - l.kg_consumidos > 0.001
       ORDER BY p.tipo, l.tag`,
    )
    .all(...unicos) as { tag: string; tipo: string; resto: number }[];
  return filas.map((fila) => ({ tag: fila.tag, tipo: fila.tipo, kg: Number(fila.resto) }));
}

export function aportesDelTipo(db: SqliteDb, pesajeId: number, tipo: string) {
  const filas = db
    .prepare(
      "SELECT tag, token, kg FROM minilotes WHERE pesaje_id = ? AND tipo = ? ORDER BY creado_en, token",
    )
    .all(pesajeId, tipo) as { tag: string; token: string; kg: number }[];
  return filas.map((fila) => ({ tag: fila.tag, token: fila.token, kg: Number(fila.kg) }));
}

export function tagsDelTipo(db: SqliteDb, pesajeId: number, tipo: string) {
  const filas = db
    .prepare(
      "SELECT DISTINCT tag FROM minilotes WHERE pesaje_id = ? AND tipo = ? ORDER BY creado_en, token",
    )
    .all(pesajeId, tipo) as { tag: string }[];
  return filas.map((fila) => fila.tag);
}

export function finalizarPesaje(db: SqliteDb, pesajeId: number): Resultado<{ codigo: string }> {
  prepararCierres(db);
  const pesaje = buscarPesaje(db, pesajeId);
  if (!pesaje) return { ok: false, error: "Ese pesaje no existe." };
  const progreso = progresoPesaje(db, pesaje);
  const faltan = progreso.lineas.filter((linea) => linea.usado + 0.001 < linea.minimo);
  if (faltan.length > 0) {
    const detalle = faltan
      .map((linea) => `${linea.tipo} entre ${formatoKg(linea.minimo)} y ${formatoKg(linea.maximo)}`)
      .join(", ");
    return { ok: false, error: `Todavía falta llegar al rango de la fórmula: ${detalle}.` };
  }
  if (progreso.total + 0.001 < progreso.minimo || progreso.total > progreso.maximo + 0.001) {
    return {
      ok: false,
      error: `El pesaje de Alibal tiene que quedar entre ${formatoKg(progreso.minimo)} y ${formatoKg(progreso.maximo)}. Llevan ${formatoKg(progreso.total)}.`,
    };
  }
  if (!pesaje.finalizado) {
    db.prepare("UPDATE pesajes SET finalizado = 1, registrado_en = ? WHERE id = ?").run(new Date().toISOString(), pesaje.id);
  }
  const codigo = codigoDelPesaje(db, pesaje.id);
  if (!codigo) return { ok: false, error: "No se pudo armar el código del pesaje." };
  return { ok: true, value: { codigo } };
}

export function consumirEnPesaje(
  db: SqliteDb,
  input: { pesajeId: number; tag: string; kg: number; nota?: string },
): Resultado<{ token: string }> {
  const pesaje = buscarPesaje(db, input.pesajeId);
  if (!pesaje) return { ok: false, error: "Ese pesaje no existe." };
  if (pesaje.finalizado) return { ok: false, error: "Este pesaje ya fue finalizado." };
  const items = itemsDePesaje(db, pesaje);
  const meta = metaLinea(pesaje.linea, items, limitesDeReceta(db, pesaje.recetaId));
  const loteTipo = (() => {
    const lote = db.prepare("SELECT codigo FROM lotes WHERE tag = ?").get(input.tag.trim()) as
      | { codigo: string }
      | undefined;
    if (!lote) return null;
    return productoPorCodigo(lote.codigo)?.tipo ?? null;
  })();
  if (!loteTipo) return { ok: false, error: "No existe ese TAG en la cava." };
  const partida = meta.items.find((item) => item.tipo === loteTipo);
  if (!partida) {
    return {
      ok: false,
      error: `El ${loteTipo} no está en la receta de Alibal 1 kg. Solo se puede usar ${meta.items.map((item) => item.tipo).join(", ")}.`,
    };
  }

  const kg = Math.round(input.kg * 1000) / 1000;
  if (!Number.isFinite(kg) || kg <= 0) {
    return { ok: false, error: "Los kilos consumidos tienen que ser mayores que 0." };
  }
  const usadoTipo = sumar(db, pesaje.id, loteTipo);
  const usadoTotal = sumar(db, pesaje.id);
  const proyectadoTipo = Math.round((usadoTipo + kg) * 1000) / 1000;
  const proyectadoTotal = Math.round((usadoTotal + kg) * 1000) / 1000;
  const topeTipo = partida.maximo;
  const topeTotal = meta.maximo;
  if (proyectadoTotal > topeTotal + 0.001) {
    return {
      ok: false,
      error: `El pesaje de Alibal admite hasta ${formatoKg(topeTotal)}. Ya van ${formatoKg(usadoTotal)} y esta salida lo dejaría en ${formatoKg(proyectadoTotal)}.`,
    };
  }
  if (proyectadoTipo > topeTipo + 0.001) {
    return {
      ok: false,
      error: `${loteTipo} opera de ${formatoKg(partida.minimo)} a ${formatoKg(topeTipo)}. Ya van ${formatoKg(usadoTipo)} y esta salida lo dejaría en ${formatoKg(proyectadoTipo)}.`,
    };
  }

  const resultado = registrarDespacho(db, {
    tag: input.tag,
    fecha: pesaje.fecha,
    kg,
    nota: input.nota,
    destino: pesaje.destino,
    linea: pesaje.linea,
    minilote: { pesajeId: pesaje.id, tipo: loteTipo },
  });
  if (!resultado.ok) return resultado;
  if (!resultado.value.token) return { ok: false, error: "No se pudo crear el token del consumo." };
  return { ok: true, value: { token: resultado.value.token } };
}

export function quitarKgDePesaje(db: SqliteDb, input: { pesajeId: number; token: string }): Resultado<{ tag: string }> {
  const pesaje = buscarPesaje(db, input.pesajeId);
  if (!pesaje) return { ok: false, error: "Ese pesaje no existe." };
  if (pesaje.finalizado) return { ok: false, error: "Este pesaje ya fue finalizado. No se pueden quitar kilos." };
  const token = normalizarToken(input.token);
  const mini = db.prepare("SELECT * FROM minilotes WHERE token = ?").get(token) as Record<string, unknown> | undefined;
  if (!mini || Number(mini.pesaje_id) !== pesaje.id) {
    return { ok: false, error: "Ese retiro no pertenece a este pesaje." };
  }
  const tag = String(mini.tag);
  const kg = Number(mini.kg);
  const lote = db.prepare("SELECT kg_despachados FROM lotes WHERE tag = ?").get(tag) as
    | { kg_despachados: number }
    | undefined;
  if (!lote) return { ok: false, error: "No existe el TAG de ese retiro." };
  const despachados = Math.max(0, Math.round((Number(lote.kg_despachados) - kg) * 1000) / 1000);
  const movimiento = db
    .prepare(
      `SELECT id FROM movimientos
       WHERE tag = ? AND tipo = 'despacho' AND destino = ? AND linea = ? AND ABS(kg - ?) < 0.001
       ORDER BY id DESC LIMIT 1`,
    )
    .get(tag, String(mini.destino), String(mini.linea), kg) as { id: number } | undefined;

  db.exec("BEGIN");
  try {
    db.prepare("UPDATE lotes SET kg_despachados = ? WHERE tag = ?").run(despachados, tag);
    if (movimiento) db.prepare("DELETE FROM movimientos WHERE id = ?").run(movimiento.id);
    db.prepare("DELETE FROM minilotes WHERE token = ?").run(token);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ok: true, value: { tag } };
}

export function guardarObservacionPesaje(db: SqliteDb, pesajeId: number, observacion: string): Resultado<Pesaje> {
  const pesaje = buscarPesaje(db, pesajeId);
  if (!pesaje) return { ok: false, error: "Ese pesaje no existe." };
  const texto = observacion.trim();
  if (texto.length > 500) return { ok: false, error: "La observación no puede pasar de 500 caracteres." };
  db.prepare("UPDATE pesajes SET observaciones = ? WHERE id = ?").run(texto, pesaje.id);
  const actualizado = buscarPesaje(db, pesaje.id);
  if (!actualizado) return { ok: false, error: "No se pudo guardar la observación." };
  return { ok: true, value: actualizado };
}

export function fichaQrPesaje(db: SqliteDb, pesajeId: number) {
  const pesaje = buscarPesaje(db, pesajeId);
  if (!pesaje) return null;
  const retiros = listarMiniLotes(db, pesaje.id);
  if (retiros.length === 0) return null;
  return {
    id: pesaje.id,
    numero: pesaje.numero,
    fecha: pesaje.fecha,
    linea: pesaje.linea,
    destino: pesaje.destino,
    codigo: codigoDelPesaje(db, pesaje.id),
    observaciones: pesaje.observaciones,
    total: Math.round(retiros.reduce((suma, retiro) => suma + retiro.kg, 0) * 1000) / 1000,
    retiros: retiros.map((retiro) => ({
      tipo: retiro.tipo,
      kg: retiro.kg,
      token: retiro.token,
      tag: retiro.tag,
    })),
  };
}

export function listarPesajesTodos(db: SqliteDb) {
  const filas = db
    .prepare("SELECT * FROM pesajes ORDER BY fecha DESC, numero DESC")
    .all() as Record<string, unknown>[];
  return filas.map(filaPesaje);
}

export function listarMiniLotesTodos(db: SqliteDb): MiniLote[] {
  const filas = db
    .prepare(
      `SELECT m.*, p.numero AS numero
       FROM minilotes m
       JOIN pesajes p ON p.id = m.pesaje_id
       ORDER BY m.creado_en DESC, m.token DESC`,
    )
    .all() as Record<string, unknown>[];
  return filas.map((fila) => ({
    token: String(fila.token),
    tag: String(fila.tag),
    pesajeId: Number(fila.pesaje_id),
    tipo: String(fila.tipo),
    kg: Number(fila.kg),
    destino: String(fila.destino),
    linea: String(fila.linea),
    numeroPesaje: Number(fila.numero),
  }));
}

export function listarMiniLotes(db: SqliteDb, pesajeId: number): MiniLote[] {
  const pesaje = buscarPesaje(db, pesajeId);
  if (!pesaje) return [];
  const filas = db
    .prepare("SELECT * FROM minilotes WHERE pesaje_id = ? ORDER BY creado_en, token")
    .all(pesajeId) as Record<string, unknown>[];
  return filas.map((fila) => ({
    token: String(fila.token),
    tag: String(fila.tag),
    pesajeId: Number(fila.pesaje_id),
    tipo: String(fila.tipo),
    kg: Number(fila.kg),
    destino: String(fila.destino),
    linea: String(fila.linea),
    numeroPesaje: pesaje.numero,
  }));
}

export function retirosDeTag(db: SqliteDb, tag: string): RetiroEnQr[] {
  const filas = db
    .prepare(
      `SELECT m.token, m.kg, m.tipo, m.linea, m.destino, p.numero AS numero
       FROM minilotes m
       JOIN pesajes p ON p.id = m.pesaje_id
       WHERE m.tag = ?
       ORDER BY m.creado_en, m.token`,
    )
    .all(tag.trim()) as Record<string, unknown>[];
  return filas.map((fila) => ({
    token: String(fila.token),
    kg: Number(fila.kg),
    tipo: String(fila.tipo),
    pesaje: Number(fila.numero),
    linea: String(fila.linea),
    destino: String(fila.destino),
  }));
}

export function buscarPesajePorCodigo(db: SqliteDb, codigo: string) {
  const buscado = codigo.trim().toUpperCase().replace(/\s+/g, "");
  if (!buscado) return null;
  const filas = db.prepare("SELECT * FROM pesajes").all() as Record<string, unknown>[];
  for (const fila of filas) {
    const pesaje = filaPesaje(fila);
    if (codigoDelPesaje(db, pesaje.id) === buscado) return pesaje;
  }
  return null;
}

export function buscarMiniLote(db: SqliteDb, token: string): MiniLote | null {
  const fila = db.prepare("SELECT * FROM minilotes WHERE token = ?").get(normalizarToken(token)) as
    | Record<string, unknown>
    | undefined;
  if (!fila) return null;
  const pesaje = buscarPesaje(db, Number(fila.pesaje_id));
  if (!pesaje) return null;
  return {
    token: String(fila.token),
    tag: String(fila.tag),
    pesajeId: Number(fila.pesaje_id),
    tipo: String(fila.tipo),
    kg: Number(fila.kg),
    destino: String(fila.destino),
    linea: String(fila.linea),
    numeroPesaje: pesaje.numero,
  };
}

export function progresoPesaje(db: SqliteDb, pesaje: Pesaje) {
  const items = itemsDePesaje(db, pesaje);
  const meta = metaLinea(pesaje.linea, items, limitesDeReceta(db, pesaje.recetaId));
  const lineas = meta.items.map((item) => ({
    tipo: item.tipo,
    objetivo: item.kg,
    tolerancia: item.tolerancia,
    minimo: item.minimo,
    maximo: item.maximo,
    usado: sumar(db, pesaje.id, item.tipo),
  }));
  const total = sumar(db, pesaje.id);
  return { ...meta, lineas, total };
}
