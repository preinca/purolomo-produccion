import { connection } from "next/server";
import { Suspense } from "react";
import {
  eliminarEtiquetaEnCurso,
  eliminarEtiquetasPorImprimir,
  guardarEtiquetasPendientes,
  imprimirEtiquetasPendientes,
  iniciarProcesoRecepcion,
  reiniciarProcesoRecepcion,
  terminarProcesoRecepcion,
} from "@/app/actions";
import { ConfirmarAccion } from "@/components/confirmar-accion";
import { EtiquetaCava } from "@/components/etiqueta-cava";
import { EntradaForm } from "@/components/entrada-form";
import { PageFrame } from "@/components/page-frame";
import { TablaLotes } from "@/components/tabla-lotes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { fechaHoy, semanaDe } from "@/lib/formato";
import { listarLotes, listarLotesDeProceso } from "@/lib/lotes";
import { procesoAbierto, procesosPorImprimir } from "@/lib/proceso-recepcion";
import { PRODUCTOS_MPC } from "@/lib/mpc";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PageFrame
      titulo="Registrar entradas"
      descripcion="Inicia el proceso de recepción, carga cada materia prima cárnica y, al terminar, imprime juntas las etiquetas de ese proceso."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando formulario…</p>}>
        <Entradas searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}

