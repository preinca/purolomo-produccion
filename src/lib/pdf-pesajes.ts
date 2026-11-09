import { fechaValida, formatoFecha, formatoKg } from "./formato";

const ANCHO = 842;
const ALTO = 595;
const MARGEN = 28;
const RENGLON = 9;

export type FilaPesajePdf = {
  numero: number;
  fecha: string;
  hora?: string;
  linea: string;
  destino: string;
  codigo: string;
  observaciones: string;
  total: number;
  celdas: { tipo: string; kg: number; aportes: { tag: string; token: string; kg: number }[] }[];
};

export function pdfRegistroPesajes(entrada: { fecha: string; tipos: string[]; filas: FilaPesajePdf[] }) {
  const columnas = medidas(entrada.tipos);
  const bloques = paginar(entrada.filas, columnas);
  const dia = fechaValida(entrada.fecha) ? formatoFecha(entrada.fecha) : "Todos los registros";
  const totalKg = Math.round(entrada.filas.reduce((suma, fila) => suma + fila.total, 0) * 1000) / 1000;
  const contenidos = bloques.map((bloque, indice) =>
    Buffer.from(
      dibujo({
        dia,
        tipos: entrada.tipos,
        columnas,
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

type Medidas = {
  pesaje: number;
  fecha: number;
  linea: number;
  uso: number;
  observacion: number;
  tipo: number;
  total: number;
};

function medidas(tipos: string[]): Medidas {
  const usable = ANCHO - MARGEN * 2;
  const pesaje = 108;
  const fecha = 78;
  const linea = 32;
  const uso = 72;
  const observacion = 86;
  const total = 52;
  const resto = usable - pesaje - fecha - linea - uso - observacion - total;
  const tipo = tipos.length ? resto / tipos.length : resto;
  return { pesaje, fecha, linea, uso, observacion, tipo, total };
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

function lineasFila(fila: FilaPesajePdf, columnas: Medidas) {
  const pesaje = [String(fila.numero), ...envolver(fila.codigo, caracteres(columnas.pesaje, 6.5))];
  const fecha = [formatoFecha(fila.fecha), ...(fila.hora ? [fila.hora] : [])].flatMap((lineaTexto) =>
    envolver(lineaTexto, caracteres(columnas.fecha)),
  );
  const linea = [fila.linea];
  const uso = envolver(fila.destino, caracteres(columnas.uso));
  const observacion = envolver(fila.observaciones.trim() || "—", caracteres(columnas.observacion));
  const celdas = fila.celdas.map((celda) => {
    const lineas: string[] = [];
    for (const aporte of celda.aportes) {
      lineas.push(formatoKg(aporte.kg));
      lineas.push(`TAG ${aporte.tag}`);
      lineas.push(`Mini lote ${aporte.token}`);
    }
    if (celda.aportes.length > 1) lineas.push(`Suma ${celda.tipo}: ${formatoKg(celda.kg)}`);
    return lineas.flatMap((lineaTexto) => envolver(lineaTexto, caracteres(columnas.tipo, 6.5)));
  });
  const total = envolver(formatoKg(fila.total), caracteres(columnas.total));
  const cantidad = Math.max(pesaje.length, fecha.length, linea.length, uso.length, observacion.length, total.length, ...celdas.map((celda) => celda.length), 1);
  return { pesaje, fecha, linea, uso, observacion, celdas, total, alto: cantidad * RENGLON + 10 };
}

function paginar(filas: FilaPesajePdf[], columnas: Medidas) {
  const techo = 468;
  const suelo = 40;
  const firmasAlto = 100;
  const paginas: { filas: FilaPesajePdf[]; firmas: boolean }[] = [];
  let actual: FilaPesajePdf[] = [];
  let y = techo;
  for (const fila of filas) {
    const alto = lineasFila(fila, columnas).alto;
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
  tipos: string[];
  columnas: Medidas;
  filas: FilaPesajePdf[];
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
  comandos.push(centrado("F2", 12, y, "REGISTRO DE PESAJES"));
  y -= 16;
  comandos.push(centrado("F1", 11, y, datos.dia));
  y -= 10;
  comandos.push("[2 2] 0 d", `${MARGEN} ${y} m ${ANCHO - MARGEN} ${y} l S`, "[] 0 d");
  comandos.push(texto("F1", 8, ANCHO - MARGEN - 62, y + 4, `Pág. ${datos.pagina} de ${datos.paginas}`));

  const encabezado = 18;
  y -= encabezado + 8;
  comandos.push("0.15 0.22 0.32 rg", `${MARGEN} ${y} ${ANCHO - MARGEN * 2} ${encabezado} re f`, "1 1 1 rg");
  const titulos = [
    { texto: "Pesaje", ancho: datos.columnas.pesaje },
    { texto: "Fecha", ancho: datos.columnas.fecha },
    { texto: "Línea", ancho: datos.columnas.linea },
    { texto: "Uso", ancho: datos.columnas.uso },
    { texto: "Observación", ancho: datos.columnas.observacion },
    ...datos.tipos.map((tipo) => ({ texto: tipo, ancho: datos.columnas.tipo })),
    { texto: "Total", ancho: datos.columnas.total },
  ];
  let x = MARGEN;
  for (const titulo of titulos) {
    comandos.push(texto("F2", 8, x + 3, y + 5, titulo.texto));
    x += titulo.ancho;
  }
  comandos.push("0 0 0 rg");

  if (datos.filas.length === 0 && datos.pagina === 1) {
    y -= 22;
    comandos.push(texto("F1", 10, MARGEN + 4, y, datos.dia === "Todos los registros" ? "No hay pesajes registrados." : "No hay pesajes registrados en este día."));
  }

  for (const fila of datos.filas) {
    const contenido = lineasFila(fila, datos.columnas);
    y -= contenido.alto;
    comandos.push("0.75 0.75 0.75 RG", `${MARGEN} ${y} m ${ANCHO - MARGEN} ${y} l S`, "0 0 0 RG");
    const tope = y + contenido.alto - 12;
    escribir(comandos, MARGEN, tope, contenido.pesaje, 0);
    escribir(comandos, MARGEN + datos.columnas.pesaje, tope, contenido.fecha, 0);
    escribir(comandos, MARGEN + datos.columnas.pesaje + datos.columnas.fecha, tope, contenido.linea, 0);
    escribir(
      comandos,
      MARGEN + datos.columnas.pesaje + datos.columnas.fecha + datos.columnas.linea,
      tope,
      contenido.uso,
      0,
    );
    escribir(
      comandos,
      MARGEN + datos.columnas.pesaje + datos.columnas.fecha + datos.columnas.linea + datos.columnas.uso,
      tope,
      contenido.observacion,
      0,
    );
    let columna = MARGEN + datos.columnas.pesaje + datos.columnas.fecha + datos.columnas.linea + datos.columnas.uso + datos.columnas.observacion;
    for (const celda of contenido.celdas) {
      escribir(comandos, columna, tope, celda, 0);
      columna += datos.columnas.tipo;
    }
    escribir(comandos, columna, tope, contenido.total, 1);
  }

  if (datos.firmas) {
    const firmaY = Math.max(78, Math.min(y - 64, 116));
    comandos.push(texto("F2", 11, MARGEN + 4, firmaY + 28, `Kg totales consumidos: ${formatoKg(datos.totalKg)}`));
    firma(comandos, 150, firmaY, "PESADOR");
    firma(comandos, ANCHO - 310, firmaY, "SUPERVISOR");
  }

  return comandos.join("\n");
}

function escribir(comandos: string[], x: number, tope: number, lineas: string[], negritaPrimera: number) {
  lineas.forEach((linea, indice) => {
    comandos.push(texto(indice < negritaPrimera ? "F2" : "F1", 7, x + 3, tope - indice * RENGLON, linea));
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
