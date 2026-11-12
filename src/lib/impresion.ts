import type { Db } from "./db";
import type { Resultado, Lote } from "./lotes";
import { productoPorCodigo } from "./mpc";
import { textoQrDeEtiqueta } from "./qr";
import { zplDeLotes } from "./zpl-etiqueta";

export async function contarEtiquetas(db: Db, modo: "pendiente" | "cola") {
  const filtro = modo === "pendiente" ? "impresa_en = ''" : "impresa_en LIKE 'cola:%'";
  const fila = await db.get<{ n: number }>(`SELECT COUNT(*)::int AS n FROM lotes WHERE ${filtro}`);
  return Number(fila?.n ?? 0);
}

export async function encolarEtiquetasDelProceso(db: Db, procesoId: number): Promise<Resultado<number>> {
  if (!Number.isInteger(procesoId) || procesoId <= 0) {
    return { ok: false, error: "El proceso de recepción no es válido." };
  }
  return db.transaction(async (tx) => {
    const filas = await tx.all<{ tag: string }>(
      "SELECT tag FROM lotes WHERE proceso_id = ? AND impresa_en = '' ORDER BY creado_en, tag FOR UPDATE",
      procesoId,
    );
    if (filas.length === 0) return { ok: false, error: "Ese proceso no tiene etiquetas pendientes de imprimir." };
    const creada = await tx.get<{ id: number }>("INSERT INTO impresiones (estado) VALUES ('pendiente') RETURNING id");
    const id = Number(creada?.id);
    for (let indice = 0; indice < filas.length; indice += 1) {
      await tx.run(
        "INSERT INTO impresion_items (impresion_id, tag, orden) VALUES (?, ?, ?)",
        id,
        filas[indice].tag,
        indice,
      );
      await tx.run("UPDATE lotes SET impresa_en = ? WHERE tag = ?", `cola:${id}`, filas[indice].tag);
    }
    return { ok: true, value: filas.length };
  });
}

export async function tomarImpresion(db: Db): Promise<{ id: number; zpl: string } | null> {
  const ahora = new Date().toISOString();
  const vencida = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  return db.transaction(async (tx) => {
    await tx.run(
      "UPDATE impresiones SET estado = 'pendiente', tomada_en = '' WHERE estado = 'imprimiendo' AND tomada_en <> '' AND tomada_en < ?",
      vencida,
    );
    const trabajo = await tx.get<{ id: number }>(
      "SELECT id FROM impresiones WHERE estado = 'pendiente' ORDER BY id LIMIT 1 FOR UPDATE",
    );
    if (!trabajo) return null;
    const id = Number(trabajo.id);
    await tx.run("UPDATE impresiones SET estado = 'imprimiendo', tomada_en = ? WHERE id = ?", ahora, id);
    const items = await tx.all<{ tag: string }>(
      "SELECT tag FROM impresion_items WHERE impresion_id = ? ORDER BY orden",
      id,
    );
    const lotes: Lote[] = [];
    for (const item of items) {
      const fila = await tx.get<Record<string, unknown>>("SELECT * FROM lotes WHERE tag = ?", item.tag);
      if (fila) lotes.push(leerLote(fila));
    }
    return { id, zpl: zplDeLotes(lotes.map((lote) => ({ lote, qr: textoQrDeEtiqueta(lote.tag) }))) };
  });
}

export async function cerrarImpresion(db: Db, id: number, impresa: boolean) {
  const ahora = new Date().toISOString();
  await db.transaction(async (tx) => {
    if (!impresa) {
      await tx.run("UPDATE impresiones SET estado = 'pendiente', tomada_en = '' WHERE id = ?", id);
      return;
    }
    await tx.run("UPDATE impresiones SET estado = 'lista', lista_en = ? WHERE id = ?", ahora, id);
    await tx.run(
      "UPDATE lotes SET impresa_en = ? WHERE tag IN (SELECT tag FROM impresion_items WHERE impresion_id = ?)",
      ahora,
      id,
    );
  });
}

function leerLote(row: Record<string, unknown>): Lote {
  const codigo = String(row.codigo);
  const catalogo = productoPorCodigo(codigo);
  return {
    tag: String(row.tag),
    fecha: String(row.fecha),
    semana: String(row.semana),
    codigo: catalogo?.codigo ?? codigo,
    producto: catalogo?.nombre ?? String(row.producto),
    kgRecibidos: Number(row.kg_recibidos),
    kgDespachados: Number(row.kg_despachados),
    kgConsumidos: Number(row.kg_consumidos),
    estado: String(row.estado),
    observaciones: String(row.observaciones ?? ""),
    destino: String(row.destino ?? ""),
    creadoEn: String(row.creado_en),
  };
}
