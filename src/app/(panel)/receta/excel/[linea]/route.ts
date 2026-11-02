import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { excelDeReceta } from "@/lib/excel-receta";
import { recetaVigente } from "@/lib/recetas";

export async function GET(
  _request: Request,
  contexto: { params: Promise<{ linea: string }> },
) {
  await connection();
  const { linea } = await contexto.params;
  if (linea !== "1" && linea !== "2") {
    return new Response("Línea inválida", { status: 400 });
  }
  const receta = recetaVigente(getDb(), linea);
  if (!receta) return new Response("No hay receta para esa línea", { status: 404 });

  const archivo = excelDeReceta(receta);
  return new Response(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="receta-alibal-linea-${receta.linea}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
