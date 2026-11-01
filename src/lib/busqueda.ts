import type { SqliteDb } from "./db";
import { listarLotes } from "./lotes";
import { codigoDelPesaje, listarMiniLotesTodos, listarPesajesTodos } from "./pesajes";
import type { Sugerencia } from "./sugerencia";

export type { Sugerencia };

export function sugerenciasGlobales(db: SqliteDb): Sugerencia[] {
  const lotes = listarLotes(db, { limite: 300 }).map((lote) => ({
    id: `tag-${lote.tag}`,
    titulo: lote.tag,
    detalle: `${lote.producto} · ${lote.codigo}`,
    href: `/lote/${lote.tag}`,
  }));
  const minis = listarMiniLotesTodos(db).map((mini) => ({
    id: `mini-${mini.token}`,
    titulo: mini.token,
    detalle: `${mini.tipo} · ${mini.kg} kg · TAG ${mini.tag}`,
    href: `/minilotes?codigo=${encodeURIComponent(mini.token)}`,
  }));
  const pesajes = listarPesajesTodos(db).map((pesaje) => {
    const codigo = codigoDelPesaje(db, pesaje.id);
    return {
      id: `pesaje-${pesaje.id}`,
      titulo: codigo || `Pesaje ${pesaje.numero}`,
      detalle: `Pesaje ${pesaje.numero} · ${pesaje.fecha} · línea ${pesaje.linea}`,
      href: `/consulta-pesaje?codigo=${encodeURIComponent(codigo)}`,
    };
  });
  return [...lotes, ...minis, ...pesajes];
}
