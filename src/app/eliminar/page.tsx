import { connection } from "next/server";
import { Suspense } from "react";
import { EliminarLoteForm } from "@/components/eliminar-lote-form";
import { EstadoBadge } from "@/components/estado-badge";
import { PageFrame } from "@/components/page-frame";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { formatoFecha, formatoKg } from "@/lib/formato";
import { buscarLote } from "@/lib/lotes";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PageFrame
      titulo="Eliminar lote"
      descripcion="Busca el TAG y confirma. Se borra la paleta y todos sus movimientos."
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
  const tag = texto(parametros.tag).trim();
  const eliminado = texto(parametros.eliminado).trim();
  const lote = tag ? buscarLote(getDb(), tag) : null;

  return (
    <div className="grid max-w-xl gap-4">
      {eliminado ? (
        <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          El lote {eliminado} quedó eliminado.
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Buscar TAG</CardTitle>
          <CardDescription>Escribe el número de la paleta que quieres quitar.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/eliminar" className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="grid min-w-0 flex-1 gap-1.5 text-sm font-medium">
              TAG
              <input
                name="tag"
                defaultValue={tag}
                inputMode="numeric"
                placeholder="Número de paleta"
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
        </CardContent>
      </Card>
      {tag && !lote ? (
        <p className="text-sm text-muted-foreground">No hay un lote con el TAG {tag}.</p>
      ) : null}
      {lote ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-mono">{lote.tag}</CardTitle>
            <CardDescription>
              {lote.producto} · {lote.codigo}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <Dato etiqueta="Fecha" valor={formatoFecha(lote.fecha)} />
              <Dato etiqueta="Semana" valor={lote.semana} />
              <Dato etiqueta="Kg recibidos" valor={formatoKg(lote.kgRecibidos)} />
              <Dato etiqueta="Kg despachados" valor={formatoKg(lote.kgDespachados)} />
              <Dato etiqueta="Kg consumidos" valor={formatoKg(lote.kgConsumidos)} />
              <div>
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Estado</dt>
                <dd className="mt-1">
                  <EstadoBadge estado={lote.estado} />
                </dd>
              </div>
            </dl>
            {lote.observaciones ? (
              <p className="text-sm text-muted-foreground">{lote.observaciones}</p>
            ) : null}
            <EliminarLoteForm tag={lote.tag} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{etiqueta}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
