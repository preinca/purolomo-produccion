import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { excelDeReceta } from "@/lib/excel-receta";
import { plantillaReceta, recetaVigente } from "@/lib/recetas";

export async function GET(
  _request: Request,
  contexto: { params: Promise<{ linea: string }> },
) {
  await connection();
  const { linea } = await contexto.params;
  if (linea !== "1" && linea !== "2") {
    return new Response("Línea inválida", { status: 400 });
  }
  const receta = (await recetaVigente(getDb(), linea)) ?? plantillaReceta(linea);

  const archivo = await excelDeReceta(receta);
  return new Response(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="receta-alibal-linea-${receta.linea}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
