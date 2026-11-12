import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { etiquetaDeLote } from "@/lib/etiqueta-cava";
import { buscarLote } from "@/lib/lotes";
import { pdfDeEtiqueta } from "@/lib/pdf-etiqueta";
import { textoQrDeEtiqueta } from "@/lib/qr";

export async function GET(
  _request: Request,
  contexto: { params: Promise<{ tag: string }> },
) {
  await connection();
  const { tag } = await contexto.params;
  const limpio = decodeURIComponent(tag).trim();
  if (!/^\d{4,8}$/.test(limpio)) return new Response("TAG inválido", { status: 400 });
  const db = getDb();
  const lote = await buscarLote(db, limpio);
  if (!lote) return new Response("No existe ese TAG", { status: 404 });

  const archivo = pdfDeEtiqueta(etiquetaDeLote(lote), textoQrDeEtiqueta(lote.tag));
  return new Response(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="etiqueta-${lote.tag}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
