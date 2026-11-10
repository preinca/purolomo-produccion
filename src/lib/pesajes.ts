import { arregloPg } from "./arreglo-pg";
import type { Db } from "./db";
import { fechaValida, formatoHora, formatoKg } from "./formato";
import { registrarDespacho, type Resultado } from "./lotes";
import { normalizarToken, sufijoDeMiniLote } from "./minilote";
import { PRODUCTOS_MPC, productoPorCodigo } from "./mpc";
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

type Fila = Record<string, unknown>;

function filaPesaje(row: Fila): Pesaje {
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

function filaMini(fila: Fila, numeroPesaje: number): MiniLote {
  return {
    token: String(fila.token),
    tag: String(fila.tag),
    pesajeId: Number(fila.pesaje_id),
    tipo: String(fila.tipo),
    kg: Number(fila.kg),
    destino: String(fila.destino),
    linea: String(fila.linea),
    numeroPesaje,
  };
}

function redondear(valor: number) {
  return Math.round(valor * 1000) / 1000;
}

export async function pesajeTerminado(db: Db, pesaje: Pesaje) {
  return (await buscarPesaje(db, pesaje.id))?.finalizado ?? pesaje.finalizado;
}

export async function pesajeEnCurso(db: Db, destino: string = ALIBAL_1K.destino) {
  const fila = await db.get<Fila>(
    "SELECT * FROM pesajes WHERE destino = ? AND finalizado = 0 ORDER BY fecha DESC, numero DESC LIMIT 1",
    destino,
  );
  return fila ? filaPesaje(fila) : null;
}

export async function siguienteNumero(db: Db, _fecha?: string, destino: string = ALIBAL_1K.destino) {
  const fila = await db.get<{ numero: number }>(
    "SELECT COALESCE(MAX(numero), 0) AS numero FROM pesajes WHERE destino = ?",
    destino,
  );
  return Number(fila?.numero ?? 0) + 1;
}

export async function abrirPesaje(
  db: Db,
  input: { fecha: string; numero?: number; linea: string; destino?: string },
): Promise<Resultado<Pesaje>> {
  const fecha = input.fecha.trim();
  if (!fechaValida(fecha)) return { ok: false, error: "Indica una fecha válida." };
  if (input.linea !== "1" && input.linea !== "2") {
    return { ok: false, error: "Elige la línea 1 o la línea 2." };
  }
  const destino = (input.destino ?? ALIBAL_1K.destino).trim();
  const receta = await recetaVigente(db, input.linea, destino);
  if (!receta) {
    return { ok: false, error: `Carga primero la receta de ${destino} para la línea ${input.linea}.` };
  }
  const enCurso = await pesajeEnCurso(db, destino);
  if (enCurso) {
    return {
      ok: false,
      error: `Termina el pesaje ${enCurso.numero} antes de abrir otro.`,
    };
  }
  const numero = input.numero ?? (await siguienteNumero(db, fecha, destino));
  if (!Number.isInteger(numero) || numero < 1 || numero > 99) {
    return { ok: false, error: "El número de pesaje tiene que estar entre 1 y 99." };
  }

  const insertado = await db.get<Fila>(
    `INSERT INTO pesajes (numero, fecha, destino, linea, receta_id) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (fecha, destino, linea, numero) DO NOTHING
     RETURNING *`,
    numero,
    fecha,
    destino,
    input.linea,
    receta.id,
  );
  if (insertado) return { ok: true, value: filaPesaje(insertado) };

  const existente = await db.get<Fila>(
    "SELECT * FROM pesajes WHERE fecha = ? AND destino = ? AND linea = ? AND numero = ?",
    fecha,
    destino,
    input.linea,
    numero,
  );
  if (existente) return { ok: true, value: filaPesaje(existente) };
  return { ok: false, error: "No se pudo abrir el pesaje." };
}

export async function buscarPesaje(db: Db, id: number) {
  if (!Number.isInteger(id)) return null;
  const fila = await db.get<Fila>("SELECT * FROM pesajes WHERE id = ?", id);
  return fila ? filaPesaje(fila) : null;
}

export async function listarPesajes(db: Db, destino: string = ALIBAL_1K.destino, limite = 20) {
  const filas = await db.all<Fila>(
    "SELECT * FROM pesajes WHERE destino = ? ORDER BY fecha DESC, numero DESC LIMIT ?",
    destino,
    limite,
  );
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

type FilaMiniCorta = { pesaje_id: number; tipo: string; token: string; tag: string; kg: number };

/** Mini lotes de varios pesajes en una sola consulta, en el orden en que se registraron. */
async function minisDePesajes(db: Db, ids: number[]) {
  const porPesaje = new Map<number, FilaMiniCorta[]>();
  if (ids.length === 0) return porPesaje;
  const filas = await db.all<FilaMiniCorta>(
    `SELECT pesaje_id, tipo, token, tag, kg FROM minilotes
     WHERE pesaje_id = ANY(?::int[])
     ORDER BY creado_en, token`,
    arregloPg(ids),
  );
  for (const fila of filas) {
    const id = Number(fila.pesaje_id);
    porPesaje.set(id, [...(porPesaje.get(id) ?? []), { ...fila, kg: Number(fila.kg) }]);
  }
  return porPesaje;
}

/** Orden de los tipos de MPC en la receta de cada pesaje, en una sola consulta. */
async function ordenDeRecetas(db: Db, recetaIds: number[]) {
  const porReceta = new Map<number, string[]>();
  const unicos = [...new Set(recetaIds)];
  if (unicos.length === 0) return porReceta;
  const filas = await db.all<{ receta_id: number; tipo: string }>(
    "SELECT receta_id, tipo FROM receta_items WHERE receta_id = ANY(?::int[]) ORDER BY id",
    arregloPg(unicos),
  );
  for (const fila of filas) {
    const id = Number(fila.receta_id);
    porReceta.set(id, [...(porReceta.get(id) ?? []), fila.tipo]);
  }
  return porReceta;
}

function codigoConDatos(pesaje: Pesaje, orden: string[], minis: FilaMiniCorta[]) {
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

/** Códigos de varios pesajes con tres consultas en total, sin importar cuántos pesajes sean. */
export async function codigosDePesajes(db: Db, pesajes: Pesaje[]) {
  const [orden, minis] = await Promise.all([
    ordenDeRecetas(
      db,
      pesajes.map((pesaje) => pesaje.recetaId),
    ),
    minisDePesajes(
      db,
      pesajes.map((pesaje) => pesaje.id),
    ),
  ]);
  return new Map(
    pesajes.map((pesaje) => [
      pesaje.id,
      codigoConDatos(pesaje, orden.get(pesaje.recetaId) ?? [], minis.get(pesaje.id) ?? []),
    ]),
  );
}

export async function codigoDelPesaje(db: Db, pesajeId: number) {
  const pesaje = await buscarPesaje(db, pesajeId);
  if (!pesaje) return "";
  return (await codigosDePesajes(db, [pesaje])).get(pesaje.id) ?? "";
}

export async function planillaDeProducto(db: Db, destino: string) {
  const [filasPesajes, deReceta] = await Promise.all([
    db.all<Fila>("SELECT * FROM pesajes WHERE destino = ? AND finalizado = 1 ORDER BY fecha, numero", destino),
    db.all<{ tipo: string }>(
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
      destino,
    ),
  ]);
  const tipos = [...new Set(deReceta.map((fila) => fila.tipo))].filter((tipo) => tipo.trim().toUpperCase() !== "C");
  const pesajes = filasPesajes.map(filaPesaje);
  const [orden, minis] = await Promise.all([
    ordenDeRecetas(
      db,
      pesajes.map((pesaje) => pesaje.recetaId),
    ),
    minisDePesajes(
      db,
      pesajes.map((pesaje) => pesaje.id),
    ),
  ]);
  const filas = pesajes.map((pesaje) => {
    const propios = minis.get(pesaje.id) ?? [];
    return {
      id: pesaje.id,
      numero: pesaje.numero,
      fecha: pesaje.fecha,
      hora: formatoHora(pesaje.registradoEn || pesaje.creadoEn),
      linea: pesaje.linea,
      destino: pesaje.destino,
      observaciones: pesaje.observaciones,
      total: redondear(propios.reduce((suma, mini) => suma + mini.kg, 0)),
      codigo: codigoConDatos(pesaje, orden.get(pesaje.recetaId) ?? [], propios),
      celdas: tipos.map((tipo) => {
        const delTipo = propios.filter((mini) => mini.tipo === tipo);
        return {
          tipo,
          kg: redondear(delTipo.reduce((suma, mini) => suma + mini.kg, 0)),
          aportes: delTipo.map((mini) => ({ tag: mini.tag, token: mini.token, kg: mini.kg })),
        };
      }),
    };
  });
  return { tipos, filas };
}

export async function itemsDePesaje(db: Db, pesaje: Pesaje): Promise<ItemReceta[]> {
  const filas = await db.all<{
    tipo: string;
    kg: number;
    tolerancia_kg: number | null;
    minimo_kg: number | null;
    maximo_kg: number | null;
  }>("SELECT tipo, kg, tolerancia_kg, minimo_kg, maximo_kg FROM receta_items WHERE receta_id = ? ORDER BY id", pesaje.recetaId);
  return filas.map((fila) => ({
    tipo: fila.tipo,
    kg: Number(fila.kg),
    tolerancia: fila.tolerancia_kg == null ? undefined : Number(fila.tolerancia_kg),
    minimo: fila.minimo_kg == null ? undefined : Number(fila.minimo_kg),
    maximo: fila.maximo_kg == null ? undefined : Number(fila.maximo_kg),
  }));
}

async function limitesDeReceta(db: Db, recetaId: number) {
  const fila = await db.get<{ tolerancia_kg: number; minimo_kg: number | null; maximo_kg: number | null }>(
    "SELECT tolerancia_kg, minimo_kg, maximo_kg FROM recetas WHERE id = ?",
    recetaId,
  );
  if (!fila) return undefined;
  return {
    tolerancia: Number(fila.tolerancia_kg),
    minimo: fila.minimo_kg == null ? undefined : Number(fila.minimo_kg),
    maximo: fila.maximo_kg == null ? undefined : Number(fila.maximo_kg),
  };
}

/** Kilos usados en el pesaje: el total y por tipo de MPC, en una sola consulta. */
async function sumasDePesaje(db: Db, pesajeId: number) {
  const filas = await db.all<{ tipo: string; kg: number }>(
    "SELECT tipo, COALESCE(SUM(kg), 0) AS kg FROM minilotes WHERE pesaje_id = ? GROUP BY tipo",
    pesajeId,
  );
  const porTipo = new Map(filas.map((fila) => [fila.tipo, redondear(Number(fila.kg))]));
  const total = redondear(filas.reduce((suma, fila) => suma + Number(fila.kg), 0));
  return { total, tipo: (tipo: string) => porTipo.get(tipo) ?? 0 };
}

export async function faltantesDeReceta(db: Db, items: ItemReceta[]) {
  const existencias = await existenciasDeTipos(
    db,
    items.map((item) => item.tipo),
  );
  const disponible = new Map<string, number>();
  for (const item of existencias) {
    disponible.set(item.tipo, redondear((disponible.get(item.tipo) ?? 0) + item.kg));
  }
  return items.flatMap((item) => {
    const hay = disponible.get(item.tipo) ?? 0;
    if (hay + 0.001 >= item.kg) return [];
    return [{ tipo: item.tipo, pedido: item.kg, disponible: hay }];
  });
}

export async function existenciasDeTipos(db: Db, tipos: string[]) {
  const unicos = new Set(tipos.map((tipo) => tipo.trim()).filter(Boolean));
  const codigos = PRODUCTOS_MPC.filter((producto) => unicos.has(producto.tipo)).map((producto) => producto.codigo);
  if (codigos.length === 0) return [];
  const filas = await db.all<{ tag: string; codigo: string; resto: number }>(
    `SELECT tag, codigo, ROUND((kg_recibidos - kg_despachados - kg_consumidos)::numeric, 3) AS resto
     FROM lotes
     WHERE codigo = ANY(?::text[])
       AND estado <> 'LOGISTICA'
       AND kg_recibidos - kg_despachados - kg_consumidos > 0.001`,
    arregloPg(codigos),
  );
  return filas
    .map((fila) => ({ tag: fila.tag, tipo: productoPorCodigo(fila.codigo)?.tipo ?? "", kg: Number(fila.resto) }))
    .sort((a, b) => (a.tipo === b.tipo ? (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0) : a.tipo < b.tipo ? -1 : 1));
}

export async function aportesDelTipo(db: Db, pesajeId: number, tipo: string) {
  const filas = await db.all<{ tag: string; token: string; kg: number }>(
    "SELECT tag, token, kg FROM minilotes WHERE pesaje_id = ? AND tipo = ? ORDER BY creado_en, token",
    pesajeId,
    tipo,
  );
  return filas.map((fila) => ({ tag: fila.tag, token: fila.token, kg: Number(fila.kg) }));
}

export async function tagsDelTipo(db: Db, pesajeId: number, tipo: string) {
  const filas = await db.all<{ tag: string }>(
    `SELECT tag FROM minilotes WHERE pesaje_id = ? AND tipo = ?
     GROUP BY tag ORDER BY MIN(creado_en), MIN(token)`,
    pesajeId,
    tipo,
  );
  return filas.map((fila) => fila.tag);
}

export async function finalizarPesaje(db: Db, pesajeId: number): Promise<Resultado<{ codigo: string }>> {
  const pesaje = await buscarPesaje(db, pesajeId);
  if (!pesaje) return { ok: false, error: "Ese pesaje no existe." };
  const progreso = await progresoPesaje(db, pesaje);
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
    await db.run(
      "UPDATE pesajes SET finalizado = 1, registrado_en = ? WHERE id = ? AND finalizado = 0",
      new Date().toISOString(),
      pesaje.id,
    );
  }
  const codigo = (await codigosDePesajes(db, [pesaje])).get(pesaje.id) ?? "";
  if (!codigo) return { ok: false, error: "No se pudo armar el código del pesaje." };
  return { ok: true, value: { codigo } };
}

export async function consumirEnPesaje(
  db: Db,
  input: { pesajeId: number; tag: string; kg: number; nota?: string },
): Promise<Resultado<{ token: string }>> {
  const pesaje = await buscarPesaje(db, input.pesajeId);
  if (!pesaje) return { ok: false, error: "Ese pesaje no existe." };
  if (pesaje.finalizado) return { ok: false, error: "Este pesaje ya fue finalizado." };
  const [items, limites, lote] = await Promise.all([
    itemsDePesaje(db, pesaje),
    limitesDeReceta(db, pesaje.recetaId),
    db.get<{ codigo: string }>("SELECT codigo FROM lotes WHERE tag = ?", input.tag.trim()),
  ]);
  const meta = metaLinea(pesaje.linea, items, limites);
  const loteTipo = lote ? (productoPorCodigo(lote.codigo)?.tipo ?? null) : null;
  if (!loteTipo) return { ok: false, error: "No existe ese TAG en la cava." };
  const partida = meta.items.find((item) => item.tipo === loteTipo);
  if (!partida) {
    return {
      ok: false,
      error: `El ${loteTipo} no está en la receta de Alibal 1 kg. Solo se puede usar ${meta.items.map((item) => item.tipo).join(", ")}.`,
    };
  }

  const kg = redondear(input.kg);
  if (!Number.isFinite(kg) || kg <= 0) {
    return { ok: false, error: "Los kilos consumidos tienen que ser mayores que 0." };
  }
  const sumas = await sumasDePesaje(db, pesaje.id);
  const usadoTipo = sumas.tipo(loteTipo);
  const usadoTotal = sumas.total;
  const proyectadoTipo = redondear(usadoTipo + kg);
  const proyectadoTotal = redondear(usadoTotal + kg);
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

  const resultado = await registrarDespacho(db, {
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

export async function quitarKgDePesaje(
  db: Db,
  input: { pesajeId: number; token: string },
): Promise<Resultado<{ tag: string }>> {
  const pesaje = await buscarPesaje(db, input.pesajeId);
  if (!pesaje) return { ok: false, error: "Ese pesaje no existe." };
  if (pesaje.finalizado) return { ok: false, error: "Este pesaje ya fue finalizado. No se pueden quitar kilos." };
  const token = normalizarToken(input.token);

  return db.transaction(async (tx): Promise<Resultado<{ tag: string }>> => {
    const mini = await tx.get<Fila>("SELECT * FROM minilotes WHERE token = ? FOR UPDATE", token);
    if (!mini || Number(mini.pesaje_id) !== pesaje.id) {
      return { ok: false, error: "Ese retiro no pertenece a este pesaje." };
    }
    const tag = String(mini.tag);
    const kg = Number(mini.kg);
    const lote = await tx.get<{ kg_despachados: number }>(
      "SELECT kg_despachados FROM lotes WHERE tag = ? FOR UPDATE",
      tag,
    );
    if (!lote) return { ok: false, error: "No existe el TAG de ese retiro." };
    const despachados = Math.max(0, redondear(Number(lote.kg_despachados) - kg));
    const movimiento = await tx.get<{ id: number }>(
      `SELECT id FROM movimientos
       WHERE tag = ? AND tipo = 'despacho' AND destino = ? AND linea = ? AND ABS(kg - ?::double precision) < 0.001
       ORDER BY id DESC LIMIT 1`,
      tag,
      String(mini.destino),
      String(mini.linea),
      kg,
    );
    await tx.run("UPDATE lotes SET kg_despachados = ? WHERE tag = ?", despachados, tag);
    if (movimiento) await tx.run("DELETE FROM movimientos WHERE id = ?", movimiento.id);
    await tx.run("DELETE FROM minilotes WHERE token = ?", token);
    return { ok: true, value: { tag } };
  });
}

export async function guardarObservacionPesaje(db: Db, pesajeId: number, observacion: string): Promise<Resultado<Pesaje>> {
  const pesaje = await buscarPesaje(db, pesajeId);
  if (!pesaje) return { ok: false, error: "Ese pesaje no existe." };
  const texto = observacion.trim();
  if (texto.length > 500) return { ok: false, error: "La observación no puede pasar de 500 caracteres." };
  await db.run("UPDATE pesajes SET observaciones = ? WHERE id = ?", texto, pesaje.id);
  const actualizado = await buscarPesaje(db, pesaje.id);
  if (!actualizado) return { ok: false, error: "No se pudo guardar la observación." };
  return { ok: true, value: actualizado };
}

export async function fichaQrPesaje(db: Db, pesajeId: number) {
  const pesaje = await buscarPesaje(db, pesajeId);
  if (!pesaje) return null;
  const retiros = await listarMiniLotes(db, pesaje.id);
  if (retiros.length === 0) return null;
  const codigo = (await codigosDePesajes(db, [pesaje])).get(pesaje.id) ?? "";
  return {
    id: pesaje.id,
    numero: pesaje.numero,
    fecha: pesaje.fecha,
    linea: pesaje.linea,
    destino: pesaje.destino,
    codigo,
    observaciones: pesaje.observaciones,
    total: redondear(retiros.reduce((suma, retiro) => suma + retiro.kg, 0)),
    retiros: retiros.map((retiro) => ({
      tipo: retiro.tipo,
      kg: retiro.kg,
      token: retiro.token,
      tag: retiro.tag,
    })),
  };
}

export async function listarPesajesTodos(db: Db) {
  const filas = await db.all<Fila>("SELECT * FROM pesajes ORDER BY fecha DESC, numero DESC");
  return filas.map(filaPesaje);
}

export async function listarMiniLotesTodos(db: Db): Promise<MiniLote[]> {
  const filas = await db.all<Fila>(
    `SELECT m.*, p.numero AS numero
     FROM minilotes m
     JOIN pesajes p ON p.id = m.pesaje_id
     ORDER BY m.creado_en DESC, m.token DESC`,
  );
  return filas.map((fila) => filaMini(fila, Number(fila.numero)));
}

export async function listarMiniLotes(db: Db, pesajeId: number): Promise<MiniLote[]> {
  const filas = await db.all<Fila>(
    `SELECT m.*, p.numero AS numero
     FROM minilotes m
     JOIN pesajes p ON p.id = m.pesaje_id
     WHERE m.pesaje_id = ?
     ORDER BY m.creado_en, m.token`,
    pesajeId,
  );
  return filas.map((fila) => filaMini(fila, Number(fila.numero)));
}

export async function retirosDeTag(db: Db, tag: string): Promise<RetiroEnQr[]> {
  const filas = await db.all<Fila>(
    `SELECT m.token, m.kg, m.tipo, m.linea, m.destino, p.numero AS numero
     FROM minilotes m
     JOIN pesajes p ON p.id = m.pesaje_id
     WHERE m.tag = ?
     ORDER BY m.creado_en, m.token`,
    tag.trim(),
  );
  return filas.map((fila) => ({
    token: String(fila.token),
    kg: Number(fila.kg),
    tipo: String(fila.tipo),
    pesaje: Number(fila.numero),
    linea: String(fila.linea),
    destino: String(fila.destino),
  }));
}

export async function buscarPesajePorCodigo(db: Db, codigo: string) {
  const buscado = codigo.trim().toUpperCase().replace(/\s+/g, "");
  if (!buscado) return null;
  // El código empieza por "<número>L<línea>-": solo hace falta mirar esos pesajes.
  const prefijo = buscado.match(/^(\d+)L(\d)-/);
  const pesajes = prefijo
    ? (await db.all<Fila>("SELECT * FROM pesajes WHERE numero = ? AND linea = ?", Number(prefijo[1]), prefijo[2])).map(
        filaPesaje,
      )
    : await listarPesajesTodos(db);
  const codigos = await codigosDePesajes(db, pesajes);
  return pesajes.find((pesaje) => codigos.get(pesaje.id) === buscado) ?? null;
}

export async function buscarMiniLote(db: Db, token: string): Promise<MiniLote | null> {
  const fila = await db.get<Fila>(
    `SELECT m.*, p.numero AS numero
     FROM minilotes m
     JOIN pesajes p ON p.id = m.pesaje_id
     WHERE m.token = ?`,
    normalizarToken(token),
  );
  return fila ? filaMini(fila, Number(fila.numero)) : null;
}

export async function progresoPesaje(db: Db, pesaje: Pesaje) {
  const [items, limites, sumas] = await Promise.all([
    itemsDePesaje(db, pesaje),
    limitesDeReceta(db, pesaje.recetaId),
    sumasDePesaje(db, pesaje.id),
  ]);
  const meta = metaLinea(pesaje.linea, items, limites);
  const lineas = meta.items.map((item) => ({
    tipo: item.tipo,
    objetivo: item.kg,
    tolerancia: item.tolerancia,
    minimo: item.minimo,
    maximo: item.maximo,
    usado: sumas.tipo(item.tipo),
  }));
  return { ...meta, lineas, total: sumas.total };
}

type FilaItem = {
  receta_id: number;
  tipo: string;
  kg: number;
  tolerancia_kg: number | null;
  minimo_kg: number | null;
  maximo_kg: number | null;
};

/** Progreso de varios pesajes con tres consultas en total. */
export async function progresosDePesajes(db: Db, pesajes: Pesaje[]) {
  const recetaIds = [...new Set(pesajes.map((pesaje) => pesaje.recetaId))];
  const [filasItems, filasLimites, minis] = await Promise.all([
    recetaIds.length
      ? db.all<FilaItem>(
          `SELECT receta_id, tipo, kg, tolerancia_kg, minimo_kg, maximo_kg
           FROM receta_items WHERE receta_id = ANY(?::int[]) ORDER BY id`,
          arregloPg(recetaIds),
        )
      : Promise.resolve([] as FilaItem[]),
    recetaIds.length
      ? db.all<{ id: number; tolerancia_kg: number; minimo_kg: number | null; maximo_kg: number | null }>(
          "SELECT id, tolerancia_kg, minimo_kg, maximo_kg FROM recetas WHERE id = ANY(?::int[])",
          arregloPg(recetaIds),
        )
      : Promise.resolve([]),
    minisDePesajes(
      db,
      pesajes.map((pesaje) => pesaje.id),
    ),
  ]);
  const itemsPorReceta = new Map<number, ItemReceta[]>();
  for (const fila of filasItems) {
    const id = Number(fila.receta_id);
    itemsPorReceta.set(id, [
      ...(itemsPorReceta.get(id) ?? []),
      {
        tipo: fila.tipo,
        kg: Number(fila.kg),
        tolerancia: fila.tolerancia_kg == null ? undefined : Number(fila.tolerancia_kg),
        minimo: fila.minimo_kg == null ? undefined : Number(fila.minimo_kg),
        maximo: fila.maximo_kg == null ? undefined : Number(fila.maximo_kg),
      },
    ]);
  }
  const limitesPorReceta = new Map(
    filasLimites.map((fila) => [
      Number(fila.id),
      {
        tolerancia: Number(fila.tolerancia_kg),
        minimo: fila.minimo_kg == null ? undefined : Number(fila.minimo_kg),
        maximo: fila.maximo_kg == null ? undefined : Number(fila.maximo_kg),
      },
    ]),
  );
  return new Map(
    pesajes.map((pesaje) => {
      const propios = minis.get(pesaje.id) ?? [];
      const usado = (tipo: string) =>
        redondear(propios.filter((mini) => mini.tipo === tipo).reduce((suma, mini) => suma + mini.kg, 0));
      const meta = metaLinea(pesaje.linea, itemsPorReceta.get(pesaje.recetaId) ?? [], limitesPorReceta.get(pesaje.recetaId));
      const lineas = meta.items.map((item) => ({
        tipo: item.tipo,
        objetivo: item.kg,
        tolerancia: item.tolerancia,
        minimo: item.minimo,
        maximo: item.maximo,
        usado: usado(item.tipo),
      }));
      const total = redondear(propios.reduce((suma, mini) => suma + mini.kg, 0));
      return [pesaje.id, { ...meta, lineas, total }];
    }),
  );
}

/** Retiros (mini lotes) de varios TAG en una sola consulta. */
export async function retirosDeTags(db: Db, tags: string[]) {
  const porTag = new Map<string, RetiroEnQr[]>();
  const unicos = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  if (unicos.length === 0) return porTag;
  const filas = await db.all<Fila>(
    `SELECT m.tag, m.token, m.kg, m.tipo, m.linea, m.destino, p.numero AS numero
     FROM minilotes m
     JOIN pesajes p ON p.id = m.pesaje_id
     WHERE m.tag = ANY(?::text[])
     ORDER BY m.creado_en, m.token`,
    arregloPg(unicos),
  );
  for (const fila of filas) {
    const tag = String(fila.tag);
    porTag.set(tag, [
      ...(porTag.get(tag) ?? []),
      {
        token: String(fila.token),
        kg: Number(fila.kg),
        tipo: String(fila.tipo),
        pesaje: Number(fila.numero),
        linea: String(fila.linea),
        destino: String(fila.destino),
      },
    ]);
  }
  return porTag;
}

/** Fichas QR de todos los pesajes que ya tienen retiros, con tres consultas en total. */
export async function fichasQrPesajes(db: Db) {
  const pesajes = await listarPesajesTodos(db);
  const [orden, minis] = await Promise.all([
    ordenDeRecetas(
      db,
      pesajes.map((pesaje) => pesaje.recetaId),
    ),
    minisDePesajes(
      db,
      pesajes.map((pesaje) => pesaje.id),
    ),
  ]);
  return pesajes.flatMap((pesaje) => {
    const retiros = minis.get(pesaje.id) ?? [];
    if (retiros.length === 0) return [];
    return [
      {
        id: pesaje.id,
        numero: pesaje.numero,
        fecha: pesaje.fecha,
        linea: pesaje.linea,
        destino: pesaje.destino,
        codigo: codigoConDatos(pesaje, orden.get(pesaje.recetaId) ?? [], retiros),
        observaciones: pesaje.observaciones,
        total: redondear(retiros.reduce((suma, retiro) => suma + retiro.kg, 0)),
        retiros: retiros.map((retiro) => ({
          tipo: retiro.tipo,
          kg: retiro.kg,
          token: retiro.token,
          tag: retiro.tag,
        })),
      },
    ];
  });
}
