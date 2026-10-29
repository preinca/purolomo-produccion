import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageFrame } from "@/components/page-frame";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb } from "@/lib/db";
import { formatoFecha, formatoKg } from "@/lib/formato";
import { listarMovimientos } from "@/lib/lotes";

export default function Page() {
  return (
    <PageFrame
      titulo="Historial de salidas"
      descripcion="Despachos y consumos registrados por TAG."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando historial…</p>}>
        <Historial />
      </Suspense>
    </PageFrame>
  );
}

async function Historial() {
  await connection();
  const db = getDb();
  const despachos = listarMovimientos(db, "despacho", 200);
  const consumos = listarMovimientos(db, "consumo", 200);
  const filas = [...despachos, ...consumos].sort((a, b) => b.id - a.id).slice(0, 200);

  return (
    <Card>
      <CardContent className="pt-4">
        {filas.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay salidas ni consumos.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>TAG</TableHead>
                <TableHead className="text-right">Kg</TableHead>
                <TableHead>Nota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((mov) => (
                <TableRow key={mov.id}>
                  <TableCell>{formatoFecha(mov.fecha)}</TableCell>
                  <TableCell className="capitalize">{mov.tipo}</TableCell>
                  <TableCell className="font-mono">
                    <Link href={`/lote/${mov.tag}`} className="hover:underline">
                      {mov.tag}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{formatoKg(mov.kg)}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">
                    {mov.nota || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
