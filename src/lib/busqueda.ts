import type { Db } from "./db";
import { listarLotes } from "./lotes";
import { codigosDePesajes, listarMiniLotesTodos, listarPesajesTodos } from "./pesajes";
import type { Sugerencia } from "./sugerencia";

export type { Sugerencia };

export async function sugerenciasGlobales(db: Db): Promise<Sugerencia[]> {
  const [lotesDb, minisDb, pesajesDb] = await Promise.all([
    listarLotes(db, { limite: 300 }),
    listarMiniLotesTodos(db),
    listarPesajesTodos(db),
  ]);
  const codigos = await codigosDePesajes(db, pesajesDb);
  const lotes = lotesDb.map((lote) => ({
    id: `tag-${lote.tag}`,
    titulo: lote.tag,
    detalle: `${lote.producto} · ${lote.codigo}`,
    href: `/lote/${lote.tag}`,
  }));
  const minis = minisDb.map((mini) => ({
    id: `mini-${mini.token}`,
    titulo: mini.token,
    detalle: `${mini.tipo} · ${mini.kg} kg · TAG ${mini.tag}`,
    href: `/minilotes?codigo=${encodeURIComponent(mini.token)}`,
  }));
  const pesajes = pesajesDb.map((pesaje) => {
    const codigo = codigos.get(pesaje.id) ?? "";
    return {
      id: `pesaje-${pesaje.id}`,
      titulo: codigo || `Pesaje ${pesaje.numero}`,
      detalle: `Pesaje ${pesaje.numero} · ${pesaje.fecha} · línea ${pesaje.linea}`,
      href: `/consulta-pesaje?codigo=${encodeURIComponent(codigo)}`,
    };
  });
  return [...lotes, ...minis, ...pesajes];
}
