import { encode } from "uqr";
import { etiquetaDeLote, lineasEtiqueta, type EtiquetaCava } from "./etiqueta-cava";
import type { Lote } from "./lotes";

const ANCHO = 456;
const ALTO = 256;
const MARGEN = 24;
const QR_X = 286;

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
    qrZpl(textoDelQr, QR_X, ALTO),
    "^XZ",
  ].join("\n");
}

export function zplDeLotes(lotes: { lote: Lote; qr: string }[]) {
  return lotes.map((item) => zplDeEtiqueta(etiquetaDeLote(item.lote), item.qr)).join("\n");
}

function campo(valor: string) {
  return valor.replace(/[\^~\\]/g, " ").replace(/[\r\n]/g, " ");
}

/**
 * El ancho llena la columna derecha, como la etiqueta grande.
 * El alto de cada módulo es mayor que el ancho: el QR crece solo hacia arriba y abajo.
 */
function qrZpl(texto: string, x: number, altoEtiqueta: number) {
  const qr = encode(texto, { ecc: "H", border: 2 });
  const anchoDisponible = ANCHO - x - 2;
  const altoDisponible = altoEtiqueta - 8;
  const celdaAncho = Math.max(3, Math.floor(anchoDisponible / qr.size));
  const celdaAlto = Math.max(celdaAncho + 1, Math.floor((celdaAncho * 6) / 5));
  const alto = qr.size * Math.min(celdaAlto, Math.floor(altoDisponible / qr.size));
  const celdaAltoFinal = Math.max(celdaAncho, Math.round(alto / qr.size));
  const y = Math.max(4, Math.round((altoEtiqueta - qr.size * celdaAltoFinal) / 2));
  const comandos: string[] = [];
  for (let fila = 0; fila < qr.size; fila += 1) {
    let inicio = -1;
    const cerrar = (hasta: number) => {
      if (inicio < 0) return;
      const px = x + inicio * celdaAncho;
      const py = y + fila * celdaAltoFinal;
      const ancho = (hasta - inicio) * celdaAncho;
      comandos.push(`^FO${px},${py}^GB${ancho},${celdaAltoFinal},${celdaAltoFinal + 1}^FS`);
      inicio = -1;
    };
    for (let columna = 0; columna < qr.size; columna += 1) {
      if (qr.data[fila]?.[columna]) {
        if (inicio < 0) inicio = columna;
      } else {
        cerrar(columna);
      }
    }
    cerrar(qr.size);
  }
  return comandos.join("\n");
}
