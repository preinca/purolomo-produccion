import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageFrame } from "@/components/page-frame";
import { Card, CardContent } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { fechaValida, formatoFecha, formatoHora, formatoKg } from "@/lib/formato";
import { listarEntradas } from "@/lib/lotes";
import { PRODUCTOS_MPC, productoPorCodigo } from "@/lib/mpc";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PageFrame
      titulo="Registro de entrada"
      descripcion="Las recepciones quedan en orden. Elige un producto y un día para verlas, y descarga el PDF de ese día."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando registro…</p>}>
        <Registro searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}

async function Registro({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const parametros = await searchParams;
  const pedidoCodigo = leer(parametros.producto);
  const pedidoFecha = leer(parametros.fecha);
  const producto = PRODUCTOS_MPC.find((item) => item.codigo === pedidoCodigo) ?? null;
  const codigo = producto?.codigo ?? "";
  const fecha = fechaValida(pedidoFecha) ? pedidoFecha : "";
  const lotes = await listarEntradas(getDb(), { codigo, fecha });
  const total = Math.round(lotes.reduce((suma, lote) => suma + lote.kgRecibidos, 0) * 1000) / 1000;
  const consulta = `producto=${encodeURIComponent(codigo)}${fecha ? `&fecha=${fecha}` : ""}`;

  return (
    <div className="grid gap-6">
      <form action="/registro-entrada" className="grid gap-3 sm:flex sm:flex-wrap sm:items-end">
        <label className="grid gap-1.5 text-sm font-medium" htmlFor="producto-entrada">
          Producto
          <select
            id="producto-entrada"
            name="producto"
            defaultValue={codigo}
            className="h-11 min-w-64 rounded-lg border border-input bg-white px-3 text-base"
          >
            <option value="">Todos los productos</option>
            {PRODUCTOS_MPC.map((item) => (
              <option key={item.codigo} value={item.codigo}>
                {item.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium" htmlFor="fecha-entrada">
          Día
          <input
            id="fecha-entrada"
            name="fecha"
            type="date"
            defaultValue={fecha}
            className="h-11 rounded-lg border border-input bg-white px-3 text-base"
          />
        </label>
        <button
          type="submit"
          className="h-11 w-full rounded-lg border border-border bg-white px-4 text-sm font-medium hover:bg-muted sm:w-auto"
        >
          Ver registro
        </button>
        {fecha || codigo ? (
          <a
            href="/registro-entrada"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-medium hover:bg-muted sm:w-auto"
          >
            Ver todas
          </a>
        ) : null}
        {fecha ? (
          <a
            href={`/registro-entrada/pdf?${consulta}`}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80 sm:w-auto"
          >
            Descargar PDF del día
          </a>
        ) : null}
      </form>
      <Card>
        <CardContent className="min-w-0 overflow-x-auto pt-4">
          {lotes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {fecha
                ? `No hay entradas${producto ? ` de ${producto.nombre}` : ""} el ${formatoFecha(fecha)}.`
                : "Todavía no hay entradas con ese filtro."}
            </p>
          ) : (
            <>
              <p className="mb-4 text-base font-semibold">Kg totales recibidos: {formatoKg(total)}</p>
              <div className="grid gap-3 md:hidden">
                {lotes.map((lote) => {
                  const catalogo = productoPorCodigo(lote.codigo);
                  return (
                    <article key={lote.tag} className="grid gap-1 rounded-xl border p-4 text-sm">
                      <Link href={`/lote/${lote.tag}`} className="font-mono text-lg font-semibold hover:underline">
                        {lote.tag}
                      </Link>
                      <p className="font-medium">{catalogo?.nombre ?? lote.producto}</p>
                      <p className="text-muted-foreground">
                        {catalogo?.tipo ?? "—"} · {lote.codigo} · {formatoFecha(lote.fecha)} {formatoHora(lote.creadoEn)}
                      </p>
                      <p className="font-semibold tabular-nums">{formatoKg(lote.kgRecibidos)}</p>
                      <p className="text-xs">{lote.destino || "Sin destino"} · {lote.observaciones.trim() || "—"}</p>
                    </article>
                  );
                })}
              </div>
              <table className="hidden w-full min-w-[56rem] border-collapse text-sm md:table">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-3 py-3 font-medium">Fecha</th>
                    <th className="px-3 py-3 font-medium">Hora</th>
                    <th className="px-3 py-3 font-medium">TAG</th>
                    <th className="px-3 py-3 font-medium">Producto</th>
                    <th className="px-3 py-3 font-medium">Código</th>
                    <th className="px-3 py-3 text-right font-medium">Kg</th>
                    <th className="px-3 py-3 font-medium">Para</th>
                    <th className="px-3 py-3 font-medium">Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {lotes.map((lote) => {
                    const catalogo = productoPorCodigo(lote.codigo);
                    return (
                      <tr key={lote.tag} className="border-b align-top">
                        <td className="px-3 py-3">{formatoFecha(lote.fecha)}</td>
                        <td className="px-3 py-3">{formatoHora(lote.creadoEn) || "—"}</td>
                        <td className="px-3 py-3 font-mono">
                          <Link href={`/lote/${lote.tag}`} className="hover:underline">
                            {lote.tag}
                          </Link>
                        </td>
                        <td className="px-3 py-3">{catalogo?.nombre ?? lote.producto}</td>
                        <td className="px-3 py-3 font-mono text-xs">{lote.codigo}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatoKg(lote.kgRecibidos)}</td>
                        <td className="px-3 py-3">{lote.destino || "—"}</td>
                        <td className="max-w-64 px-3 py-3 whitespace-normal">{lote.observaciones.trim() || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function leer(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}
