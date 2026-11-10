import { connection } from "next/server";
import { Suspense } from "react";
import { EliminarEnVivo } from "@/components/eliminar-en-vivo";
import { PageFrame } from "@/components/page-frame";
import { getDb } from "@/lib/db";
import { kgConsumidosDe, kgDisponiblesDe, listarLotes } from "@/lib/lotes";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PageFrame
      titulo="Eliminar lote"
      descripcion="Escribe parte del TAG. Las paletas aparecen mientras escribes y después confirmas."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <Eliminar searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}

function texto(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

async function Eliminar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const parametros = await searchParams;
  const eliminado = texto(parametros.eliminado).trim();
  const lotes = (await listarLotes(getDb(), { limite: 300 })).map((lote) => ({
    tag: lote.tag,
    producto: lote.producto,
    codigo: lote.codigo,
    destino: lote.destino,
    fecha: lote.fecha,
    semana: lote.semana,
    kgRecibidos: lote.kgRecibidos,
    kgConsumidos: kgConsumidosDe(lote),
    kgDisponibles: kgDisponiblesDe(lote),
    estado: lote.estado,
    observaciones: lote.observaciones,
  }));

  return (
    <div className="grid gap-8">
      {eliminado ? (
        <p role="status" className="max-w-xl rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          El lote {eliminado} quedó eliminado.
        </p>
      ) : null}
      <EliminarEnVivo lotes={lotes} />
    </div>
  );
}
