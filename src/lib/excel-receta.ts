import * as XLSX from "xlsx";
import type { Receta } from "./recetas";

export function excelDeReceta(receta: Receta): Buffer {
  const filas: (string | number)[][] = [
    ["Tipo", "Kg"],
    ...receta.items.map((item) => [item.tipo, item.kg]),
  ];
  const libro = XLSX.utils.book_new();
  const hoja = XLSX.utils.aoa_to_sheet(filas);
  XLSX.utils.book_append_sheet(libro, hoja, "Receta");
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
