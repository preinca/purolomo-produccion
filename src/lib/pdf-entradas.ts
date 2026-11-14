import { formatoFecha, formatoKg } from "./formato";

const ANCHO = 842;
const ALTO = 595;
const MARGEN = 28;
const RENGLON = 9;

export type FilaEntradaPdf = {
  fecha: string;
  hora: string;
  tag: string;
  producto: string;
  codigo: string;
  kg: number;
  destino: string;
  observaciones: string;
};

const COLUMNAS = {
  fecha: 78,
  hora: 46,
  tag: 64,
  producto: 150,
  codigo: 78,
  kg: 58,
  destino: 100,
};

export function pdfRegistroEntradas(entrada: { fecha: string; producto: string; filas: FilaEntradaPdf[] }) {
  const bloques = paginar(entrada.filas);
  const dia = formatoFecha(entrada.fecha);
  const totalKg = Math.round(entrada.filas.reduce((suma, fila) => suma + fila.kg, 0) * 1000) / 1000;
  const contenidos = bloques.map((bloque, indice) =>
    Buffer.from(
      dibujo({
        dia,
        producto: entrada.producto,
        filas: bloque.filas,
        firmas: bloque.firmas,
        totalKg,
        pagina: indice + 1,
        paginas: bloques.length,
      }),
      "latin1",
    ),
  );
  return armar(contenidos);
}

function caracteres(ancho: number, tamano = 7) {
  return Math.max(6, Math.floor((ancho - 6) / (tamano * 0.5)));
}

function envolver(valor: string, maximo: number) {
  const textoLimpio = valor.trim();
  if (!textoLimpio) return [];
  const lineas: string[] = [];
  let resto = textoLimpio;
  while (resto.length > maximo) {
    const espacio = resto.lastIndexOf(" ", maximo);
    const corte = espacio > 4 ? espacio : maximo;
    lineas.push(resto.slice(0, corte).trim());
    resto = resto.slice(corte).trim();
  }
  if (resto) lineas.push(resto);
  return lineas;
}

function lineasFila(fila: FilaEntradaPdf) {
  const fecha = envolver(formatoFecha(fila.fecha), caracteres(COLUMNAS.fecha));
  const hora = [fila.hora || "—"];
  const tag = [fila.tag];
  const producto = envolver(fila.producto, caracteres(COLUMNAS.producto));
  const codigo = envolver(fila.codigo, caracteres(COLUMNAS.codigo, 6.5));
  const kg = [formatoKg(fila.kg)];
  const destino = envolver(fila.destino.trim() || "—", caracteres(COLUMNAS.destino));
  const observacion = envolver(fila.observaciones.trim() || "—", caracteres(anchoObservacion()));
  const cantidad = Math.max(
    fecha.length,
    hora.length,
    tag.length,
    producto.length,
    codigo.length,
    kg.length,
    destino.length,
    observacion.length,
    1,
  );
  return { fecha, hora, tag, producto, codigo, kg, destino, observacion, alto: cantidad * RENGLON + 10 };
}

function anchoObservacion() {
  return ANCHO - MARGEN * 2 - COLUMNAS.fecha - COLUMNAS.hora - COLUMNAS.tag - COLUMNAS.producto - COLUMNAS.codigo - COLUMNAS.kg - COLUMNAS.destino;
}

function paginar(filas: FilaEntradaPdf[]) {
  const techo = 468;
  const suelo = 40;
  const firmasAlto = 100;
  const paginas: { filas: FilaEntradaPdf[]; firmas: boolean }[] = [];
  let actual: FilaEntradaPdf[] = [];
  let y = techo;
  for (const fila of filas) {
    const alto = lineasFila(fila).alto;
    if (actual.length > 0 && y - alto < suelo) {
      paginas.push({ filas: actual, firmas: false });
      actual = [];
      y = techo;
    }
    actual.push(fila);
    y -= alto;
  }
  if (actual.length === 0 && paginas.length === 0) return [{ filas: [], firmas: true }];
  if (y - firmasAlto < suelo) {
    if (actual.length) paginas.push({ filas: actual, firmas: false });
    paginas.push({ filas: [], firmas: true });
  } else {
    paginas.push({ filas: actual, firmas: true });
  }
  return paginas;
}

