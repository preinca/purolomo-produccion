import { connection } from "next/server";
import { Suspense } from "react";
import { PageFrame } from "@/components/page-frame";
import { SalidaAlibal } from "@/components/salida-alibal";
import { SalidaLogistica } from "@/components/salida-logistica";
import { getDb } from "@/lib/db";
import { fechaHoy } from "@/lib/formato";
import { leerSesion } from "@/lib/usuarios";
import { buscarPesaje, codigoDelPesaje, existenciasDeTipos, listarMiniLotes, pesajeEnCurso, progresoPesaje, siguienteNumero } from "@/lib/pesajes";
import { ALIBAL_1K, recetasCargadas } from "@/lib/recetas";

export default function Page({ searchParams }: PageProps<"/salidas">) {
  return (
    <PageFrame
      titulo="Registrar salidas"
      descripcion="Registra la salida de la materia prima."
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
  const esAdmin = (await leerSesion())?.rango === "administrador";
  const modo =
    esAdmin && modoPedido === "logistica"
      ? "logistica"
      : modoPedido === "consumo" || pesajeId || token
        ? "consumo"
        : "";
  const pedidoProducto = leer(parametros.producto);
  const producto = pedidoProducto === ALIBAL_1K.destino || pesajeId || token ? ALIBAL_1K.destino : "";
  const db = getDb();
  const cargadas = (await recetasCargadas(db)).filter((receta) => receta.destino === producto);
  const enCurso = await pesajeEnCurso(db, producto);
  const encontrado = Number.isInteger(pesajeId) ? await buscarPesaje(db, pesajeId) : null;
  const pesaje = encontrado && encontrado.destino === producto ? encontrado : enCurso;
  const progreso = pesaje ? await progresoPesaje(db, pesaje) : null;
  const minilotes = pesaje ? await listarMiniLotes(db, pesaje.id) : [];

  return (
    <div className="grid gap-8">
      <div className={`grid gap-4 ${esAdmin ? "sm:grid-cols-2" : ""} ${modo === "" ? "sm:min-h-72" : ""}`}>
        <a
          href="/salidas?modo=consumo"
          className={`grid content-center gap-2 rounded-2xl border px-6 ${modo === "" ? "py-10 sm:py-14" : "py-5"} ${
            modo === "consumo"
              ? "border-purolomo-red bg-purolomo-red text-white"
              : "border-border bg-white text-foreground hover:border-purolomo-red"
          }`}
        >
          <span className="text-xl font-semibold">Salida para consumo</span>
          <span className={`text-sm leading-relaxed ${modo === "consumo" ? "text-white/85" : "text-muted-foreground"}`}>
            Primero elige el producto. Después se pesa la fórmula y se escanea cada TAG.
          </span>
        </a>
        {esAdmin ? (
          <a
            href="/salidas?modo=logistica"
            className={`grid content-center gap-2 rounded-2xl border px-6 ${modo === "" ? "py-10 sm:py-14" : "py-5"} ${
              modo === "logistica"
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-border bg-white text-foreground hover:border-orange-500"
            }`}
          >
            <span className="text-xl font-semibold">Salida para logística</span>
            <span className={`text-sm leading-relaxed ${modo === "logistica" ? "text-white/85" : "text-muted-foreground"}`}>
              El TAG sale de la cava. Queda avisado que ya no se puede consumir.
            </span>
          </a>
        ) : null}
      </div>
      {modo === "" ? null : modo === "logistica" ? (
        <SalidaLogistica trasladado={leer(parametros.trasladado)} />
      ) : !producto ? (
        <div className="grid gap-3">
          <p className="text-sm font-medium text-muted-foreground">Elige el producto del pesaje</p>
          <a
            href={`/salidas?modo=consumo&producto=${encodeURIComponent(ALIBAL_1K.destino)}`}
            className="grid max-w-xl content-center gap-2 rounded-2xl border border-border bg-white px-6 py-8 text-foreground hover:border-purolomo-red"
          >
            <span className="text-xl font-semibold">ALIBAL 1 K</span>
            <span className="text-sm leading-relaxed text-muted-foreground">Alibal de 1 kg. Es el único producto para esta salida.</span>
          </a>
        </div>
      ) : (
    <div className="grid gap-8">
      <SalidaAlibal
            hoy={fechaHoy()}
            lineasConReceta={cargadas.map((receta) => receta.linea)}
            existencias={await existenciasDeTipos(db, progreso?.lineas.map((linea) => linea.tipo) ?? [])}
            numeroSiguiente={await siguienteNumero(db, enCurso?.fecha ?? fechaHoy(), producto)}
            token={token}
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
                    minimo: progreso.minimo,
                    maximo: progreso.maximo,
                    total: progreso.total,
                    lineas: progreso.lineas,
                    codigo: await codigoDelPesaje(db, pesaje.id),
                    finalizado: pesaje.finalizado,
                    observaciones: pesaje.observaciones,
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
    </div>
      )}
    </div>
  );
}

function leer(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}
