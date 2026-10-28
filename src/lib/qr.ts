import { renderSVG } from "uqr";
import type { Lote } from "./lotes";
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
  };
}

export function textoQr(lote: Lote) {
  const p = payloadQr(lote);
  return [
    "PUROLOMO MPC",
    `TAG:${p.tag}`,
    `Fecha:${p.fecha}`,
    `${p.semana}`,
    `Producto:${p.producto}`,
    `Tipo:${p.tipo}`,
    `Codigo:${p.codigo}`,
    `Kg rec:${p.kgRecibidos}`,
    `Kg desp:${p.kgDespachados}`,
    `Kg cons:${p.kgConsumidos}`,
    `Estado:${p.estado}`,
  ].join("\n");
}

export function svgQr(lote: Lote, pixelSize = 4) {
  return renderSVG(textoQr(lote), {
    border: 2,
    ecc: "M",
    pixelSize,
    blackColor: "#071422",
    whiteColor: "#ffffff",
  });
}
