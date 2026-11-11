import { etiquetaDeLote, type EtiquetaCava } from "./etiqueta-cava";
import type { Lote } from "./lotes";

/** ZPL de una etiqueta de 10,4 cm × 5,1 cm a 203 dpi, con el texto a la izquierda y el QR a la derecha. */
export function zplDeEtiqueta(etiqueta: EtiquetaCava, textoDelQr: string) {
  const detalle = partir(etiqueta.descripcion);
  const lineas = [
    { texto: etiqueta.tag, y: 16, alto: 52, ancho: 44 },
    { texto: etiqueta.producto, y: 78, alto: 30, ancho: 26 },
    ...detalle.map((texto, indice) => ({ texto, y: 116 + indice * 30, alto: 26, ancho: 22 })),
    { texto: etiqueta.codigo, y: 186, alto: 32, ancho: 28 },
    { texto: etiqueta.kgRecibidos, y: 226, alto: 32, ancho: 28 },
    { texto: etiqueta.fecha, y: 266, alto: 28, ancho: 24 },
    { texto: etiqueta.hora, y: 302, alto: 28, ancho: 24 },
  ];
  const textos = lineas
    .map((linea) => `^FO24,${linea.y}^A0N,${linea.alto},${linea.ancho}^FD${campo(linea.texto)}^FS`)
    .join("\n");
  return [
    "^XA",
    "^CI28",
    "^PW831",
    "^LL406",
    textos,
    `^FO500,28^BQN,2,5^FH\\^FDLA,${campoQr(textoDelQr)}^FS`,
    "^XZ",
  ].join("\n");
}

export function zplDeLotes(lotes: { lote: Lote; qr: string }[]) {
  return lotes.map((item) => zplDeEtiqueta(etiquetaDeLote(item.lote), item.qr)).join("\n");
}

function partir(texto: string) {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  if (palabras.length <= 1) return palabras;
  const corte = Math.ceil(palabras.length / 2);
  return [palabras.slice(0, corte).join(" "), palabras.slice(corte).join(" ")];
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
