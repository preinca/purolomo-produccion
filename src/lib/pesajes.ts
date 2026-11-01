import type { SqliteDb } from "./db";
import { fechaValida } from "./formato";
import { registrarDespacho, type Resultado } from "./lotes";
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
  };
}

export function abrirPesaje(
  db: SqliteDb,
  input: { fecha: string; numero: number; linea: string; destino?: string },
): Resultado<Pesaje> {
  const fecha = input.fecha.trim();
  if (!fechaValida(fecha)) return { ok: false, error: "Indica una fecha válida." };
  if (!Number.isInteger(input.numero) || input.numero < 1 || input.numero > 99) {
    return { ok: false, error: "El número de pesaje tiene que estar entre 1 y 99." };
  }
  if (input.linea !== "1" && input.linea !== "2") {
    return { ok: false, error: "Elige la línea 1 o la línea 2." };
  }
  const destino = (input.destino ?? ALIBAL_1K.destino).trim();
  const receta = recetaVigente(db, input.linea, destino);
  if (!receta) {
    return { ok: false, error: `Carga primero la receta de ${destino} para la línea ${input.linea}.` };
  }

  const existente = db
    .prepare(
      "SELECT * FROM pesajes WHERE fecha = ? AND destino = ? AND linea = ? AND numero = ?",
    )
    .get(fecha, destino, input.linea, input.numero) as Record<string, unknown> | undefined;
  if (existente) return { ok: true, value: filaPesaje(existente) };

  const insertado = db
    .prepare("INSERT INTO pesajes (numero, fecha, destino, linea, receta_id) VALUES (?, ?, ?, ?, ?)")
    .run(input.numero, fecha, destino, input.linea, receta.id);
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

export function listarPesajes(db: SqliteDb, destino = ALIBAL_1K.destino, limite = 20) {
  const filas = db
    .prepare("SELECT * FROM pesajes WHERE destino = ? ORDER BY fecha DESC, numero DESC LIMIT ?")
    .all(destino, limite) as Record<string, unknown>[];
  return filas.map(filaPesaje);
}

/** Código del pesaje: sigla y mini lote de cada materia prima, y al final el peso total. */
export function codigoDePesaje(partes: { tipo: string; token: string }[], totalKg: number) {
  const vistos = new Set<string>();
  const tramos: string[] = [];
  for (const parte of partes) {
    const tipo = parte.tipo.trim().toUpperCase();
    const token = parte.token.trim().toUpperCase();
    if (!tipo || !token) continue;
    const clave = `${tipo}\0${token}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    tramos.push(`${tipo}${token}`);
  }
  if (tramos.length === 0) return "";
  const total = Math.round(totalKg * 1000) / 1000;
  const texto = Number.isInteger(total) ? String(total) : String(total);
  return `${tramos.join("-")}-${texto}`;
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
    ordenados.map((mini) => ({ tipo: mini.tipo, token: mini.token })),
    sumar(db, pesajeId),
  );
}

export function planillaDeProducto(db: SqliteDb, destino: string) {
  const pesajes = db
    .prepare("SELECT * FROM pesajes WHERE destino = ? ORDER BY fecha, numero")
    .all(destino) as Record<string, unknown>[];
  const deReceta = db
    .prepare(
      `SELECT ri.tipo FROM receta_items ri
       JOIN recetas r ON r.id = ri.receta_id
       WHERE r.destino = ?
       ORDER BY ri.id`,
    )
    .all(destino) as { tipo: string }[];
  const usados = db
    .prepare(
      `SELECT DISTINCT m.tipo AS tipo FROM minilotes m
       JOIN pesajes p ON p.id = m.pesaje_id
       WHERE p.destino = ?
       ORDER BY m.tipo`,
    )
    .all(destino) as { tipo: string }[];
  const tipos = [...new Set([...deReceta.map((fila) => fila.tipo), ...usados.map((fila) => fila.tipo)])];
  const filas = pesajes.map((fila) => {
    const pesaje = filaPesaje(fila);
    return {
      id: pesaje.id,
      numero: pesaje.numero,
      fecha: pesaje.fecha,
      linea: pesaje.linea,
      total: sumar(db, pesaje.id),
      codigo: codigoDelPesaje(db, pesaje.id),
      celdas: tipos.map((tipo) => ({
        tipo,
        kg: sumar(db, pesaje.id, tipo),
        aportes: aportesDelTipo(db, pesaje.id, tipo),
      })),
    };
  });
  return { tipos, filas };
}

export function itemsDePesaje(db: SqliteDb, pesaje: Pesaje): ItemReceta[] {
  const filas = db
    .prepare("SELECT tipo, kg FROM receta_items WHERE receta_id = ? ORDER BY id")
    .all(pesaje.recetaId) as { tipo: string; kg: number }[];
  return filas.map((fila) => ({ tipo: fila.tipo, kg: Number(fila.kg) }));
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

export function consumirEnPesaje(
  db: SqliteDb,
  input: { pesajeId: number; tag: string; kg: number; nota?: string },
): Resultado<{ token: string }> {
  const pesaje = buscarPesaje(db, input.pesajeId);
  if (!pesaje) return { ok: false, error: "Ese pesaje no existe." };
  const items = itemsDePesaje(db, pesaje);
  const meta = metaLinea(pesaje.linea, items);
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
  const topeTipo = Math.round((partida.kg + meta.tolerancia) * 1000) / 1000;
  const topeTotal = meta.objetivo + meta.tolerancia;
  if (proyectadoTotal > topeTotal + 0.001) {
    return {
      ok: false,
      error: `Este pesaje admite hasta ${topeTotal} kg. Ya van ${usadoTotal} kg y esta salida lo dejaría en ${proyectadoTotal} kg.`,
    };
  }
  if (proyectadoTipo > topeTipo + 0.001) {
    return {
      ok: false,
      error: `La receta pide ${partida.kg} kg de ${loteTipo}. Ya van ${usadoTipo} kg y no se puede pasar de ${topeTipo} kg.`,
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

export function normalizarToken(valor: string) {
  const texto = valor.trim().toUpperCase().replace(/\s+/g, "");
  const numero = texto.match(/^(?:ML)?(\d+)$/);
  if (!numero) return texto;
  return `ML${numero[1].padStart(6, "0")}`;
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
  const meta = metaLinea(pesaje.linea, items);
  const lineas = meta.items.map((item) => ({
    tipo: item.tipo,
    objetivo: item.kg,
    usado: sumar(db, pesaje.id, item.tipo),
  }));
  const total = sumar(db, pesaje.id);
  return { ...meta, lineas, total };
}
