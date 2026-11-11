import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { cerrarImpresion, tomarImpresion } from "@/lib/impresion";

export async function GET(request: Request) {
  if (!claveValida(request)) return new Response("No autorizado", { status: 401 });
  const trabajo = await tomarImpresion(getDb());
  return Response.json(trabajo ?? { id: null, zpl: "" });
}

export async function POST(request: Request) {
  if (!claveValida(request)) return new Response("No autorizado", { status: 401 });
  const cuerpo = (await request.json().catch(() => null)) as { id?: unknown; ok?: unknown } | null;
  const id = Number(cuerpo?.id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Trabajo inválido", { status: 400 });
  await cerrarImpresion(getDb(), id, cuerpo?.ok === true);
  return Response.json({ ok: true });
}

function claveValida(request: Request) {
  const esperada = process.env.IMPRESION_CLAVE ?? "";
  const recibida = request.headers.get("x-impresion-clave") ?? "";
  if (!esperada || esperada.length !== recibida.length) return false;
  return timingSafeEqual(Buffer.from(esperada), Buffer.from(recibida));
}
