"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CampoFiltro } from "@/components/campo-filtro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { coincideBusqueda } from "@/lib/coincide";
import { formatoFecha, formatoKg } from "@/lib/formato";

export type FichaPesaje = {
  id: number;
  numero: number;
  fecha: string;
  destino: string;
  linea: string;
  total: number;
  codigo: string;
  observaciones: string;
  lineas: { tipo: string; usado: number; objetivo: number; minimo?: number; maximo?: number }[];
  minis: { token: string; tipo: string; kg: number; tag: string; destino: string; disponibles: number | null }[];
};

export function BuscarPesaje({ inicial, fichas }: { inicial: string; fichas: FichaPesaje[] }) {
  const [texto, setTexto] = useState(inicial);
  const [elegido, setElegido] = useState(inicial);
  const consulta = texto.trim();
  const coincidencias = useMemo(
    () =>
      consulta
        ? fichas.filter((ficha) =>
            coincideBusqueda(consulta, [
              ficha.codigo,
              ficha.observaciones,
              String(ficha.numero),
              ficha.fecha,
              ficha.destino,
              ...ficha.minis.flatMap((mini) => [mini.token, mini.tag, mini.tipo]),
            ]),
          )
        : [],
    [consulta, fichas],
  );
  const activa =
    coincidencias.find((ficha) => ficha.codigo === elegido) ??
    (coincidencias.length === 1 ? coincidencias[0] : null);

  return (
    <div className="grid gap-6">
      <CampoFiltro
        etiqueta="Código del pesaje"
        placeholder="Escribe la sigla, el mini lote o el total"
        valor={texto}
        alCambiar={setTexto}
        mono
      />
      {consulta && coincidencias.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay pesajes que coincidan con {consulta}.</p>
      ) : null}
      {coincidencias.length > 1 ? (
        <ul className="grid gap-2">
          {coincidencias.slice(0, 12).map((ficha) => (
            <li key={ficha.id}>
              <button
                type="button"
                onClick={() => setElegido(ficha.codigo)}
                className={`grid w-full gap-0.5 rounded-lg border px-3 py-2 text-left hover:bg-muted ${
                  activa?.id === ficha.id ? "border-primary" : ""
                }`}
              >
                <span className="font-mono text-sm font-medium break-all">{ficha.codigo}</span>
                <span className="text-xs text-muted-foreground">
                  Pesaje {ficha.numero} · {formatoFecha(ficha.fecha)} · línea {ficha.linea} · {formatoKg(ficha.total)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {activa ? <Detalle ficha={activa} /> : null}
    </div>
  );
}

function Detalle({ ficha }: { ficha: FichaPesaje }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pesaje {ficha.numero}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="rounded-lg bg-muted px-3 py-2 font-mono text-sm break-all">{ficha.codigo}</p>
        {ficha.observaciones.trim() ? (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-950">
            Observación: {ficha.observaciones.trim()}
          </p>
        ) : null}
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta="Fecha" valor={formatoFecha(ficha.fecha)} />
          <Dato etiqueta="Producto" valor={ficha.destino} />
          <Dato etiqueta="Línea" valor={ficha.linea} />
          <Dato etiqueta="Total" valor={formatoKg(ficha.total)} />
        </dl>
        <div className="grid gap-2">
          {ficha.lineas.map((linea) => (
            <p key={linea.tipo} className="text-sm">
              <span className="font-medium">{linea.tipo}</span>
              <span className="text-muted-foreground">
                {" "}
                {formatoKg(linea.usado)} · rango {formatoKg(linea.minimo ?? linea.objetivo)} a {formatoKg(linea.maximo ?? linea.objetivo)}
              </span>
            </p>
          ))}
        </div>
        <div className="grid gap-3">
          {ficha.minis.map((mini) => (
            <article key={mini.token} className="grid gap-3 rounded-lg border p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-mono text-base font-semibold">{mini.token}</p>
                <p className="text-base font-semibold tabular-nums">{formatoKg(mini.kg)}</p>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Dato etiqueta="Tipo" valor={mini.tipo} />
                <Dato
                  etiqueta="TAG"
                  valor={
                    <Link href={`/lote/${mini.tag}`} className="font-mono underline">
                      {mini.tag}
                    </Link>
                  }
                />
                <Dato etiqueta="Producto" valor={mini.destino} />
                <Dato
                  etiqueta="Disponibles en el TAG"
                  valor={mini.disponibles === null ? "—" : formatoKg(mini.disponibles)}
                />
              </dl>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm font-medium">{valor}</dd>
    </div>
  );
}
