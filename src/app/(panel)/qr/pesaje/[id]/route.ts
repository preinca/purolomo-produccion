import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { fichaQrPesaje } from "@/lib/pesajes";
import { pngQr } from "@/lib/png-qr";
import { textoQrPesaje } from "@/lib/qr";

export async function GET(
  _request: Request,
  contexto: { params: Promise<{ id: string }> },
) {
  await connection();
  const { id } = await contexto.params;
  const pesajeId = Number(id);
  if (!Number.isInteger(pesajeId) || pesajeId < 1) {
    return new Response("Pesaje inválido", { status: 400 });
  }
  const ficha = await fichaQrPesaje(getDb(), pesajeId);
  if (!ficha) return new Response("Ese pesaje todavía no tiene retiros.", { status: 404 });

  const png = pngQr(textoQrPesaje(ficha));
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="qr-pesaje-${ficha.numero}.png"`,
      "Cache-Control": "no-store",
    },
  });
}
