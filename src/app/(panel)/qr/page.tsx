import { connection } from "next/server";
import { Suspense } from "react";
import { BotonImprimir } from "@/components/boton-imprimir";
import { LectorQr } from "@/components/lector-qr";
import { PageFrame } from "@/components/page-frame";
import { QrEnVivo } from "@/components/qr-en-vivo";
import { QrPesaje } from "@/components/qr-pesaje";
import { getDb } from "@/lib/db";
import { listarLotes } from "@/lib/lotes";
import { fichasQrPesajes, retirosDeTags } from "@/lib/pesajes";
import { leerSesion } from "@/lib/usuarios";

export default function Page({ searchParams }: PageProps<"/qr">) {
  return (
    <PageFrame
      titulo="Buscar TAG"
      descripcion="Elige si quieres ver los QR de la materia prima que está en cava o los QR de cada pesaje."
      acciones={<BotonImprimir />}
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Armando etiquetas…</p>}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}

async function Contenido({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const parametros = await searchParams;
  const vista = leer(parametros.vista) === "pesajes" ? "pesajes" : "cava";
  const eliminado = leer(parametros.eliminado).trim();
  const esAdmin = (await leerSesion())?.rango === "administrador";
  const db = getDb();

  return (
    <div className="grid gap-8">
      {eliminado ? (
        <p role="status" className="max-w-xl rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          El TAG {eliminado} quedó eliminado.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3 print:hidden">
        <a
          href="/qr"
          className={`rounded-lg border px-4 py-2 text-sm font-medium ${vista === "cava" ? "border-purolomo-red bg-purolomo-red text-white" : "border-border bg-white text-foreground"}`}
        >
          Materia prima en cava
        </a>
        <a
          href="/qr?vista=pesajes"
          className={`rounded-lg border px-4 py-2 text-sm font-medium ${vista === "pesajes" ? "border-purolomo-red bg-purolomo-red text-white" : "border-border bg-white text-foreground"}`}
        >
          Pesajes
        </a>
      </div>
      {vista === "pesajes" ? <Pesajes /> : <Cava />}
    </div>
  );

  async function Cava() {
    const lotes = await listarLotes(db, { limite: 300 });
    const retiros = await retirosDeTags(
      db,
      lotes.map((lote) => lote.tag),
    );
    const etiquetas = lotes.map((lote) => ({
      lote,
      retiros: retiros.get(lote.tag) ?? [],
    }));
    return (
      <>
        <LectorQr />
        <QrEnVivo etiquetas={etiquetas} puedeEliminar={esAdmin} />
      </>
    );
  }

  async function Pesajes() {
    const fichas = await fichasQrPesajes(db);
    if (fichas.length === 0) {
      return (
        <p className="rounded-xl bg-[#f4f6f8] px-4 py-8 text-center text-base text-muted-foreground">
          Todavía no hay pesajes con retiros para generar su QR.
        </p>
      );
    }
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {fichas.map((ficha) => (
          <QrPesaje key={ficha.id} ficha={ficha} />
        ))}
      </div>
    );
  }
}

function leer(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}
