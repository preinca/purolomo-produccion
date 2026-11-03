"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CampoFiltro } from "@/components/campo-filtro";
import { EstadoBadge } from "@/components/estado-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { coincideBusqueda } from "@/lib/coincide";
import { formatoFecha, formatoKg } from "@/lib/formato";

export type FichaMini = {
  token: string;
  tipo: string;
  kg: number;
  tag: string;
  destino: string;
  linea: string;
  pesaje: number;
  fecha: string;
  codigoPesaje: string;
  materia: string;
  recibidos: number | null;
  consumidos: number | null;
  disponibles: number | null;
  agotado: boolean;
  estado: string;
};

export function BuscarMiniLote({ inicial, fichas }: { inicial: string; fichas: FichaMini[] }) {
  const [texto, setTexto] = useState(inicial);
  const [elegido, setElegido] = useState(inicial);
  const consulta = texto.trim();
  const coincidencias = useMemo(
    () =>
      consulta
        ? fichas.filter((ficha) =>
            coincideBusqueda(consulta, [ficha.token, ficha.tag, ficha.tipo, ficha.codigoPesaje, String(ficha.pesaje)]),
          )
        : [],
    [consulta, fichas],
  );
  const activa =
    coincidencias.find((ficha) => ficha.token === elegido) ??
    (coincidencias.length === 1 ? coincidencias[0] : null);

  return (
    <div className="grid gap-6">
      <CampoFiltro
        etiqueta="Código del mini lote"
        placeholder="Escribe ML, el número o el TAG"
        valor={texto}
        alCambiar={setTexto}
        mono
      />
      {consulta && coincidencias.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay mini lotes que coincidan con {consulta}.</p>
      ) : null}
      {coincidencias.length > 1 ? (
        <ul className="grid gap-2">
          {coincidencias.slice(0, 12).map((ficha) => (
            <li key={ficha.token}>
              <button
                type="button"
                onClick={() => setElegido(ficha.token)}
                className={`grid w-full gap-0.5 rounded-lg border px-3 py-2 text-left hover:bg-muted ${
                  activa?.token === ficha.token ? "border-primary" : ""
                }`}
              >
                <span className="font-mono text-sm font-medium">{ficha.token}</span>
                <span className="text-xs text-muted-foreground">
                  {ficha.tipo} · {formatoKg(ficha.kg)} · TAG {ficha.tag} · pesaje {ficha.pesaje}
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

function Detalle({ ficha }: { ficha: FichaMini }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="font-mono">{ficha.token}</CardTitle>
        {ficha.estado ? <EstadoBadge estado={ficha.estado} /> : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Dato etiqueta="Tipo" valor={ficha.tipo} />
          <Dato etiqueta="Kilos" valor={formatoKg(ficha.kg)} />
          <Dato
            etiqueta="TAG"
            valor={
              <Link href={`/lote/${ficha.tag}`} className="font-mono underline">
                {ficha.tag}
              </Link>
            }
          />
          <Dato etiqueta="Producto" valor={ficha.destino} />
          <Dato etiqueta="Línea" valor={ficha.linea} />
          <Dato etiqueta="Pesaje" valor={String(ficha.pesaje)} />
          <Dato etiqueta="Fecha" valor={formatoFecha(ficha.fecha)} />
          <Dato etiqueta="Código del pesaje" valor={<span className="font-mono break-all">{ficha.codigoPesaje}</span>} />
          <Dato etiqueta="Materia prima" valor={ficha.materia} />
          <Dato etiqueta="Kg recibidos del TAG" valor={ficha.recibidos === null ? "—" : formatoKg(ficha.recibidos)} />
          <Dato etiqueta="Kg consumidos del TAG" valor={ficha.consumidos === null ? "—" : formatoKg(ficha.consumidos)} />
          <Dato etiqueta="Kg disponibles del TAG" valor={ficha.disponibles === null ? "—" : formatoKg(ficha.disponibles)} />
        </dl>
        {ficha.agotado ? (
          <p className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white">
            Se acabaron todos los kg de esta materia prima.
          </p>
        ) : null}
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
