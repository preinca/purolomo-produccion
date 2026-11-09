import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { guardarObservacionTagFormulario } from "@/app/actions";
import { BotonImprimir } from "@/components/boton-imprimir";
import { EstadoBadge } from "@/components/estado-badge";
import { FormObservacion } from "@/components/form-observacion";
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
import { lineaPorId } from "@/lib/lineas";
import { buscarLote, kgConsumidosDe, kgDisponiblesDe, kgRestantes, movimientosDeTag, tagAgotado } from "@/lib/lotes";
import { productoPorCodigo } from "@/lib/mpc";
import { retirosDeTag } from "@/lib/pesajes";
import { leerSesion } from "@/lib/usuarios";

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
  const db = getDb();
  const lote = buscarLote(db, tag);
  if (!lote) notFound();
  const rango = (await leerSesion())?.rango;
  const puedeAvisar = rango === "administrador" || rango === "recepcionista";
  const tipo = productoPorCodigo(lote.codigo);
  const movimientos = movimientosDeTag(db, lote.tag);
  const retiros = retirosDeTag(db, lote.tag);

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
        </>
      }
    >
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <QrEtiqueta lote={lote} retiros={retiros} />
        <div className="grid gap-4">
          <section className="grid gap-3 sm:grid-cols-3">
            <Ficha titulo="Kg recibidos" valor={formatoKg(lote.kgRecibidos)} />
            <Ficha titulo="Kg consumidos" valor={formatoKg(kgConsumidosDe(lote))} />
            <Ficha titulo="Kg disponibles" valor={formatoKg(kgDisponiblesDe(lote))} />
          </section>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Estado</CardTitle>
              <EstadoBadge estado={lote.estado} />
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <p>
                {formatoFecha(lote.fecha)} · {lote.semana} · disponibles {formatoKg(kgRestantes(lote))}
                {lote.destino ? ` · para ${lote.destino}` : ""}
              </p>
              {lote.estado === "LOGISTICA" ? (
                <p className="rounded-lg bg-orange-500 px-3 py-2 font-medium text-white">
                  Este TAG fue trasladado a logística y ya no se puede consumir.
                </p>
              ) : tagAgotado(lote) ? (
                <p className="rounded-lg bg-red-600 px-3 py-2 font-medium text-white">
                  Se acabaron todos los kg de esta materia prima.
                </p>
              ) : null}
            </CardContent>
          </Card>
          {lote.observaciones.trim() ? (
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-950">
              Observación: {lote.observaciones.trim()}
            </p>
          ) : null}
          {puedeAvisar ? (
            <Card>
              <CardHeader>
                <CardTitle>Observación del TAG</CardTitle>
              </CardHeader>
              <CardContent>
                <FormObservacion
                  key={`${lote.tag}-${lote.observaciones}`}
                  accion={guardarObservacionTagFormulario}
                  campoId="tag"
                  id={lote.tag}
                  valor={lote.observaciones}
                  etiqueta="Aviso de esta materia prima"
                />
              </CardContent>
            </Card>
          ) : null}
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
                      <TableHead>Producto</TableHead>
                      <TableHead>Línea</TableHead>
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
                        <TableCell>{mov.destino || "—"}</TableCell>
                        <TableCell>{lineaPorId(mov.linea)?.nombre ?? "—"}</TableCell>
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
