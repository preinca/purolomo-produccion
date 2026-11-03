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
import { buscarLote, listarMovimientos } from "@/lib/lotes";
import { productoPorCodigo } from "@/lib/mpc";

export default function Page() {
  return (
    <PageFrame
      titulo="Registro de Logística"
      descripcion="Relación de las salidas de materia prima que se trasladaron a logística."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <Registro />
      </Suspense>
    </PageFrame>
  );
}

async function Registro() {
  await connection();
  const db = getDb();
  const filas = listarMovimientos(db, "transferencia", 300).map((movimiento) => {
    const lote = buscarLote(db, movimiento.tag);
    const catalogo = lote ? productoPorCodigo(lote.codigo) : null;
    return {
      ...movimiento,
      producto: lote?.producto ?? "—",
      tipo: catalogo?.tipo ?? "—",
    };
  });

  return (
    <Card>
      <CardContent className="pt-4">
        {filas.length === 0 ? (
          <p className="rounded-xl bg-[#f4f6f8] px-4 py-8 text-center text-base text-muted-foreground">
            Todavía no hay salidas hacia logística.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Semana</TableHead>
                <TableHead>TAG</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Kg</TableHead>
                <TableHead>Observación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((fila) => (
                <TableRow key={fila.id}>
                  <TableCell>{formatoFecha(fila.fecha)}</TableCell>
                  <TableCell>{fila.semana}</TableCell>
                  <TableCell className="font-mono">
                    <Link href={`/lote/${fila.tag}`} className="hover:underline">
                      {fila.tag}
                    </Link>
                  </TableCell>
                  <TableCell className="font-semibold">{fila.tipo}</TableCell>
                  <TableCell>{fila.producto}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoKg(fila.kg)}</TableCell>
                  <TableCell className="whitespace-normal">{fila.nota || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
