import { connection } from "next/server";
import { Suspense } from "react";
import { guardarObservacionPesajeFormulario } from "@/app/actions";
import { FormObservacion } from "@/components/form-observacion";
import { PageFrame } from "@/components/page-frame";
import { SalidaAlibal } from "@/components/salida-alibal";
import { SalidaLogistica } from "@/components/salida-logistica";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { fechaHoy, formatoKg } from "@/lib/formato";
import { buscarPesaje, codigoDelPesaje, existenciasDeTipos, listarMiniLotes, listarPesajes, pesajeEnCurso, progresoPesaje, siguienteNumero } from "@/lib/pesajes";
import { ALIBAL_1K, recetasCargadas } from "@/lib/recetas";

export default function Page({ searchParams }: PageProps<"/salidas">) {
  return (
    <PageFrame
      titulo="Registrar salidas"
      descripcion="Elige si la salida es para consumo, con el pesaje de Alibal, o para logística, que saca el TAG de cava."
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
  const modoPedido = leer(parametros.modo);
  const modo =
    modoPedido === "logistica" ? "logistica" : modoPedido === "consumo" || pesajeId || token ? "consumo" : "";
  const producto = ALIBAL_1K.destino;
  const db = getDb();
  const cargadas = recetasCargadas(db).filter((receta) => receta.destino === producto);
  const enCurso = pesajeEnCurso(db, producto);
  const encontrado = Number.isInteger(pesajeId) ? buscarPesaje(db, pesajeId) : null;
  const pesaje = encontrado && encontrado.destino === producto ? encontrado : enCurso;
  const progreso = pesaje ? progresoPesaje(db, pesaje) : null;
  const minilotes = pesaje ? listarMiniLotes(db, pesaje.id) : [];

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap gap-3">
        <a
          href="/salidas?modo=consumo"
          className={`rounded-lg border px-4 py-2 text-sm font-medium ${modo === "consumo" ? "border-purolomo-red bg-purolomo-red text-white" : "border-border bg-white text-foreground"}`}
        >
          Salida para consumo
        </a>
        <a
          href="/salidas?modo=logistica"
          className={`rounded-lg border px-4 py-2 text-sm font-medium ${modo === "logistica" ? "border-purolomo-red bg-purolomo-red text-white" : "border-border bg-white text-foreground"}`}
        >
          Salida para logística
        </a>
      </div>
      {modo === "" ? (
        <p className="rounded-xl bg-[#f4f6f8] px-4 py-8 text-center text-base text-muted-foreground">
          Elige hacia dónde va la materia prima.
        </p>
      ) : modo === "logistica" ? (
        <SalidaLogistica trasladado={leer(parametros.trasladado)} />
      ) : (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
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
            numeroSiguiente={siguienteNumero(db, enCurso?.fecha ?? fechaHoy(), producto)}
            enCurso={
              enCurso
                ? { id: enCurso.id, numero: enCurso.numero, linea: enCurso.linea, fecha: enCurso.fecha }
                : null
            }
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
      <Card className="xl:sticky xl:top-6">
        <CardHeader>
          <CardTitle>Retiros de este pesaje</CardTitle>
          <CardDescription>
            Cada retiro queda con su mini lote, el TAG y los kilos. Si un tipo usa dos TAG, aparecen los dos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {!pesaje ? (
            <p className="rounded-xl bg-[#f4f6f8] px-4 py-8 text-center text-base text-muted-foreground">
              Abre un pesaje para ver sus retiros.
            </p>
          ) : (
            <>
            <FormObservacion
              key={`${pesaje.id}-${pesaje.observaciones}`}
              accion={guardarObservacionPesajeFormulario}
              campoId="pesaje_id"
              id={String(pesaje.id)}
              valor={pesaje.observaciones}
              etiqueta="Observación de este pesaje"
            />
            {pesaje.observaciones.trim() ? (
              <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-950">
                Observación: {pesaje.observaciones.trim()}
              </p>
            ) : null}
            {minilotes.length === 0 ? (
            <p className="rounded-xl bg-[#f4f6f8] px-4 py-8 text-center text-base text-muted-foreground">
              Aún no hay consumos en este pesaje.
            </p>
          ) : (
            <>
            {pesaje ? (
              <div className="grid gap-2">
                <p className="rounded-lg bg-muted px-3 py-2 font-mono text-sm break-all">
                  {codigoDelPesaje(db, pesaje.id)}
                </p>
                <a
                  href={`/qr/pesaje/${pesaje.id}`}
                  download={`qr-pesaje-${pesaje.numero}.png`}
                  className="w-fit text-sm font-medium underline"
                >
                  Descargar el QR del pesaje
                </a>
              </div>
            ) : null}
            {minilotes.map((mini) => (
              <article
                key={mini.token}
                className={`grid gap-4 rounded-xl border bg-white p-5 ${token === mini.token ? "border-primary" : ""}`}
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
      )}
    </div>
  );
}

function leer(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}
