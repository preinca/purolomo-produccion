import { renderSVG } from "uqr";
import { kgConsumidosDe, kgDisponiblesDe, tagAgotado, type Lote } from "./lotes";
import { productoPorCodigo } from "./mpc";

export type PayloadQr = {
  planta: string;
  tag: string;
  fecha: string;
  semana: string;
  producto: string;
  tipo: string;
  codigo: string;
  kgRecibidos: number;
  kgDespachados: number;
  kgConsumidos: number;
  estado: string;
  destino: string;
};

export function payloadQr(lote: Lote): PayloadQr {
  const catalogo = productoPorCodigo(lote.codigo);
  return {
    planta: "Purolomo Cagua 40602-1",
    tag: lote.tag,
    fecha: lote.fecha,
    semana: lote.semana,
    producto: lote.producto,
    tipo: catalogo ? `${catalogo.tipo} ${catalogo.descripcion}` : lote.producto,
    codigo: lote.codigo,
    kgRecibidos: lote.kgRecibidos,
    kgDespachados: lote.kgDespachados,
    kgConsumidos: lote.kgConsumidos,
    estado: lote.estado,
    destino: lote.destino,
  };
}

export type RetiroEnQr = {
  token: string;
  kg: number;
  tipo: string;
  pesaje: number;
  linea: string;
  destino: string;
};

export function textoQr(lote: Lote, retiros: RetiroEnQr[] = []) {
  const p = payloadQr(lote);
  const lineas = [
    "PUROLOMO MPC",
    `TAG:${p.tag}`,
    `Fecha:${p.fecha}`,
    `${p.semana}`,
    `Producto:${p.producto}`,
    `Tipo:${p.tipo}`,
    `Codigo:${p.codigo}`,
    `Kg rec:${p.kgRecibidos}`,
    `Kg consumidos:${kgConsumidosDe(lote)}`,
    `Kg disponibles:${kgDisponiblesDe(lote)}`,
    `Estado:${p.estado}`,
    `Uso:${p.destino}`,
  ];
  if (lote.estado === "LOGISTICA") {
    lineas.push("Aviso:Trasladado a logística. Este TAG ya no se puede consumir.");
  } else if (tagAgotado(lote)) {
    lineas.push("Aviso:Se acabaron todos los kg de esta materia prima");
  }
  if (lote.observaciones.trim()) lineas.push(`Observacion:${lote.observaciones.trim()}`);
  for (const retiro of retiros) {
    lineas.push(
      `Mini:${retiro.token} ${retiro.kg} kg ${retiro.tipo} pesaje ${retiro.pesaje} linea ${retiro.linea} para ${retiro.destino}`,
    );
  }
  return lineas.join("\n");
}

export type LecturaQr = {
  tag: string;
  producto: string;
  tipo: string;
  codigo: string;
};

/** Lee el texto que va dentro del QR de una paleta. */
export function leerTextoQr(texto: string): LecturaQr | null {
  const campos = new Map<string, string>();
  for (const linea of texto.split(/\r?\n/)) {
    const sep = linea.indexOf(":");
    if (sep <= 0) continue;
    campos.set(linea.slice(0, sep).trim().toLowerCase(), linea.slice(sep + 1).trim());
  }
  const tag = campos.get("tag") ?? "";
  if (!/^\d{4,8}$/.test(tag)) return null;
  return {
    tag,
    producto: campos.get("producto") ?? "",
    tipo: campos.get("tipo") ?? "",
    codigo: campos.get("codigo") ?? "",
  };
}

export function textoQrMiniLote(datos: {
  token: string;
  pesaje: number;
  destino: string;
  linea: string;
  tipo: string;
  kg: number;
  tag: string;
  tags: string[];
}) {
  return [
    "PUROLOMO CONSUMO",
    `TOKEN:${datos.token}`,
    `PESAJE:${datos.pesaje}`,
    `Producto:${datos.destino}`,
    `Linea:${datos.linea}`,
    `MPC:${datos.tipo}`,
    `Kg:${datos.kg}`,
    `TAG:${datos.tag}`,
    `TAGS:${datos.tags.join(",")}`,
  ].join("\n");
}

export function leerConsumoQr(texto: string) {
  const token = texto.match(/TOKEN:\s*(ML\d{6})/i)?.[1]?.toUpperCase();
  if (!token) return null;
  return { token };
}

export function textoQrPesaje(datos: {
  id: number;
  numero: number;
  fecha: string;
  linea: string;
  destino: string;
  codigo: string;
  total: number;
  observaciones?: string;
  retiros: { tipo: string; kg: number; token: string; tag: string }[];
}) {
  const lineas = [
    "PUROLOMO PESAJE",
    `ID:${datos.id}`,
    `Numero:${datos.numero}`,
    `Fecha:${datos.fecha}`,
    `Linea:${datos.linea}`,
    `Uso:${datos.destino}`,
    `Codigo:${datos.codigo || "—"}`,
    `Total:${datos.total}`,
  ];
  if (datos.observaciones?.trim()) lineas.push(`Observacion:${datos.observaciones.trim()}`);
  for (const retiro of datos.retiros) {
    lineas.push(`Retiro:${retiro.tipo} ${retiro.kg} kg ${retiro.token} paleta ${retiro.tag}`);
  }
  return lineas.join("\n");
}

export function svgDeTexto(texto: string, pixelSize = 3) {
  return renderSVG(texto, {
    border: 2,
    ecc: "M",
    pixelSize,
    blackColor: "#071422",
    whiteColor: "#ffffff",
  });
}

export function svgQr(lote: Lote, pixelSize = 4, retiros: RetiroEnQr[] = []) {
  return svgDeTexto(textoQr(lote, retiros), pixelSize);
}
