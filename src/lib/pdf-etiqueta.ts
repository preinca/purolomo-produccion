import { encode } from "uqr";
import { lineasEtiqueta, type EtiquetaCava } from "./etiqueta-cava";

const PT_POR_CM = 72 / 2.54;
/** Etiqueta adhesiva: 5,7 cm de ancho por 3,2 cm de alto. */
const ANCHO = redondear(5.7 * PT_POR_CM);
const ALTO = redondear(3.2 * PT_POR_CM);

/** PDF de una etiqueta de cava. El QR se dibuja con rectángulos para que el visor lo muestre. */
export function pdfDeEtiqueta(etiqueta: EtiquetaCava, textoDelQr: string) {
  const contenido = Buffer.from(dibujo(etiqueta, textoDelQr), "latin1");
  const objetos = [
    objeto(1, "<< /Type /Catalog /Pages 2 0 R >>"),
    objeto(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    objeto(
      3,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    ),
    objetoStream(4, "", contenido),
    objeto(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
    objeto(6, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"),
  ];
  return armar(objetos);
}

function dibujo(etiqueta: EtiquetaCava, textoDelQr: string) {
  const margen = 2.2;
  const ladoQr = redondear(ALTO * 0.58);
  const xQr = redondear(ANCHO - ladoQr - 1.4);
  const yQr = redondear((ALTO - ladoQr) / 2);
  const anchoTexto = xQr - margen - 1.2;
  const lineas = lineasEtiqueta(etiqueta);
  const altoUtil = ALTO - margen * 2;
  const cuerpos = Math.max(lineas.length - 1, 1);
  const paso = altoUtil / (1.7 + cuerpos);
  const masLargaCuerpo = Math.max(...lineas.slice(1).map((linea) => linea.length), 1);
  const masLargaTag = Math.max(lineas[0]?.length ?? 1, 1);
  const tamCuerpo = Math.max(5, Math.min(paso * 0.92, anchoTexto / (masLargaCuerpo * 0.56)));
  const tamTag = Math.max(tamCuerpo, Math.min(paso * 1.55, anchoTexto / (masLargaTag * 0.52), tamCuerpo * 1.7));
  const comandos = ["0 0 0 rg", ...modulosQr(textoDelQr, xQr, yQr, ladoQr)];

  let tope = ALTO - margen;
  lineas.forEach((linea, indice) => {
    const tam = indice === 0 ? tamTag : tamCuerpo;
    comandos.push(texto("F2", redondear(tam), margen, redondear(tope - tam * 0.78), linea));
    tope -= indice === 0 ? tam * 1.05 : paso;
  });
  return comandos.join("\n");
}

function redondear(valor: number) {
  return Math.round(valor * 100) / 100;
}

function modulosQr(textoDelQr: string, x: number, y: number, tamano: number) {
  const qr = encode(textoDelQr, { ecc: "M", border: 2 });
  const celda = tamano / qr.size;
  const comandos = ["0 0 0 rg"];
  for (let fila = 0; fila < qr.size; fila++) {
    let inicio = -1;
    const cerrar = (hasta: number) => {
      if (inicio < 0) return;
      const px = x + inicio * celda;
      const py = y + tamano - (fila + 1) * celda;
      const ancho = (hasta - inicio) * celda;
      comandos.push(`${px.toFixed(2)} ${py.toFixed(2)} ${ancho.toFixed(2)} ${celda.toFixed(2)} re f`);
      inicio = -1;
    };
    for (let columna = 0; columna < qr.size; columna++) {
      if (qr.data[fila]?.[columna]) {
        if (inicio < 0) inicio = columna;
      } else {
        cerrar(columna);
      }
    }
    cerrar(qr.size);
  }
  return comandos;
}

function texto(fuente: "F1" | "F2", tamano: number, x: number, y: number, valor: string) {
  return `BT /${fuente} ${tamano} Tf 1 0 0 1 ${x} ${y} Tm (${pdfTexto(valor)}) Tj ET`;
}

function pdfTexto(valor: string) {
  const win: Record<string, string> = {
    á: "\\341",
    é: "\\351",
    í: "\\355",
    ó: "\\363",
    ú: "\\372",
    ñ: "\\361",
    Á: "\\301",
    É: "\\311",
    Í: "\\315",
    Ó: "\\323",
    Ú: "\\332",
    Ñ: "\\321",
    ü: "\\374",
    Ü: "\\334",
  };
  let salida = "";
  for (const caracter of valor) {
    if (win[caracter]) salida += win[caracter];
    else if (caracter === "\\") salida += "\\\\";
    else if (caracter === "(" || caracter === ")") salida += `\\${caracter}`;
    else if (caracter.charCodeAt(0) >= 32 && caracter.charCodeAt(0) <= 126) salida += caracter;
    else salida += " ";
  }
  return salida;
}

function objeto(numero: number, cuerpo: string) {
  return Buffer.from(`${numero} 0 obj\n${cuerpo}\nendobj\n`);
}

function objetoStream(numero: number, diccionario: string, datos: Buffer) {
  const extra = diccionario ? ` ${diccionario}` : "";
  const cabeza = Buffer.from(`${numero} 0 obj\n<<${extra} /Length ${datos.length} >>\nstream\n`);
  return Buffer.concat([cabeza, datos, Buffer.from("\nendstream\nendobj\n")]);
}

function armar(objetos: Buffer[]) {
  const partes: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const offsets = [0];
  let cursor = partes[0].length;
  for (const objetoPdf of objetos) {
    offsets.push(cursor);
    partes.push(objetoPdf);
    cursor += objetoPdf.length;
  }
  let xref = `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  partes.push(
    Buffer.from(`${xref}trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF`),
  );
  return Buffer.concat(partes);
}

/** El PDF de la etiqueta escribe el TAG como texto, por ejemplo "(TAG 400123)". */
export function tagDePdfEtiqueta(datos: Uint8Array) {
  const texto = new TextDecoder("latin1").decode(datos);
  return texto.match(/\(TAG (\d{4,8})\)/)?.[1] ?? null;
}
