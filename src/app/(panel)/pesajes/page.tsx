import { connection } from "next/server";
import { Suspense } from "react";
import { PageFrame } from "@/components/page-frame";
import { Card, CardContent } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { DESTINOS, destinoValido } from "@/lib/destinos";
import { fechaValida, formatoFecha, formatoKg } from "@/lib/formato";
import { planillaDeProducto } from "@/lib/pesajes";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PageFrame
      titulo="Registro de pesajes"
      descripcion="Elige el producto y, si quieres, un día. El PDF trae esos pesajes y los kg totales consumidos, con espacio para la firma del pesador y del supervisor."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando planilla…</p>}>
        <Planilla searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}

async function Planilla({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const parametros = await searchParams;
  const pedido = leer(parametros.producto);
  const pedidoFecha = leer(parametros.fecha);
  const producto = destinoValido(pedido) ? pedido : "ALIBAL 1 K";
  const fecha = fechaValida(pedidoFecha) ? pedidoFecha : "";
  const planilla = await planillaDeProducto(getDb(), producto);
  const filas = fecha ? planilla.filas.filter((fila) => fila.fecha === fecha) : planilla.filas;
  const totalConsumido = Math.round(filas.reduce((suma, fila) => suma + fila.total, 0) * 1000) / 1000;
  const consulta = `producto=${encodeURIComponent(producto)}${fecha ? `&fecha=${fecha}` : ""}`;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-3">
        {DESTINOS.map((destino) => (
          <a
            key={destino}
            href={`/pesajes?producto=${encodeURIComponent(destino)}${fecha ? `&fecha=${fecha}` : ""}`}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              destino === producto
                ? "border-purolomo-red bg-purolomo-red text-white"
                : "border-border bg-white text-foreground hover:bg-muted"
            }`}
          >
            {destino}
          </a>
        ))}
      </div>
      <form action="/pesajes" className="grid gap-3 sm:flex sm:flex-wrap sm:items-end">
        <input type="hidden" name="producto" value={producto} />
        <label className="grid gap-1.5 text-sm font-medium" htmlFor="fecha-pesajes">
          Día
          <input
            id="fecha-pesajes"
            name="fecha"
            type="date"
            defaultValue={fecha}
            className="h-11 rounded-lg border border-input bg-white px-3 text-base"
          />
        </label>
        <button type="submit" className="h-11 w-full rounded-lg border border-border bg-white px-4 text-sm font-medium hover:bg-muted sm:w-auto">
          Ver ese día
        </button>
        {fecha ? (
          <a
            href={`/pesajes?producto=${encodeURIComponent(producto)}`}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-medium hover:bg-muted sm:w-auto"
          >
            Todos los días
          </a>
        ) : null}
        <a
          href={`/pesajes/pdf?${consulta}`}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80 sm:w-auto"
        >
          {fecha ? "Descargar PDF del día" : "Descargar PDF"}
        </a>
      </form>
      <Card>
        <CardContent className="min-w-0 overflow-x-auto pt-4">
          {filas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {fecha ? `No hay pesajes de ${producto} el ${formatoFecha(fecha)}.` : `Todavía no hay pesajes de ${producto}.`}
            </p>
          ) : (
            <>
            <p className="mb-4 text-base font-semibold">Kg totales consumidos: {formatoKg(totalConsumido)}</p>
            <div className="grid gap-3 md:hidden">
              {filas.map((fila) => (
                <article key={fila.id} className="grid gap-3 rounded-xl border p-4 text-sm">
                  <div>
                    <p className="text-lg font-semibold">Pesaje {fila.numero}</p>
                    {fila.codigo ? <p className="mt-1 font-mono text-xs leading-5 break-all">{fila.codigo}</p> : null}
                  </div>
                  <p className="text-muted-foreground">
                    {formatoFecha(fila.fecha)}{fila.hora ? ` ${fila.hora}` : ""} · Línea {fila.linea} · {fila.destino}
                  </p>
                  {fila.observaciones.trim() ? (
                    <p className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-950">
                      {fila.observaciones.trim()}
                    </p>
                  ) : null}
                  {fila.celdas.map((celda) =>
                    celda.aportes.length === 0 ? null : (
                      <div key={`${fila.id}-${celda.tipo}`} className="grid gap-2">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{celda.tipo}</p>
                        {celda.aportes.map((aporte) => (
                          <div key={aporte.token} className="rounded-lg bg-muted px-3 py-2">
                            <p className="font-semibold tabular-nums">{formatoKg(aporte.kg)}</p>
                            <p className="text-xs">TAG <span className="font-mono">{aporte.tag}</span></p>
                            <p className="text-xs">Mini lote <span className="font-mono">{aporte.token}</span></p>
                          </div>
                        ))}
                        {celda.aportes.length > 1 ? (
                          <p className="text-sm font-semibold">Suma {celda.tipo}: {formatoKg(celda.kg)}</p>
                        ) : null}
                      </div>
                    ),
                  )}
                  <p className="text-base font-semibold">Total {formatoKg(fila.total)}</p>
                </article>
              ))}
            </div>
            <table className="hidden w-full min-w-[56rem] border-collapse text-sm md:table">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-3 py-3 font-medium">Pesaje</th>
                  <th className="px-3 py-3 font-medium">Fecha</th>
                  <th className="px-3 py-3 font-medium">Línea</th>
                  <th className="px-3 py-3 font-medium">Uso</th>
                  <th className="px-3 py-3 font-medium">Observación</th>
                  {planilla.tipos.map((tipo) => (
                    <th key={tipo} className="px-3 py-3 font-medium">
                      {tipo}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => (
                  <tr key={fila.id} className="border-b align-top">
                    <td className="px-3 py-3">
                      <p className="text-base font-semibold">{fila.numero}</p>
                      {fila.codigo ? (
                        <p className="mt-2 max-w-64 font-mono text-xs leading-5 font-normal break-all">{fila.codigo}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <p>{formatoFecha(fila.fecha)}</p>
                      {fila.hora ? <p className="text-xs text-muted-foreground">{fila.hora}</p> : null}
                    </td>
                    <td className="px-3 py-3">{fila.linea}</td>
                    <td className="px-3 py-3">{fila.destino}</td>
                    <td className="max-w-64 px-3 py-3 whitespace-normal">
                      {fila.observaciones.trim() ? (
                        <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-950">
                          {fila.observaciones.trim()}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    {fila.celdas.map((celda) => (
                      <td key={`${fila.id}-${celda.tipo}`} className="px-3 py-3">
                        {celda.aportes.length === 0 ? null : (
                          <div className="grid gap-2">
                            {celda.aportes.map((aporte) => (
                              <div key={aporte.token} className="grid gap-1 rounded-lg bg-muted px-3 py-2">
                                <p className="text-sm font-semibold tabular-nums">{formatoKg(aporte.kg)}</p>
                                <p className="text-xs">
                                  <span className="text-muted-foreground">TAG </span>
                                  <span className="font-mono">{aporte.tag}</span>
                                </p>
                                <p className="text-xs">
                                  <span className="text-muted-foreground">Mini lote </span>
                                  <span className="font-mono">{aporte.token}</span>
                                </p>
                              </div>
                            ))}
                            {celda.aportes.length > 1 ? (
                              <p className="rounded-lg border px-3 py-2 text-sm font-semibold tabular-nums">
                                Suma {celda.tipo}: {formatoKg(celda.kg)}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right font-semibold">{formatoKg(fila.total)}</td>
                  </tr>
                ))}
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
