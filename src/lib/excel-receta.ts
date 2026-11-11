import ExcelJS from "exceljs";
import { productoPorTipo } from "./mpc";
import { limitesLinea, type Receta } from "./recetas";

const NAVY = "FF071422";
const ROJO = "FFE30613";
const BLANCO = "FFFFFFFF";
const GRIS = "FFF4F6F8";
const LINEA = "FFD5DCE3";
const TEXTO = "FF142033";
const SUAVE = "FF5C6B7A";
const AMARILLO = "FFFFF3C4";

const borde: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: LINEA } },
  left: { style: "thin", color: { argb: LINEA } },
  bottom: { style: "thin", color: { argb: LINEA } },
  right: { style: "thin", color: { argb: LINEA } },
};

export async function excelDeReceta(receta: Receta): Promise<Buffer> {
  const limites = limitesLinea(receta.linea);
  const libro = new ExcelJS.Workbook();
  libro.creator = "Purolomo";
  libro.title = `Fórmula ${receta.destino} línea ${receta.linea}`;

  const hoja = libro.addWorksheet("Fórmula", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 8 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      margins: { left: 0.5, right: 0.5, top: 0.55, bottom: 0.55, header: 0.2, footer: 0.25 },
    },
    headerFooter: {
      oddFooter: "&LPurolomo · Planta Cagua&RAlmacén 40602-1",
    },
  });

  hoja.columns = [
    { width: 22 },
    { width: 14 },
    { width: 16 },
    { width: 24 },
    { width: 26 },
    { width: 16 },
    { width: 32 },
  ];

  banda(hoja, 1, "PUROLOMO", { size: 22, bold: true, color: { argb: BLANCO } }, NAVY, 34);
  banda(hoja, 2, "PLANTA CAGUA", { size: 12, bold: true, color: { argb: BLANCO } }, NAVY, 20);
  banda(hoja, 3, "FÓRMULA DEL DÍA", { size: 14, bold: true, color: { argb: BLANCO } }, ROJO, 24);

  hoja.getRow(4).height = 10;

  const toleranciaProducto = receta.toleranciaKg || limites.tolerancia;
  const minimoProducto = receta.minimoKg ?? limites.objetivo - toleranciaProducto;
  const maximoProducto = receta.maximoKg ?? limites.objetivo + toleranciaProducto;
  info(hoja, 5, [
    ["Producto", receta.destino],
    ["Línea", receta.linea],
    ["Objetivo", limites.objetivo],
  ]);
  hoja.getCell(5, 6).numFmt = "0.000";
  info(hoja, 6, [
    ["Tolerancia del pesaje", toleranciaProducto],
    ["Mínimo", minimoProducto],
    ["Máximo", maximoProducto],
  ]);
  editable(hoja.getCell(6, 2));
  hoja.getCell(6, 2).numFmt = "0.000";
  hoja.getCell(6, 4).value = { formula: "F5-B6", result: minimoProducto };
  hoja.getCell(6, 4).numFmt = "0.000";
  hoja.getCell(6, 6).value = { formula: "F5+B6", result: maximoProducto };
  hoja.getCell(6, 6).numFmt = "0.000";

  hoja.getRow(7).height = 10;

  const encabezados = ["Tipo", "Kg", "Tolerancia", "Rango", "Producto", "Código", "Descripción"];
  encabezados.forEach((texto, indice) => {
    const celda = hoja.getCell(8, indice + 1);
    celda.value = texto;
    celda.font = { name: "Calibri", size: 11, bold: true, color: { argb: BLANCO } };
    celda.fill = solido(NAVY);
    celda.alignment = { horizontal: "center", vertical: "middle" };
    celda.border = borde;
  });
  hoja.getRow(8).height = 22;

  receta.items.forEach((item, indice) => {
    const fila = 9 + indice;
    const producto = productoPorTipo(item.tipo);
    const toleranciaItem = item.tolerancia ?? toleranciaProducto;
    const maximoItem = item.maximo ?? Math.round((item.kg + toleranciaItem) * 1000) / 1000;
    const minimoItem = item.minimo ?? item.kg;
    const valores: (string | number | ExcelJS.CellFormulaValue)[] = [
      item.tipo,
      item.kg,
      toleranciaItem,
      rangoFormula(`B${fila}`, `(B${fila}+C${fila})`, minimoItem, maximoItem),
      producto?.nombre ?? "",
      producto?.codigo ?? "",
      producto?.descripcion ?? "",
    ];
    valores.forEach((valor, columna) => {
      const celda = hoja.getCell(fila, columna + 1);
      celda.value = valor;
      celda.font = {
        name: "Calibri",
        size: 11,
        bold: columna === 0,
        color: { argb: TEXTO },
      };
      celda.fill = solido(indice % 2 === 0 ? BLANCO : GRIS);
      celda.alignment = {
        horizontal: columna >= 1 && columna <= 3 ? "right" : columna === 0 || columna === 5 ? "center" : "left",
        vertical: "middle",
      };
      celda.border = borde;
      if (columna === 1 || columna === 2) celda.numFmt = "0.000";
      if (columna === 2) editable(celda);
    });
    hoja.getRow(fila).height = 20;
  });

  const inicio = 9;
  const fin = 8 + receta.items.length;
  const totalFila = fin + 1;
  const total = hoja.getCell(totalFila, 1);
  total.value = "TOTAL";
  const suma = hoja.getCell(totalFila, 2);
  suma.value = { formula: `SUM(B${inicio}:B${fin})`, result: receta.objetivoKg };
  hoja.getCell(totalFila, 3).value = { formula: "B6", result: toleranciaProducto };
  hoja.getCell(totalFila, 4).value = rangoFormula("F5-B6", "F5+B6", minimoProducto, maximoProducto);
  for (let columna = 1; columna <= 7; columna += 1) {
    const celda = hoja.getCell(totalFila, columna);
    celda.font = { name: "Calibri", size: 12, bold: true, color: { argb: BLANCO } };
    celda.fill = solido(NAVY);
    celda.alignment = { horizontal: columna === 2 ? "right" : "center", vertical: "middle" };
    celda.border = borde;
    if (columna === 2 || columna === 3) celda.numFmt = "0.000";
  }
  hoja.getRow(totalFila).height = 24;

  hoja.mergeCells(totalFila + 2, 1, totalFila + 2, 7);
  const nota = hoja.getCell(totalFila + 2, 1);
  nota.value = "Cambia la tolerancia en las celdas amarillas. El rango se calcula solo, en el pesaje completo y en cada materia prima.";
  nota.font = { name: "Calibri", size: 9, italic: true, color: { argb: SUAVE } };
  nota.alignment = { horizontal: "center" };

  hoja.autoFilter = { from: { row: 8, column: 1 }, to: { row: fin, column: 7 } };
  hoja.pageSetup.printTitlesRow = "1:8";

  const archivo = await libro.xlsx.writeBuffer();
  return Buffer.from(archivo);
}

