import { etiquetaDeLote, lineasEtiqueta, type EtiquetaCava } from "./etiqueta-cava";
import type { Lote } from "./lotes";

const ANCHO = 456;
const ALTO = 256;
const QR_LADO = 244;
const QR_X = ANCHO - 4 - QR_LADO;
const QR_Y = Math.round((ALTO - QR_LADO) / 2);

/** ZPL de una etiqueta de 5,7 cm × 3,2 cm a 203 dpi. El texto queda a la izquierda y el QR a la derecha. */
export function zplDeEtiqueta(etiqueta: EtiquetaCava, textoDelQr: string) {
  const lineas = lineasEtiqueta(etiqueta);
  const columna = QR_X - 14;
  const paso = Math.floor((ALTO - 4) / lineas.length);
  const alto = Math.max(paso - 1, 12);
  const masLarga = Math.max(...lineas.map((linea) => linea.length), 1);
  const ancho = Math.max(10, Math.min(alto, Math.floor(columna / masLarga)));
  const textos = lineas
    .map((linea, indice) => `^FO6,${2 + indice * paso}^A0N,${alto},${ancho}^FD${campo(linea)}^FS`)
    .join("\n");
  return [
    "^XA",
    "^CI28",
    `^PW${ANCHO}`,
    `^LL${ALTO}`,
    textos,
    `^FO${QR_X},${QR_Y}^BQN,2,4^FH\\^FDLA,${campoQr(textoDelQr)}^FS`,
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
