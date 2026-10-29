import { connection } from "next/server";
import { Suspense } from "react";
import { PageFrame } from "@/components/page-frame";
import { TablaLotes } from "@/components/tabla-lotes";
import { Card, CardContent } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { listarLotes } from "@/lib/lotes";

export default function Page({ searchParams }: PageProps<"/stock">) {
  return (
    <PageFrame
      titulo="Consultar stock"
      descripcion="Busca paletas por TAG, producto, código o semana. El inventario vive en SQLite."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando stock…</p>}>
        <Stock searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}

async function Stock({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const parametros = await searchParams;
  const q = Array.isArray(parametros.q) ? parametros.q[0] ?? "" : parametros.q ?? "";
  const estado = Array.isArray(parametros.estado)
    ? parametros.estado[0] ?? ""
    : parametros.estado ?? "";
  const lotes = listarLotes(getDb(), { q, estado, limite: 300 });

  return (
    <>
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" action="/stock">
        <label className="grid min-w-0 flex-1 gap-1.5 text-sm font-medium">
          Buscar
          <input
            name="q"
            defaultValue={q}
            placeholder="TAG, CDM SP DD, MPCM01047…"
            className="h-8 rounded-lg border border-input bg-card px-2.5 text-sm font-normal"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Estado
          <select
            name="estado"
            defaultValue={estado}
            className="h-8 rounded-lg border border-input bg-card px-2.5 text-sm font-normal"
          >
            <option value="">Todos</option>
            <option value="PENDIENTE POR TRANSFERIR">Pendiente por transferir</option>
            <option value="TRANSFIRIO">Transfirió</option>
            <option value="RECIBIDO">Recibido</option>
            <option value="CONSUMIDOS">Consumidos</option>
            <option value="DEVUELTO">Devuelto</option>
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          Filtrar
        </button>
      </form>
      <Card>
        <CardContent className="pt-4">
          <TablaLotes
            lotes={lotes}
            vacio={q || estado ? "Ningún lote coincide con esa búsqueda." : "La base todavía no tiene paletas."}
          />
        </CardContent>
      </Card>
    </>
  );
}