function banda(
  hoja: ExcelJS.Worksheet,
  fila: number,
  texto: string,
  fuente: Partial<ExcelJS.Font>,
  fondo: string,
  alto: number,
) {
  hoja.mergeCells(fila, 1, fila, 7);
  for (let columna = 1; columna <= 7; columna += 1) {
    const celda = hoja.getCell(fila, columna);
    celda.fill = solido(fondo);
    celda.font = { name: "Calibri", ...fuente };
    celda.alignment = { horizontal: "center", vertical: "middle" };
  }
  hoja.getCell(fila, 1).value = texto;
  hoja.getRow(fila).height = alto;
}

function editable(celda: ExcelJS.Cell) {
  celda.fill = solido(AMARILLO);
  celda.protection = { locked: false };
  celda.font = { name: "Calibri", size: 12, bold: true, color: { argb: TEXTO } };
}

function info(hoja: ExcelJS.Worksheet, fila: number, pares: [string, string | number][]) {
  for (let columna = 1; columna <= 7; columna += 1) {
    const celda = hoja.getCell(fila, columna);
    celda.fill = solido(GRIS);
    celda.border = borde;
    celda.font = { name: "Calibri", size: 11, color: { argb: TEXTO } };
    celda.alignment = { vertical: "middle", horizontal: "left" };
  }
  let columna = 1;
  for (const [etiqueta, valor] of pares) {
    const rotulo = hoja.getCell(fila, columna);
    rotulo.value = etiqueta;
    rotulo.font = { name: "Calibri", size: 11, color: { argb: SUAVE } };
    const datoCelda = hoja.getCell(fila, columna + 1);
    datoCelda.value = valor;
    datoCelda.font = { name: "Calibri", size: 11, bold: true, color: { argb: TEXTO } };
    columna += 2;
  }
  hoja.getRow(fila).height = 22;
}

function kilos(valor: number) {
  const redondo = Math.round(valor * 1000) / 1000;
  return String(redondo);
}

function numeroFormula(expr: string) {
  return `IF(${expr}=INT(${expr}),FIXED(${expr},0,TRUE),FIXED(${expr},3,TRUE))`;
}

function rangoFormula(minimoExpr: string, maximoExpr: string, minimo: number, maximo: number): ExcelJS.CellFormulaValue {
  return {
    formula: `${numeroFormula(minimoExpr)}&" a "&${numeroFormula(maximoExpr)}&" kg"`,
    result: `${kilos(minimo)} a ${kilos(maximo)} kg`,
  };
}

function solido(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}
