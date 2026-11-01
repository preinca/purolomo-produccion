"use client";

import { useMemo, useState } from "react";
import { CampoFiltro } from "@/components/campo-filtro";
import { EliminarLoteForm } from "@/components/eliminar-lote-form";
import { EstadoBadge } from "@/components/estado-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { coincideBusqueda } from "@/lib/coincide";
import { formatoFecha, formatoKg } from "@/lib/formato";

export type LoteEliminar = {
  tag: string;
  producto: string;
  codigo: string;
  destino: string;
  fecha: string;
  semana: string;
  kgRecibidos: number;
  kgConsumidos: number;
  kgDisponibles: number;
  estado: string;
  observaciones: string;
};

export function EliminarEnVivo({ lotes }: { lotes: LoteEliminar[] }) {
  const [texto, setTexto] = useState("");
  const [elegido, setElegido] = useState("");
  const consulta = texto.trim();
  const coincidencias = useMemo(
    () =>
      consulta
        ? lotes.filter((lote) => coincideBusqueda(consulta, [lote.tag, lote.producto, lote.codigo]))
        : [],
    [consulta, lotes],
  );
  const activo =
    coincidencias.find((lote) => lote.tag === elegido) ?? (coincidencias.length === 1 ? coincidencias[0] : null);

  return (
    <div className="grid max-w-xl gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Buscar TAG</CardTitle>
          <CardDescription>Escribe parte del TAG y elige la paleta.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <CampoFiltro etiqueta="TAG" placeholder="Número de paleta" valor={texto} alCambiar={setTexto} />
          {consulta && coincidencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay un lote que coincida con {consulta}.</p>
          ) : null}
          {coincidencias.length > 1 ? (
            <ul className="grid gap-2">
              {coincidencias.slice(0, 12).map((lote) => (
                <li key={lote.tag}>
                  <button
                    type="button"
                    onClick={() => setElegido(lote.tag)}
                    className={`grid w-full gap-0.5 rounded-lg border px-3 py-2 text-left hover:bg-muted ${
                      activo?.tag === lote.tag ? "border-primary" : ""
                    }`}
                  >
                    <span className="font-mono text-sm font-medium">{lote.tag}</span>
                    <span className="text-xs text-muted-foreground">
                      {lote.producto} · {lote.codigo}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
      {activo ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-mono">{activo.tag}</CardTitle>
            <CardDescription>
              {activo.producto} · {activo.codigo}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <Dato etiqueta="Para" valor={activo.destino || "—"} />
              <Dato etiqueta="Fecha" valor={formatoFecha(activo.fecha)} />
              <Dato etiqueta="Semana" valor={activo.semana} />
              <Dato etiqueta="Kg recibidos" valor={formatoKg(activo.kgRecibidos)} />
              <Dato etiqueta="Kg consumidos" valor={formatoKg(activo.kgConsumidos)} />
              <Dato etiqueta="Kg disponibles" valor={formatoKg(activo.kgDisponibles)} />
              <div>
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Estado</dt>
                <dd className="mt-1">
                  <EstadoBadge estado={activo.estado} />
                </dd>
              </div>
            </dl>
            {activo.observaciones ? <p className="text-sm text-muted-foreground">{activo.observaciones}</p> : null}
            <EliminarLoteForm tag={activo.tag} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{etiqueta}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
