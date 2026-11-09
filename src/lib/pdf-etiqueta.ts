import { encode } from "uqr";
import { pieEtiqueta, type EtiquetaCava } from "./etiqueta-cava";

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
  const margen = 1.5;
  const pie = pieEtiqueta(etiqueta.fecha);
  const tamPie = Math.min(6.4, (ANCHO - margen * 2) / Math.max(1, pie.length * 0.58));
  const pieAlto = tamPie + 2.2;
  const altoCuerpo = ALTO - margen - pieAlto;
  const ladoQr = altoCuerpo;
  const xQr = margen;
  const yQr = pieAlto;
  const xTexto = xQr + ladoQr + 1.6;
  const anchoTexto = ANCHO - xTexto - margen;
  const detalle = [etiqueta.descripcion, etiqueta.tipo].filter(Boolean).join(" - ");
  const pedidos = [
    { valor: etiqueta.tag, peso: 1.7, maxLineas: 1 },
    { valor: etiqueta.producto, peso: 1.2, maxLineas: 2 },
    { valor: detalle, peso: 1.05, maxLineas: 2 },
    { valor: etiqueta.codigo, peso: 1.25, maxLineas: 1 },
    { valor: etiqueta.kgRecibidos, peso: 1.2, maxLineas: 1 },
    { valor: etiqueta.fecha, peso: 1.05, maxLineas: 1 },
    { valor: etiqueta.hora, peso: 1.05, maxLineas: 1 },
  ].filter((pedido) => pedido.valor.trim());
  const bloques = medir(pedidos, anchoTexto, altoCuerpo);
  const comandos = ["0.3 w", "0 0 0 RG", "0 0 0 rg", `${margen} ${pieAlto} m ${ANCHO - margen} ${pieAlto} l S`];
  comandos.push(...modulosQr(textoDelQr, xQr, yQr, ladoQr));

  let tope = ALTO - margen;
  for (const bloque of bloques) {
    for (const linea of bloque.lineas) {
      const baseline = tope - bloque.tam * 0.76;
      if (baseline < yQr) break;
      comandos.push(texto("F2", bloque.tam, xTexto, baseline, linea));
      tope = baseline - bloque.tam * 0.18;
    }
    tope -= bloque.tam * 0.12;
  }

  const anchoPie = pie.length * tamPie * 0.56;
  comandos.push(texto("F2", tamPie, Math.max(margen, (ANCHO - anchoPie) / 2), 1.5, pie));
  return comandos.join("\n");
}

function medir(
  pedidos: { valor: string; peso: number; maxLineas: number }[],
  ancho: number,
  altoDisponible: number,
) {
  let bajo = 4;
  let alto = 20;
  let elegido = bajo;
  for (let paso = 0; paso < 18; paso += 1) {
    const medio = (bajo + alto) / 2;
    const prueba = armarBloques(pedidos, ancho, medio);
    if (prueba.alto <= altoDisponible) {
      elegido = medio;
      bajo = medio;
    } else {
      alto = medio;
    }
  }
  return armarBloques(pedidos, ancho, elegido).bloques;
}

function armarBloques(
  pedidos: { valor: string; peso: number; maxLineas: number }[],
  ancho: number,
  base: number,
) {
  const bloques = pedidos.map((pedido) => {
    const tam = redondear(Math.max(4.5, base * pedido.peso));
    const lineas = partir(pedido.valor, ancho, tam).slice(0, pedido.maxLineas);
    const alto = lineas.length * tam * 0.94 + tam * 0.12;
    return { tam, lineas, alto };
  });
  return { bloques, alto: bloques.reduce((suma, bloque) => suma + bloque.alto, 0) };
}

function partir(valor: string, ancho: number, tamano: number) {
  const textoLimpio = valor.trim();
  if (!textoLimpio) return [];
  const maximo = Math.max(6, Math.floor(ancho / (tamano * 0.6)));
  const palabras = textoLimpio.split(/\s+/);
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (candidato.length <= maximo) {
      actual = candidato;
      continue;
    }
    if (actual) lineas.push(actual);
    actual = palabra.length <= maximo ? palabra : palabra.slice(0, maximo);
  }
  if (actual) lineas.push(actual);
  return lineas.slice(0, 2);
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
