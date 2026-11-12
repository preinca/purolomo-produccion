import { etiquetaDeLote, lineasEtiqueta, type EtiquetaCava } from "./etiqueta-cava";
import type { Lote } from "./lotes";

const ANCHO = 456;
const ALTO = 256;
const MARGEN = 24;
const QR_X = 286;
const QR_Y = 42;

/** ZPL de una etiqueta de 5,7 cm × 3,2 cm a 203 dpi. El texto queda a la izquierda y el QR, más pequeño, a la derecha. */
export function zplDeEtiqueta(etiqueta: EtiquetaCava, textoDelQr: string) {
  const lineas = lineasEtiqueta(etiqueta);
  const columna = QR_X - 18;
  const usable = ALTO - MARGEN * 2;
  const unidades = 1.7 + Math.max(lineas.length - 1, 1);
  const paso = Math.floor(usable / unidades);
  const altoCuerpo = Math.max(paso - 1, 12);
  const altoTag = Math.max(altoCuerpo + 12, Math.round(paso * 1.7) - 1);
  const cuerpos = lineas.slice(1);
  const masLarga = Math.max(...cuerpos.map((linea) => linea.length), lineas[0]?.length ?? 1, 1);
  const anchoCuerpo = Math.max(10, Math.min(altoCuerpo, Math.floor(columna / masLarga)));
  const anchoTag = Math.max(anchoCuerpo + 4, Math.min(altoTag, Math.floor(columna / Math.max(lineas[0]?.length ?? 1, 1))));
  let y = MARGEN;
  const textos = lineas
    .map((linea, indice) => {
      const alto = indice === 0 ? altoTag : altoCuerpo;
      const ancho = indice === 0 ? anchoTag : anchoCuerpo;
      const comando = `^FO8,${y}^A0N,${alto},${ancho}^FD${campo(linea)}^FS`;
      y += indice === 0 ? alto + 3 : paso;
      return comando;
    })
    .join("\n");
  return [
    "^XA",
    "^CI28",
    `^PW${ANCHO}`,
    `^LL${ALTO}`,
    textos,
    `^FO${QR_X},${QR_Y}^BQN,2,3^FH\\^FDLA,${campoQr(textoDelQr)}^FS`,
    "^XZ",
  ].join("\n");
}

export function zplDeLotes(lotes: { lote: Lote; qr: string }[]) {
  return lotes.map((item) => zplDeEtiqueta(etiquetaDeLote(item.lote), item.qr)).join("\n");
}

function campo(valor: string) {
  return valor.replace(/[\^~\\]/g, " ").replace(/[\r\n]/g, " ");
}

function campoQr(valor: string) {
  return valor
    .replace(/_/g, "_5F")
    .replace(/\^/g, "_5E")
    .replace(/~/g, "_7E")
    .replace(/\\/g, "_5C")
    .replace(/\n/g, "_0A");
}
