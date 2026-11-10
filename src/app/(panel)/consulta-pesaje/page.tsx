import { connection } from "next/server";
import { Suspense } from "react";
import { BuscarPesaje, type FichaPesaje } from "@/components/buscar-pesaje";
import { PageFrame } from "@/components/page-frame";
import { getDb } from "@/lib/db";
import { buscarLotes, kgDisponiblesDe } from "@/lib/lotes";
import { codigosDePesajes, listarMiniLotesTodos, listarPesajesTodos, progresosDePesajes } from "@/lib/pesajes";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PageFrame
      titulo="Buscar pesaje"
      descripcion="Escribe parte del código, una sigla o un mini lote. Los pesajes aparecen mientras escribes."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Buscando pesaje…</p>}>
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
  const [pesajes, todosMinis] = await Promise.all([listarPesajesTodos(db), listarMiniLotesTodos(db)]);
  const [progresos, codigos, lotes] = await Promise.all([
    progresosDePesajes(db, pesajes),
    codigosDePesajes(db, pesajes),
    buscarLotes(
      db,
      todosMinis.map((mini) => mini.tag),
    ),
  ]);
  const fichas: FichaPesaje[] = pesajes.map((pesaje) => {
    const progreso = progresos.get(pesaje.id)!;
    const minis = todosMinis.filter((mini) => mini.pesajeId === pesaje.id).reverse();
    return {
      id: pesaje.id,
      numero: pesaje.numero,
      fecha: pesaje.fecha,
      destino: pesaje.destino,
      linea: pesaje.linea,
      total: progreso.total,
      codigo: codigos.get(pesaje.id) ?? "",
      observaciones: pesaje.observaciones,
      lineas: progreso.lineas.map((linea) => ({
        tipo: linea.tipo,
        usado: linea.usado,
        objetivo: linea.objetivo,
        minimo: linea.minimo,
        maximo: linea.maximo,
      })),
      minis: minis.map((mini) => {
        const lote = lotes.get(mini.tag);
        return {
          token: mini.token,
          tipo: mini.tipo,
          kg: mini.kg,
          tag: mini.tag,
          destino: mini.destino,
          disponibles: lote ? kgDisponiblesDe(lote) : null,
        };
      }),
    };
  });

  return <BuscarPesaje inicial={inicial} fichas={fichas} />;
}
