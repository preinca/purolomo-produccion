import { connection } from "next/server";
import { Suspense } from "react";
import { enlacePdf, EtiquetaCava } from "@/components/etiqueta-cava";
import { PageFrame } from "@/components/page-frame";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb } from "@/lib/db";
import { etiquetaDeLote } from "@/lib/etiqueta-cava";
import { buscarLote, listarLotesPorRecepcion } from "@/lib/lotes";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PageFrame
      titulo="Etiquetas en Cava"
      descripcion="Historial de las etiquetas que se generan al registrar cada entrada. Cada una lleva el QR, la fecha y hora de recepción, el producto y el código del catálogo."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando etiquetas…</p>}>
        <Historial searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}

async function Historial({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const parametros = await searchParams;
  const pedido = leer(parametros.tag);
  const db = getDb();
  const lotes = await listarLotesPorRecepcion(db);
  const elegido = /^\d{4,8}$/.test(pedido) ? await buscarLote(db, pedido) : null;
  const visible = elegido ?? lotes[0] ?? null;

  return (
    <div className="grid gap-8">
      {visible ? (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Etiqueta {visible.tag}</CardTitle>
            <a
              href={enlacePdf(visible.tag)}
              download={`etiqueta-${visible.tag}.pdf`}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80 sm:w-auto"
            >
              Descargar PDF
            </a>
          </CardHeader>
          <CardContent>
            <EtiquetaCava lote={visible} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Todavía no hay etiquetas.</p>
      )}

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          <div className="grid gap-3 md:hidden">
            {lotes.map((lote) => {
              const etiqueta = etiquetaDeLote(lote);
              return (
                <article key={lote.tag} className="grid gap-2 rounded-xl border p-4 text-sm">
                  <p className="font-mono text-lg font-semibold">{etiqueta.tag}</p>
                  <p>{etiqueta.producto}</p>
                  <p className="text-xs text-muted-foreground">
                    {etiqueta.fecha} · {etiqueta.hora}
                    {etiqueta.descripcion ? ` · ${etiqueta.descripcion}` : ""}
                  </p>
                  <p className="font-mono text-xs">{etiqueta.codigo}</p>
                  <div className="flex gap-4">
                    <a href={`/etiquetas?tag=${etiqueta.tag}`} className="font-medium underline">Ver</a>
                    <a href={enlacePdf(etiqueta.tag)} download={`etiqueta-${etiqueta.tag}.pdf`} className="font-medium underline">PDF</a>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TAG</TableHead>
                <TableHead>Recepción</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>Todavía no hay etiquetas.</TableCell>
                </TableRow>
              ) : (
                lotes.map((lote) => {
                  const etiqueta = etiquetaDeLote(lote);
                  return (
                    <TableRow key={lote.tag}>
                      <TableCell className="font-mono font-semibold">{etiqueta.tag}</TableCell>
                      <TableCell>
                        {etiqueta.fecha}
                        <span className="block text-xs text-muted-foreground">{etiqueta.hora}</span>
                      </TableCell>
                      <TableCell>
                        {etiqueta.producto}
                        {etiqueta.descripcion ? (
                          <span className="block text-xs text-muted-foreground">{etiqueta.descripcion}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{etiqueta.codigo}</TableCell>
                      <TableCell className="text-right">
                        <a href={`/etiquetas?tag=${etiqueta.tag}`} className="mr-3 text-sm font-medium underline">
                          Ver
                        </a>
                        <a href={enlacePdf(etiqueta.tag)} download={`etiqueta-${etiqueta.tag}.pdf`} className="text-sm font-medium underline">
                          PDF
                        </a>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function leer(valor: string | string[] | undefined) {
  return (Array.isArray(valor) ? valor[0] : valor ?? "").trim();
}
