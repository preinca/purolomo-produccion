import { connection } from "next/server";
import { Suspense } from "react";
import { PageFrame } from "@/components/page-frame";
import { SalidaAlibal } from "@/components/salida-alibal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { fechaHoy, formatoKg } from "@/lib/formato";
import { codigoDelPesaje, existenciasDeTipos, listarMiniLotes, listarPesajes, progresoPesaje, buscarPesaje } from "@/lib/pesajes";
import { ALIBAL_1K, recetasCargadas } from "@/lib/recetas";

export default function Page({ searchParams }: PageProps<"/salidas">) {
  return (
    <PageFrame
      titulo="Registrar salidas"
      descripcion="Primero se carga la receta del día. Después cada retiro se descuenta solo si cabe en esa receta."
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
  const pesajeId = Number(leer(parametros.pesaje));
  const token = leer(parametros.token);
  const producto = ALIBAL_1K.destino;
  const db = getDb();
  const cargadas = recetasCargadas(db).filter((receta) => receta.destino === producto);
  const encontrado = Number.isInteger(pesajeId) ? buscarPesaje(db, pesajeId) : null;
  const pesaje = encontrado && encontrado.destino === producto ? encontrado : null;
  const progreso = pesaje ? progresoPesaje(db, pesaje) : null;
  const minilotes = pesaje ? listarMiniLotes(db, pesaje.id) : [];

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[32rem_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Consumo de Alibal 1 kg</CardTitle>
          <CardDescription>
            Escanea el TAG, indica los kilos y el sistema los descuenta solo si caben en la receta del pesaje.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SalidaAlibal
            hoy={fechaHoy()}
            lineasConReceta={cargadas.map((receta) => receta.linea)}
            pesajes={listarPesajes(db, producto).map((item) => ({
              id: item.id,
              numero: item.numero,
              fecha: item.fecha,
              linea: item.linea,
              codigo: codigoDelPesaje(db, item.id),
              trazas: listarMiniLotes(db, item.id).map((mini) => ({
                tipo: mini.tipo,
                tag: mini.tag,
                token: mini.token,
                kg: mini.kg,
              })),
            }))}
            existencias={existenciasDeTipos(db, progreso?.lineas.map((linea) => linea.tipo) ?? [])}
            pesaje={
              pesaje && progreso
                ? {
                    id: pesaje.id,
                    numero: pesaje.numero,
                    fecha: pesaje.fecha,
                    destino: pesaje.destino,
                    linea: pesaje.linea,
                    objetivo: progreso.objetivo,
                    tolerancia: progreso.tolerancia,
                    total: progreso.total,
                    lineas: progreso.lineas,
                    codigo: codigoDelPesaje(db, pesaje.id),
                    trazas: minilotes.map((mini) => ({
                      tipo: mini.tipo,
                      tag: mini.tag,
                      token: mini.token,
                      kg: mini.kg,
                    })),
                  }
                : null
            }
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Retiros de este pesaje</CardTitle>
          <CardDescription>
            Si un tipo se completa con dos TAG, el número de pesaje muestra los dos TAG y los dos mini lotes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!pesaje ? (
            <p className="text-sm text-muted-foreground">Abre un pesaje para ver sus retiros.</p>
          ) : minilotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay consumos en este pesaje.</p>
          ) : (
            <>
            {pesaje ? (
              <p className="rounded-lg bg-muted px-3 py-2 font-mono text-sm break-all">
                {codigoDelPesaje(db, pesaje.id)}
              </p>
            ) : null}
            {minilotes.map((mini) => (
              <article
                key={mini.token}
                className={`grid gap-3 rounded-lg border p-4 ${token === mini.token ? "border-primary" : ""}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-mono text-base font-semibold">{mini.token}</p>
                  <p className="text-base font-semibold tabular-nums">{formatoKg(mini.kg)}</p>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Tipo</dt>
                    <dd className="mt-0.5 font-medium">{mini.tipo}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">TAG</dt>
                    <dd className="mt-0.5 font-mono font-medium">{mini.tag}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Pesaje</dt>
                    <dd className="mt-0.5 font-medium">{mini.numeroPesaje}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Línea</dt>
                    <dd className="mt-0.5 font-medium">{mini.linea}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Producto</dt>
                    <dd className="mt-0.5 font-medium">{mini.destino}</dd>
                  </div>
                </dl>
                <a
                  href={`/qr/imagen/${mini.tag}`}
                  download={`qr-${mini.tag}.png`}
                  className="w-fit text-sm font-medium underline"
                >
                  Descargar el QR del TAG
                </a>
              </article>
            ))}
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
