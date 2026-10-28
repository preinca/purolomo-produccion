import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BotonImprimir } from "@/components/boton-imprimir";
import { EstadoBadge } from "@/components/estado-badge";
import { PageFrame } from "@/components/page-frame";
import { QrEtiqueta } from "@/components/qr-etiqueta";
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
import { formatoFecha, formatoHora, formatoKg } from "@/lib/formato";
import { buscarLote, kgRestantes, movimientosDeTag } from "@/lib/lotes";
import { productoPorCodigo } from "@/lib/mpc";

export default function Page({ params }: PageProps<"/lote/[tag]">) {
  return (
    <Suspense fallback={<p className="px-6 py-8 text-sm text-muted-foreground">Abriendo paleta…</p>}>
      <Detalle params={params} />
    </Suspense>
  );
}

async function Detalle({ params }: { params: Promise<{ tag: string }> }) {
  await connection();
  const { tag } = await params;
  const lote = buscarLote(getDb(), tag);
  if (!lote) notFound();
  const tipo = productoPorCodigo(lote.codigo);
  const movimientos = movimientosDeTag(getDb(), lote.tag);

  return (
    <PageFrame
      titulo={`TAG ${lote.tag}`}
      descripcion={`${lote.producto} · ${lote.codigo}${tipo ? ` · ${tipo.tipo} ${tipo.descripcion}` : ""}`}
      acciones={
        <>
          <BotonImprimir etiqueta="Imprimir QR" />
          <Link
            href={`/salidas?tag=${lote.tag}`}
            className="inline-flex h-8 items-center rounded-lg border px-2.5 text-sm font-medium hover:bg-muted"
          >
            Despachar
          </Link>
          <Link
            href={`/consumo?tag=${lote.tag}`}
            className="inline-flex h-8 items-center rounded-lg border px-2.5 text-sm font-medium hover:bg-muted"
          >
            Consumir
          </Link>
        </>
      }
    >
      <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
        <QrEtiqueta lote={lote} />
        <div className="grid gap-4">
          <section className="grid gap-3 sm:grid-cols-3">
            <Ficha titulo="Kg recibidos" valor={formatoKg(lote.kgRecibidos)} />
            <Ficha titulo="Kg despachados" valor={formatoKg(lote.kgDespachados)} />
            <Ficha titulo="Kg consumidos" valor={formatoKg(lote.kgConsumidos)} />
          </section>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Estado</CardTitle>
              <EstadoBadge estado={lote.estado} />
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {formatoFecha(lote.fecha)} · {lote.semana} · restan {formatoKg(kgRestantes(lote))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Movimientos</CardTitle>
            </CardHeader>
            <CardContent>
              {movimientos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin movimientos.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Kg</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimientos.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell>
                          {formatoFecha(mov.fecha)} {formatoHora(mov.creadoEn)}
                        </TableCell>
                        <TableCell className="capitalize">{mov.tipo}</TableCell>
                        <TableCell className="text-right">{formatoKg(mov.kg)}</TableCell>
                        <TableCell>{mov.estado}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageFrame>
  );
}

function Ficha({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <p className="text-xs text-muted-foreground">{titulo}</p>
        <p className="text-lg font-semibold">{valor}</p>
      </CardHeader>
    </Card>
  );
}
