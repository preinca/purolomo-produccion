import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { buscarLote } from "@/lib/lotes";
import { retirosDeTag } from "@/lib/pesajes";
import { pngQr } from "@/lib/png-qr";
import { textoQr } from "@/lib/qr";

export async function GET(
  _request: Request,
  contexto: { params: Promise<{ tag: string }> },
) {
  await connection();
  const { tag } = await contexto.params;
  const limpio = decodeURIComponent(tag).trim();
  if (!/^\d{4,8}$/.test(limpio)) {
    return new Response("TAG inválido", { status: 400 });
  }
  const db = getDb();
  const lote = await buscarLote(db, limpio);
  if (!lote) return new Response("No existe ese TAG", { status: 404 });

  const png = pngQr(textoQr(lote, await retirosDeTag(db, lote.tag)));
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="qr-${lote.tag}.png"`,
      "Cache-Control": "no-store",
    },
  });
}
