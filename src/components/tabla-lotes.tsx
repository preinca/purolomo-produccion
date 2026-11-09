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
    <>
    <div className="grid gap-3 md:hidden">
      {lotes.map((lote) => {
        const tipo = productoPorCodigo(lote.codigo);
        return (
          <article key={lote.tag} className="grid gap-2 rounded-xl border bg-white p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/lote/${lote.tag}`} className="font-mono text-lg font-semibold hover:underline">
                {lote.tag}
              </Link>
              {mostrarEstado ? <EstadoBadge estado={lote.estado} /> : null}
            </div>
            <p className="font-medium">{lote.producto}</p>
            <p className="text-xs text-muted-foreground">
              {tipo ? `${tipo.tipo} · ${tipo.descripcion}` : lote.codigo}
              {lote.destino ? ` · Para ${lote.destino}` : ""}
            </p>
            <p className="text-muted-foreground">
              {formatoFecha(lote.fecha)} · {lote.semana}
            </p>
            <p className="font-mono text-xs">{lote.codigo}</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <p>
                <span className="block text-muted-foreground">Recibidos</span>
                <span className="font-semibold tabular-nums">{formatoKg(lote.kgRecibidos)}</span>
              </p>
              <p>
                <span className="block text-muted-foreground">Consumidos</span>
                <span className="font-semibold tabular-nums">{formatoKg(kgConsumidosDe(lote))}</span>
              </p>
              <p>
                <span className="block text-muted-foreground">Disponibles</span>
                <span className="font-semibold tabular-nums">{formatoKg(kgDisponiblesDe(lote))}</span>
              </p>
            </div>
            {lote.observaciones.trim() ? (
              <p className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-950">
                {lote.observaciones.trim()}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
    <div className="hidden md:block">
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
          <TableHead>Observación</TableHead>
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
              <TableCell className="max-w-64 whitespace-normal">
                {lote.observaciones.trim() ? (
                  <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-950">
                    {lote.observaciones.trim()}
                  </span>
                ) : (
                  "—"
                )}
              </TableCell>
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
    </div>
    </>
  );
}