async function Entradas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const parametros = await searchParams;
  const aviso = (Array.isArray(parametros.aviso) ? parametros.aviso[0] : parametros.aviso ?? "").trim();
  const tono = (Array.isArray(parametros.tono) ? parametros.tono[0] : parametros.tono ?? "").trim();
  const db = getDb();
  const [proceso, porImprimir, recientes] = await Promise.all([
    procesoAbierto(db),
    procesosPorImprimir(db),
    listarLotes(db, { limite: 12 }),
  ]);
  const [delProceso, listas] = await Promise.all([
    proceso ? listarLotesDeProceso(db, proceso.id) : Promise.resolve([]),
    Promise.all(porImprimir.map(async (item) => ({ ...item, lotes: await listarLotesDeProceso(db, item.id) }))),
  ]);

  return (
    <div className="grid gap-8">
      {aviso ? (
        <p
          role="status"
          className={
            tono === "ok"
              ? "rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-5 text-lg font-semibold leading-snug text-emerald-950 sm:px-6 sm:py-6 sm:text-xl"
              : "rounded-xl border px-4 py-3 text-sm"
          }
        >
          {aviso}
        </p>
      ) : null}
      {proceso ? (
        <Card>
          <CardHeader>
            <CardTitle>Recepción en curso</CardTitle>
            <CardDescription>
              {proceso.entradas === 0
                ? "Todavía no hay entradas en este proceso. Carga cada materia prima y, cuando termines, cierra el proceso para imprimir."
                : `${proceso.entradas} ${proceso.entradas === 1 ? "entrada cargada" : "entradas cargadas"}. Cuando termines todas las materias primas, cierra el proceso y luego imprime las etiquetas. No se puede iniciar otro proceso hasta terminar este.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form action={terminarProcesoRecepcion}>
              <button
                type="submit"
                className="inline-flex h-16 w-full items-center justify-center rounded-xl bg-green-600 px-6 text-lg font-semibold text-white hover:bg-green-700 sm:h-14 sm:text-base"
              >
                Terminar proceso
              </button>
            </form>
            {proceso.entradas > 0 ? (
            <form action={reiniciarProcesoRecepcion} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 text-sm">
                <input name="confirmar" type="checkbox" value="si" required className="size-4" />
                Confirmo reiniciar la carga
              </label>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-destructive px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                Reiniciar carga
              </button>
            </form>
            ) : null}
          </CardContent>
        </Card>
      ) : listas.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Proceso de recepción</CardTitle>
            <CardDescription>
              Inicia el proceso antes de registrar. Mientras esté abierto puedes cargar cada paleta. Al terminarlo, el botón de imprimir manda juntas las etiquetas de este proceso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={iniciarProcesoRecepcion}>
              <button
                type="submit"
                className="inline-flex h-16 w-full items-center justify-center rounded-xl bg-blue-600 px-6 text-lg font-semibold text-white hover:bg-blue-700 sm:h-14 sm:text-base"
              >
                Iniciar proceso de recepción
              </button>
            </form>
          </CardContent>
        </Card>
      ) : null}
      {listas.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <CardTitle>Etiquetas registradas</CardTitle>
            <CardDescription>
              El proceso ya terminó. Revisa estas {item.entradas} {item.entradas === 1 ? "etiqueta" : "etiquetas"} y elige si las imprimes o solo las guardas.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form action={eliminarEtiquetasPorImprimir} className="grid gap-4">
              <input type="hidden" name="proceso" value={item.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                {item.lotes.map((lote) => (
                  <div key={lote.tag} className="grid gap-2">
                    <EtiquetaCava lote={lote} nota={false} />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="tag" value={lote.tag} className="size-4" />
                      Seleccionar
                    </label>
                  </div>
                ))}
              </div>
              <button
                type="submit"
                name="modo"
                value="seleccionadas"
                className="inline-flex h-11 w-fit items-center justify-center rounded-lg border border-destructive px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                Eliminar seleccionadas
              </button>
            </form>
            <form action={eliminarEtiquetasPorImprimir} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input type="hidden" name="proceso" value={item.id} />
              <input type="hidden" name="modo" value="todas" />
              <label className="flex items-center gap-2 text-sm">
                <input name="confirmar" type="checkbox" value="si" required className="size-4" />
                Confirmo eliminar todas
              </label>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-destructive px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                Eliminar todas
              </button>
            </form>
            <div className="mt-4 grid gap-8">
              <ConfirmarAccion
                action={imprimirEtiquetasPendientes}
                proceso={item.id}
                pregunta="¿Estás seguro de imprimir las etiquetas?"
                boton={`Imprimir ${item.entradas} ${item.entradas === 1 ? "etiqueta" : "etiquetas"}`}
                confirmar="Sí, imprimir"
                claseBoton="inline-flex h-16 w-full items-center justify-center rounded-xl bg-primary px-6 text-lg font-semibold text-primary-foreground hover:bg-primary/80 sm:h-14 sm:text-base"
              />
              <div className="border-t-2 border-neutral-800" />
              <ConfirmarAccion
                action={guardarEtiquetasPendientes}
                proceso={item.id}
                pregunta="¿Estás seguro de guardar las etiquetas sin imprimir?"
                boton="Guardar SIN IMPRIMIR"
                confirmar="Sí, guardar sin imprimir"
                claseBoton="inline-flex h-16 w-full items-center justify-center rounded-xl border border-blue-600 px-6 text-center text-lg font-semibold text-blue-700 hover:bg-blue-50 sm:h-14 sm:text-base"
                claseConfirmar="inline-flex h-16 w-full items-center justify-center rounded-xl bg-blue-600 px-6 text-center text-lg font-semibold text-white hover:bg-blue-700 sm:h-14 sm:text-base"
              />
            </div>
          </CardContent>
        </Card>
      ))}
      {proceso ? (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Etiquetas de este proceso</CardTitle>
            <CardDescription>
              Cada recepción queda aquí. Si una salió mal, elimínala antes de registrar la siguiente.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            {delProceso.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay entradas en este proceso.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {delProceso.map((lote) => (
                  <div key={lote.tag} className="grid gap-3">
                    <EtiquetaCava lote={lote} nota={false} />
                    <form action={eliminarEtiquetaEnCurso}>
                      <input type="hidden" name="tag" value={lote.tag} />
                      <button
                        type="submit"
                        className="inline-flex h-14 w-full items-center justify-center rounded-xl border border-destructive px-4 text-base font-semibold text-destructive hover:bg-destructive/10"
                      >
                        Eliminar etiqueta {lote.tag}
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
      {proceso ? (
        <Card>
          <CardHeader>
            <CardTitle>Nueva recepción</CardTitle>
            <CardDescription>
              Escribe el TAG de la paleta: un número de 6 dígitos. Si ese TAG ya está registrado, no se puede volver a usar.
              La semana se puede escribir; hoy corresponde a la {semanaDe(fechaHoy()).toLowerCase()}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EntradaForm
              hoy={fechaHoy()}
              semanaSugerida={semanaDe(fechaHoy()).replace(/\D/g, "") || "45"}
              productos={PRODUCTOS_MPC}
            />
          </CardContent>
        </Card>
      ) : null}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Últimas paletas</CardTitle>
          <CardDescription>
            Las recepciones más recientes, con su TAG, producto, kilos y estado.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          <TablaLotes lotes={recientes} vacio="Todavía no hay recepciones." />
        </CardContent>
      </Card>
    </div>
  );
}
