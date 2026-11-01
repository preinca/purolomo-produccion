import Link from "next/link";
import { EstadoBadge } from "@/components/estado-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatoFecha, formatoKg } from "@/lib/formato";
import { kgConsumidosDe, kgDisponiblesDe, type Lote } from "@/lib/lotes";
import { productoPorCodigo } from "@/lib/mpc";

export function TablaLotes({
  lotes,
  vacio,
  mostrarEstado = true,
}: {
  lotes: Lote[];
  vacio: string;
  mostrarEstado?: boolean;
}) {
  if (lotes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        {vacio}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Semana</TableHead>
          <TableHead>TAG</TableHead>
          <TableHead>Producto</TableHead>
          <TableHead>Código</TableHead>
          <TableHead className="text-right">Kg rec.</TableHead>
          <TableHead className="text-right">Kg consumidos</TableHead>
          <TableHead className="text-right">Kg disponibles</TableHead>
          {mostrarEstado ? <TableHead>Estado</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {lotes.map((lote) => {
          const tipo = productoPorCodigo(lote.codigo);
          return (
            <TableRow key={lote.tag}>
              <TableCell>{formatoFecha(lote.fecha)}</TableCell>
              <TableCell>{lote.semana}</TableCell>
              <TableCell className="font-mono font-semibold">
                <Link href={`/lote/${lote.tag}`} className="hover:underline">
                  {lote.tag}
                </Link>
              </TableCell>
              <TableCell className="whitespace-normal">
                <div>{lote.producto}</div>
                <div className="text-xs text-muted-foreground">
                  {tipo ? `${tipo.tipo} · ${tipo.descripcion}` : ""}
                </div>
                {lote.destino ? (
                  <div className="text-xs text-muted-foreground">Para {lote.destino}</div>
                ) : null}
              </TableCell>
              <TableCell className="font-mono text-xs">{lote.codigo}</TableCell>
              <TableCell className="text-right tabular-nums">{formatoKg(lote.kgRecibidos)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatoKg(kgConsumidosDe(lote))}</TableCell>
              <TableCell className="text-right tabular-nums">{formatoKg(kgDisponiblesDe(lote))}</TableCell>
              {mostrarEstado ? (
                <TableCell>
                  <EstadoBadge estado={lote.estado} />
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
