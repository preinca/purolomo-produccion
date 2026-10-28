import { connection } from "next/server";
import { Suspense } from "react";
import { BotonImprimir } from "@/components/boton-imprimir";
import { PageFrame } from "@/components/page-frame";
import { QrEtiqueta } from "@/components/qr-etiqueta";
import { getDb } from "@/lib/db";
import { listarLotes } from "@/lib/lotes";

export default function Page({ searchParams }: PageProps<"/qr">) {
  return (
    <PageFrame
      titulo="Generar QR / Etiquetas"
      descripcion="Cada etiqueta lleva fecha, semana, TAG, tipo, código, kilos recibidos, despachados, consumidos y el estado."
      acciones={<BotonImprimir />}
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Armando etiquetas…</p>}>
        <Etiquetas searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}

async function Etiquetas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const parametros = await searchParams;
  const q = Array.isArray(parametros.q) ? parametros.q[0] ?? "" : parametros.q ?? "";
  const lotes = listarLotes(getDb(), {
    q,
    estado: q ? undefined : "PENDIENTE POR TRANSFERIR",
    limite: 24,
  });

  return (
    <>
      <form action="/qr" className="flex flex-col gap-2 print:hidden sm:flex-row sm:items-end">
        <label className="grid min-w-0 flex-1 gap-1.5 text-sm font-medium">
          TAG o producto
          <input
            name="q"
            defaultValue={q}
            placeholder="Deja vacío para ver las pendientes"
            className="h-8 rounded-lg border border-input bg-card px-2.5 text-sm font-normal"
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          Buscar
        </button>
      </form>
      {lotes.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No hay paletas para etiquetar.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lotes.map((lote) => (
            <QrEtiqueta key={lote.tag} lote={lote} />
          ))}
        </div>
      )}
    </>
  );
}
