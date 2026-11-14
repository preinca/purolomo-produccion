import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { fechaValida, formatoHora } from "@/lib/formato";
import { listarEntradas } from "@/lib/lotes";
import { PRODUCTOS_MPC, productoPorCodigo } from "@/lib/mpc";
import { pdfRegistroEntradas } from "@/lib/pdf-entradas";

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const codigo = url.searchParams.get("producto")?.trim() ?? "";
  const fecha = url.searchParams.get("fecha")?.trim() ?? "";
  const producto = PRODUCTOS_MPC.find((item) => item.codigo === codigo) ?? null;
  if ((codigo && !producto) || !fechaValida(fecha)) {
    return new Response("Elige un día válido.", { status: 400 });
  }

  const lotes = await listarEntradas(getDb(), { codigo: producto?.codigo ?? "", fecha });
  const pdf = pdfRegistroEntradas({
    fecha,
    producto: producto?.nombre ?? "Todos los productos",
    filas: lotes.map((lote) => ({
      fecha: lote.fecha,
      hora: formatoHora(lote.creadoEn),
      tag: lote.tag,
      producto: productoPorCodigo(lote.codigo)?.nombre ?? lote.producto,
      codigo: lote.codigo,
      kg: lote.kgRecibidos,
      destino: lote.destino,
      observaciones: lote.observaciones,
    })),
  });
  const nombre = `entradas-${fecha}${producto ? `-${producto.codigo}` : ""}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
