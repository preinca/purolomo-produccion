import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { destinoValido } from "@/lib/destinos";
import { fechaValida } from "@/lib/formato";
import { pdfRegistroPesajes } from "@/lib/pdf-pesajes";
import { planillaDeProducto } from "@/lib/pesajes";

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const producto = url.searchParams.get("producto")?.trim() ?? "";
  const fecha = url.searchParams.get("fecha")?.trim() ?? "";
  if (!destinoValido(producto) || (fecha && !fechaValida(fecha))) {
    return new Response("Elige un producto válido.", { status: 400 });
  }

  const planilla = await planillaDeProducto(getDb(), producto);
  const filas = fecha ? planilla.filas.filter((fila) => fila.fecha === fecha) : planilla.filas;
  const pdf = pdfRegistroPesajes({
    fecha,
    tipos: planilla.tipos,
    filas: filas.map((fila) => ({
      numero: fila.numero,
      fecha: fila.fecha,
      hora: fila.hora,
      linea: fila.linea,
      destino: fila.destino,
      codigo: fila.codigo,
      observaciones: fila.observaciones,
      total: fila.total,
      celdas: fila.celdas.map((celda) => ({
        tipo: celda.tipo,
        kg: celda.kg,
        aportes: celda.aportes.map((aporte) => ({ tag: aporte.tag, token: aporte.token, kg: aporte.kg })),
      })),
    })),
  });
  const nombre = `pesajes-${producto.replace(/ /g, "-")}${fecha ? `-${fecha}` : ""}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
