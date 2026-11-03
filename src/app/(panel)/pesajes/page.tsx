import { connection } from "next/server";
import { Suspense } from "react";
import { guardarObservacionPesajeFormulario } from "@/app/actions";
import { FormObservacion } from "@/components/form-observacion";
import { PageFrame } from "@/components/page-frame";
import { Card, CardContent } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { DESTINOS, destinoValido } from "@/lib/destinos";
import { formatoFecha, formatoKg } from "@/lib/formato";
import { planillaDeProducto } from "@/lib/pesajes";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PageFrame
      titulo="Registro de pesajes"
      descripcion="Cada pesaje tiene un código con la sigla y el mini lote de cada materia prima, y al final el peso total."
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
  const producto = destinoValido(pedido) ? pedido : "ALIBAL 1 K";
  const planilla = planillaDeProducto(getDb(), producto);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-3">
        {DESTINOS.map((destino) => (
          <a
            key={destino}
            href={`/pesajes?producto=${encodeURIComponent(destino)}`}
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
      <Card>
        <CardContent className="overflow-x-auto pt-4">
          {planilla.filas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Todavía no hay pesajes de {producto}.
            </p>
          ) : (
            <table className="w-full min-w-[56rem] border-collapse text-sm">
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
                {planilla.filas.map((fila) => (
                  <tr key={fila.id} className="border-b align-top">
                    <td className="px-3 py-3">
                      <p className="text-base font-semibold">{fila.numero}</p>
                      {fila.codigo ? (
                        <p className="mt-2 max-w-64 font-mono text-xs leading-5 font-normal break-all">{fila.codigo}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">{formatoFecha(fila.fecha)}</td>
                    <td className="px-3 py-3">{fila.linea}</td>
                    <td className="px-3 py-3">{fila.destino}</td>
                    <td className="px-3 py-3">
                      <div className="grid w-64 gap-2">
                        {fila.observaciones.trim() ? (
                          <p className="rounded-md bg-amber-100 px-2 py-1.5 text-xs font-medium text-amber-950">
                            {fila.observaciones.trim()}
                          </p>
                        ) : null}
                        <FormObservacion
                          key={`${fila.id}-${fila.observaciones}`}
                          accion={guardarObservacionPesajeFormulario}
                          campoId="pesaje_id"
                          id={String(fila.id)}
                          valor={fila.observaciones}
                          etiqueta={`Aviso del pesaje ${fila.numero}`}
                        />
                      </div>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function leer(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}
