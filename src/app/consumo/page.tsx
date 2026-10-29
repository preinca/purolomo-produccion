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

export default function Page({ searchParams }: PageProps<"/consumo">) {
  return (
    <PageFrame
      titulo="Registrar consumo"
      descripcion="Anota los kilos que producción usa de un TAG. Quedan grabados en SQLite y en el QR de la paleta."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <Consumo searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}

async function Consumo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const parametros = await searchParams;
  const tag = Array.isArray(parametros.tag) ? parametros.tag[0] ?? "" : parametros.tag ?? "";
  const movimientos = listarMovimientos(getDb(), "consumo", 30);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[26rem_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Consumo de producción</CardTitle>
          <CardDescription>Usa el TAG de la paleta que entra a receta.</CardDescription>
        </CardHeader>
        <CardContent>
          <MovimientoForm tipo="consumo" hoy={fechaHoy()} tagInicial={tag} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Últimos consumos</CardTitle>
        </CardHeader>
        <CardContent>
          {movimientos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay consumos por TAG.</p>
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
