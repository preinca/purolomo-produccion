import { connection } from "next/server";
import { Suspense } from "react";
import { MovimientoForm } from "@/components/movimiento-form";
import { PageFrame } from "@/components/page-frame";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb } from "@/lib/db";
import { fechaHoy, formatoFecha, formatoKg } from "@/lib/formato";
import { listarMovimientos } from "@/lib/lotes";

export default function Page({ searchParams }: PageProps<"/salidas">) {
  return (
    <PageFrame
      titulo="Registrar salidas"
      descripcion="Descuenta kilos despachados de un TAG. El QR de esa paleta queda con los kilos actualizados."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <Salidas searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}

async function Salidas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const parametros = await searchParams;
  const tag = Array.isArray(parametros.tag) ? parametros.tag[0] ?? "" : parametros.tag ?? "";
  const movimientos = listarMovimientos(getDb(), "despacho", 30);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[26rem_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Despacho</CardTitle>
          <CardDescription>No se puede despachar más de lo que resta en la paleta.</CardDescription>
        </CardHeader>
        <CardContent>
          <MovimientoForm tipo="despacho" hoy={fechaHoy()} tagInicial={tag} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Últimas salidas</CardTitle>
        </CardHeader>
        <CardContent>
          {movimientos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay despachos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>TAG</TableHead>
                  <TableHead className="text-right">Kg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimientos.map((mov) => (
                  <TableRow key={mov.id}>
                    <TableCell>{formatoFecha(mov.fecha)}</TableCell>
                    <TableCell className="font-mono">{mov.tag}</TableCell>
                    <TableCell className="text-right">{formatoKg(mov.kg)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
