import type { Db } from "./db";
import { codigosDePesajes, type Pesaje } from "./pesajes";
import type { Sugerencia } from "./sugerencia";

export type { Sugerencia };

/** Busca unos pocos TAG, mini lotes y pesajes. No carga el historial completo. */
export async function buscarSugerencias(db: Db, consulta: string): Promise<Sugerencia[]> {
  const q = consulta.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const [lotesDb, minisDb, pesajesDb] = await Promise.all([
    db.all<{ tag: string; producto: string; codigo: string }>(
      `SELECT tag, producto, codigo FROM lotes
       WHERE tag ILIKE ? OR producto ILIKE ? OR codigo ILIKE ?
       ORDER BY creado_en DESC
       LIMIT 6`,
      like,
      like,
      like,
    ),
    db.all<{ token: string; tipo: string; kg: number; tag: string }>(
      `SELECT token, tipo, kg, tag FROM minilotes
       WHERE token ILIKE ? OR tag ILIKE ?
       ORDER BY creado_en DESC
       LIMIT 6`,
      like,
      like,
    ),
    db.all<Record<string, unknown>>(
      `SELECT * FROM pesajes
       WHERE numero::text ILIKE ? OR fecha ILIKE ?
       ORDER BY fecha DESC, numero DESC
       LIMIT 6`,
      like,
      like,
    ),
  ]);
  const pesajes: Pesaje[] = pesajesDb.map((row) => ({
    id: Number(row.id),
    numero: Number(row.numero),
    fecha: String(row.fecha),
    destino: String(row.destino ?? ""),
    linea: String(row.linea ?? ""),
    recetaId: Number(row.receta_id),
    observaciones: String(row.observaciones ?? ""),
    finalizado: Number(row.finalizado ?? 0) === 1,
    creadoEn: String(row.creado_en ?? ""),
    registradoEn: String(row.registrado_en ?? ""),
  }));
  const codigos = await codigosDePesajes(db, pesajes);
  const lotes: Sugerencia[] = lotesDb.map((lote) => ({
    id: `tag-${lote.tag}`,
    titulo: lote.tag,
    detalle: `${lote.producto} · ${lote.codigo}`,
    href: `/lote/${lote.tag}`,
  }));
  const minis: Sugerencia[] = minisDb.map((mini) => ({
    id: `mini-${mini.token}`,
    titulo: mini.token,
    detalle: `${mini.tipo} · ${mini.kg} kg · TAG ${mini.tag}`,
    href: `/minilotes?codigo=${encodeURIComponent(mini.token)}`,
  }));
  const pesajesSugeridos: Sugerencia[] = pesajes.map((pesaje) => {
    const codigo = codigos.get(pesaje.id) ?? "";
    return {
      id: `pesaje-${pesaje.id}`,
      titulo: codigo || `Pesaje ${pesaje.numero}`,
      detalle: `Pesaje ${pesaje.numero} · ${pesaje.fecha} · línea ${pesaje.linea}`,
      href: `/consulta-pesaje?codigo=${encodeURIComponent(codigo)}`,
    };
  });
  return [...lotes, ...minis, ...pesajesSugeridos];
}
