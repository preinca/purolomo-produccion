import { connection } from "next/server";
import { Suspense } from "react";
import { BuscarMiniLote, type FichaMini } from "@/components/buscar-minilote";
import { PageFrame } from "@/components/page-frame";
import { getDb } from "@/lib/db";
import { buscarLote, kgConsumidosDe, kgDisponiblesDe, tagAgotado } from "@/lib/lotes";
import { productoPorCodigo } from "@/lib/mpc";
import { codigoDelPesaje, listarMiniLotesTodos, listarPesajesTodos } from "@/lib/pesajes";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PageFrame
      titulo="Buscar mini lote"
      descripcion="Escribe parte del código, del TAG o del número. Las coincidencias aparecen mientras escribes."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Buscando mini lote…</p>}>
        <Consulta searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}

function texto(valor: string | string[] | undefined) {
  return (Array.isArray(valor) ? valor[0] ?? "" : valor ?? "").trim();
}

async function Consulta({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const inicial = texto((await searchParams).codigo);
  const db = getDb();
  const pesajes = listarPesajesTodos(db);
  const porId = new Map(pesajes.map((pesaje) => [pesaje.id, pesaje]));
  const fichas: FichaMini[] = listarMiniLotesTodos(db).map((mini) => {
    const lote = buscarLote(db, mini.tag);
    const tipo = lote ? productoPorCodigo(lote.codigo) : null;
    const pesaje = porId.get(mini.pesajeId);
    return {
      token: mini.token,
      tipo: mini.tipo,
      kg: mini.kg,
      tag: mini.tag,
      destino: mini.destino,
      linea: mini.linea,
      pesaje: mini.numeroPesaje,
      fecha: pesaje?.fecha ?? "",
      codigoPesaje: pesaje ? codigoDelPesaje(db, pesaje.id) : "",
      materia: tipo ? `${tipo.descripcion} · ${lote?.codigo}` : lote?.producto ?? "—",
      recibidos: lote ? lote.kgRecibidos : null,
      consumidos: lote ? kgConsumidosDe(lote) : null,
      disponibles: lote ? kgDisponiblesDe(lote) : null,
      agotado: lote ? tagAgotado(lote) : false,
      estado: lote?.estado ?? "",
    };
  });

  return <BuscarMiniLote inicial={inicial} fichas={fichas} />;
}
