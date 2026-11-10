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
import { buscarLotes, listarMovimientos } from "@/lib/lotes";
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
  const movimientos = await listarMovimientos(db, "transferencia", 300);
  const lotes = await buscarLotes(
    db,
    movimientos.map((movimiento) => movimiento.tag),
  );
  const filas = movimientos.map((movimiento) => {
    const lote = lotes.get(movimiento.tag);
    const catalogo = lote ? productoPorCodigo(lote.codigo) : null;
    return {
      ...movimiento,
      producto: lote?.producto ?? "—",
      tipo: catalogo?.tipo ?? "—",
    };
  });

  return (
    <Card>
      <CardContent className="min-w-0 pt-4">
        {filas.length === 0 ? (
          <p className="rounded-xl bg-[#f4f6f8] px-4 py-8 text-center text-base text-muted-foreground">
            Todavía no hay salidas hacia logística.
          </p>
        ) : (
          <>
          <div className="grid gap-3 md:hidden">
            {filas.map((fila) => (
              <article key={fila.id} className="grid gap-1 rounded-xl border p-4 text-sm">
                <Link href={`/lote/${fila.tag}`} className="font-mono text-lg font-semibold hover:underline">
                  {fila.tag}
                </Link>
                <p className="font-medium">{fila.producto}</p>
                <p className="text-muted-foreground">
                  {fila.tipo} · {formatoFecha(fila.fecha)} · {fila.semana}
                </p>
                <p className="font-semibold tabular-nums">{formatoKg(fila.kg)}</p>
                <p className="text-xs">{fila.nota || "—"}</p>
              </article>
            ))}
          </div>
          <div className="hidden md:block">
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
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