function dibujo(datos: {
  dia: string;
  producto: string;
  filas: FilaEntradaPdf[];
  firmas: boolean;
  totalKg: number;
  pagina: number;
  paginas: number;
}) {
  const comandos = ["0.8 w", "0 0 0 RG", "0 0 0 rg"];
  let y = ALTO - 34;
  comandos.push(centrado("F2", 16, y, "PUROLOMO"));
  y -= 16;
  comandos.push(centrado("F2", 12, y, "PLANTA CAGUA"));
  y -= 16;
  comandos.push(centrado("F2", 12, y, "REGISTRO DE ENTRADA"));
  y -= 16;
  comandos.push(centrado("F1", 11, y, `${datos.dia} · ${datos.producto}`));
  y -= 10;
  comandos.push("[2 2] 0 d", `${MARGEN} ${y} m ${ANCHO - MARGEN} ${y} l S`, "[] 0 d");
  comandos.push(texto("F1", 8, ANCHO - MARGEN - 62, y + 4, `Pág. ${datos.pagina} de ${datos.paginas}`));

  const encabezado = 18;
  y -= encabezado + 8;
  comandos.push("0.15 0.22 0.32 rg", `${MARGEN} ${y} ${ANCHO - MARGEN * 2} ${encabezado} re f`, "1 1 1 rg");
  const titulos = [
    { texto: "Fecha", ancho: COLUMNAS.fecha },
    { texto: "Hora", ancho: COLUMNAS.hora },
    { texto: "TAG", ancho: COLUMNAS.tag },
    { texto: "Producto", ancho: COLUMNAS.producto },
    { texto: "Código", ancho: COLUMNAS.codigo },
    { texto: "Kg", ancho: COLUMNAS.kg },
    { texto: "Para", ancho: COLUMNAS.destino },
    { texto: "Observación", ancho: anchoObservacion() },
  ];
  let x = MARGEN;
  for (const titulo of titulos) {
    comandos.push(texto("F2", 8, x + 3, y + 5, titulo.texto));
    x += titulo.ancho;
  }
  comandos.push("0 0 0 rg");

  if (datos.filas.length === 0 && datos.pagina === 1) {
    y -= 22;
    comandos.push(texto("F1", 10, MARGEN + 4, y, "No hay entradas registradas en este día."));
  }

  for (const fila of datos.filas) {
    const contenido = lineasFila(fila);
    y -= contenido.alto;
    comandos.push("0.75 0.75 0.75 RG", `${MARGEN} ${y} m ${ANCHO - MARGEN} ${y} l S`, "0 0 0 RG");
    const tope = y + contenido.alto - 12;
    const columnas = [
      contenido.fecha,
      contenido.hora,
      contenido.tag,
      contenido.producto,
      contenido.codigo,
      contenido.kg,
      contenido.destino,
      contenido.observacion,
    ];
    const anchos = [
      COLUMNAS.fecha,
      COLUMNAS.hora,
      COLUMNAS.tag,
      COLUMNAS.producto,
      COLUMNAS.codigo,
      COLUMNAS.kg,
      COLUMNAS.destino,
      anchoObservacion(),
    ];
    let columna = MARGEN;
    columnas.forEach((lineas, indice) => {
      escribir(comandos, columna, tope, lineas);
      columna += anchos[indice] ?? 0;
    });
  }

  if (datos.firmas) {
    const firmaY = Math.max(78, Math.min(y - 64, 116));
    comandos.push(texto("F2", 11, MARGEN + 4, firmaY + 28, `Kg totales recibidos: ${formatoKg(datos.totalKg)}`));
    firma(comandos, 150, firmaY, "RECEPCIONISTA");
    firma(comandos, ANCHO - 310, firmaY, "SUPERVISOR");
  }

  return comandos.join("\n");
}

function escribir(comandos: string[], x: number, tope: number, lineas: string[]) {
  lineas.forEach((linea, indice) => {
    comandos.push(texto("F1", 7, x + 3, tope - indice * RENGLON, linea));
  });
}

function firma(comandos: string[], x: number, y: number, cargo: string) {
  comandos.push("1.1 w", `${x} ${y} m ${x + 160} ${y} l S`, "0.8 w");
  comandos.push(centradoEn("F2", 10, x, 160, y - 16, cargo));
}

function centrado(fuente: "F1" | "F2", tamano: number, y: number, valor: string) {
  const ancho = valor.length * tamano * (fuente === "F2" ? 0.56 : 0.5);
  return texto(fuente, tamano, Math.max(MARGEN, (ANCHO - ancho) / 2), y, valor);
}

function centradoEn(fuente: "F1" | "F2", tamano: number, x: number, anchoCaja: number, y: number, valor: string) {
  const ancho = valor.length * tamano * (fuente === "F2" ? 0.56 : 0.5);
  return texto(fuente, tamano, x + Math.max(0, (anchoCaja - ancho) / 2), y, valor);
}

function texto(fuente: "F1" | "F2", tamano: number, x: number, y: number, valor: string) {
  if (!valor) return "";
  return `BT /${fuente} ${tamano} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${pdfTexto(valor)}) Tj ET`;
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

function armar(contenidos: Buffer[]) {
  const objetos: Buffer[] = [
    objeto(1, "<< /Type /Catalog /Pages 2 0 R >>"),
    objeto(
      2,
      `<< /Type /Pages /Kids [${contenidos.map((_, indice) => `${5 + indice * 2} 0 R`).join(" ")}] /Count ${contenidos.length} >>`,
    ),
    objeto(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
    objeto(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"),
  ];
  contenidos.forEach((contenido, indice) => {
    const pagina = 5 + indice * 2;
    const flujo = pagina + 1;
    objetos.push(
      objeto(
        pagina,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] /Contents ${flujo} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`,
      ),
    );
    objetos.push(objetoStream(flujo, contenido));
  });
  return unir(objetos);
}

function objeto(numero: number, cuerpo: string) {
  return Buffer.from(`${numero} 0 obj\n${cuerpo}\nendobj\n`);
}

function objetoStream(numero: number, datos: Buffer) {
  const cabeza = Buffer.from(`${numero} 0 obj\n<< /Length ${datos.length} >>\nstream\n`);
  return Buffer.concat([cabeza, datos, Buffer.from("\nendstream\nendobj\n")]);
}

function unir(lista: Buffer[]) {
  const partes: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const offsets = [0];
  let cursor = partes[0].length;
  for (const pieza of lista) {
    offsets.push(cursor);
    partes.push(pieza);
    cursor += pieza.length;
  }
  let xref = `xref\n0 ${lista.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  partes.push(Buffer.from(`${xref}trailer\n<< /Size ${lista.length + 1} /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF`));
  return Buffer.concat(partes);
}
