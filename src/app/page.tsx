import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { validarTransferencia } from "@/app/actions";
import { EstadoBadge } from "@/components/estado-badge";
import { PageFrame } from "@/components/page-frame";
import { Button } from "@/components/ui/button";
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
import { formatoFecha, formatoKg, formatoNumero } from "@/lib/formato";
import { listarLotes, resumir } from "@/lib/lotes";
import { productoPorCodigo } from "@/lib/mpc";

export default function Page() {
  return (
    <PageFrame
      titulo="Panel de administración"
      descripcion="Recepción de materia prima cárnica en el almacén de producción. Cada paleta tiene TAG, kilos y un QR generado por la aplicación."
    >
      <Suspense fallback={<Cargando />}>
        <Dashboard />
      </Suspense>
    </PageFrame>
  );
}

async function Dashboard() {
  await connection();
  const db = getDb();
  const resumen = resumir(db);
  const pendientes = listarLotes(db, { estado: "PENDIENTE POR TRANSFERIR", limite: 40 });

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Atención operativa · movimientos pendientes por validar</p>
          <p className="text-sm">
            Entradas pendientes: {resumen.pendientes} paletas · {formatoKg(resumen.kgInventario)} en inventario
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Link
            href="/entradas"
            className="inline-flex h-7 items-center rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground"
          >
            Registrar entrada
          </Link>
          <Link
            href="/qr"
            className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
          >
            Generar QR
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen">
        <Kpi
          titulo="Total paletas"
          valor={formatoNumero(resumen.paletas)}
          detalle="Lotes activos en SQLite"
          color="bg-purolomo-red"
        />
        <Kpi
          titulo="Entradas pendientes"
          valor={formatoNumero(resumen.pendientes)}
          detalle="Por transferir"
          color="bg-amber-400"
        />
        <Kpi
          titulo="Kg recibidos"
          valor={formatoNumero(resumen.kgRecibidos, 0)}
          detalle="Acumulado de recepción"
          color="bg-rose-500"
        />
        <Kpi
          titulo="Kg en inventario"
          valor={formatoNumero(resumen.kgInventario, 0)}
          detalle="Recibido menos despacho y consumo"
          color="bg-yellow-400"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Entradas pendientes por validar transferencia</CardTitle>
        </CardHeader>
        <CardContent>
          {pendientes.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              No hay paletas pendientes. Registra una entrada para generar su QR.
              En tu laptop los datos quedan en el archivo SQLite local{" "}
              <code className="font-mono text-xs">data/produccion.sqlite</code>.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>TAG</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Kg rec.</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right print:hidden">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendientes.map((lote) => {
                  const tipo = productoPorCodigo(lote.codigo);
                  return (
                    <TableRow key={lote.tag}>
                      <TableCell>{formatoFecha(lote.fecha)}</TableCell>
                      <TableCell className="font-mono font-semibold">
                        <Link href={`/lote/${lote.tag}`} className="hover:underline">
                          {lote.tag}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <div>{lote.producto}</div>
                        <div className="text-xs text-muted-foreground">
                          {tipo ? `${tipo.tipo} · ${tipo.descripcion}` : lote.semana}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{lote.codigo}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatoKg(lote.kgRecibidos)}
                      </TableCell>
                      <TableCell>
                        <EstadoBadge estado={lote.estado} />
                      </TableCell>
                      <TableCell className="text-right print:hidden">
                        <form action={validarTransferencia}>
                          <input type="hidden" name="tag" value={lote.tag} />
                          <Button type="submit" size="sm">
                            Validar trf
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Kpi({
  titulo,
  valor,
  detalle,
  color,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  color: string;
}) {
  return (
    <Card size="sm">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {titulo}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
          <p className="text-xs text-muted-foreground">{detalle}</p>
        </div>
        <span className={`size-10 shrink-0 rounded-md ${color}`} />
      </CardHeader>
    </Card>
  );
}

function Cargando() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      <div className="h-16 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="h-80 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
