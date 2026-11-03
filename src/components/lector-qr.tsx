"use client";

import { useState } from "react";
import { loteActualDesdeQr, type ConsumoLeido, type LoteLeido } from "@/app/actions";
import { cargarImagen, decodificarImagen } from "@/components/decodificar-imagen-qr";
import { EstadoBadge } from "@/components/estado-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoFecha, formatoKg } from "@/lib/formato";
import { kgConsumidosDe, kgDisponiblesDe, tagAgotado } from "@/lib/lotes";

export function LectorQr() {
  const [lote, setLote] = useState<LoteLeido | null>(null);
  const [consumo, setConsumo] = useState<ConsumoLeido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);

  async function leer(archivo: File | undefined) {
    if (!archivo) return;
    setLeyendo(true);
    setError(null);
    setLote(null);
    setConsumo(null);
    const url = URL.createObjectURL(archivo);
    try {
      const imagen = await cargarImagen(url);
      const contenido = decodificarImagen(imagen);
      if (!contenido) {
        setError("No se encontró un código QR en esa imagen.");
        return;
      }
      const actual = await loteActualDesdeQr(contenido);
      if (!actual.ok) {
        setError(actual.error);
        return;
      }
      if ("consumo" in actual) {
        setConsumo(actual.consumo);
        return;
      }
      setLote(actual.lote);
    } catch {
      setError("No se pudo abrir esa imagen.");
    } finally {
      URL.revokeObjectURL(url);
      setLeyendo(false);
    }
  }

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle>Leer un QR</CardTitle>
        <CardDescription>
          El QR de la entrada solo identifica la paleta. Aquí se muestran los kilos guardados ahora, incluidas las salidas.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <label className="inline-flex h-8 w-fit cursor-pointer items-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted">
          {leyendo ? "Leyendo…" : "Cargar imagen de QR"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={leyendo}
            onChange={(event) => {
              const archivo = event.target.files?.[0];
              event.target.value = "";
              void leer(archivo);
            }}
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {lote ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-muted px-3 py-3 text-sm">
            <Dato etiqueta="TAG" valor={lote.tag} />
            <Dato etiqueta="Fecha" valor={formatoFecha(lote.fecha)} />
            <Dato etiqueta="Producto" valor={lote.producto} />
            <Dato etiqueta="Tipo" valor={lote.tipo || "—"} />
            <Dato etiqueta="Código" valor={lote.codigo} />
            <Dato etiqueta="Para" valor={lote.destino || "—"} />
            <div>
              <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Estado</dt>
              <dd className="mt-1">
                <EstadoBadge estado={lote.estado} />
              </dd>
            </div>
            <Dato etiqueta="Kg recibidos" valor={formatoKg(lote.kgRecibidos)} />
            <Dato etiqueta="Kg consumidos" valor={formatoKg(kgConsumidosDe(lote))} />
            <Dato etiqueta="Kg disponibles" valor={formatoKg(kgDisponiblesDe(lote))} />
            {lote.observaciones.trim() ? (
              <div className="col-span-2">
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Observación</dt>
                <dd className="mt-1 rounded-md bg-amber-100 px-2 py-1.5 font-medium text-amber-950">
                  {lote.observaciones.trim()}
                </dd>
              </div>
            ) : null}
            {lote.estado === "LOGISTICA" ? (
              <div className="col-span-2">
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Aviso</dt>
                <dd className="mt-1 rounded-md bg-orange-500 px-2 py-1.5 font-medium text-white">
                  Este TAG fue trasladado a logística y ya no se puede consumir.
                </dd>
              </div>
            ) : tagAgotado(lote) ? (
              <div className="col-span-2">
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Aviso</dt>
                <dd className="mt-1 rounded-md bg-red-600 px-2 py-1.5 font-medium text-white">
                  Se acabaron todos los kg de esta materia prima. El QR se conserva para la trazabilidad.
                </dd>
              </div>
            ) : null}
            {lote.minilotes.length > 0 ? (
              <div className="col-span-2">
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Mini lotes</dt>
                <dd className="mt-1 grid gap-1">
                  {lote.minilotes.map((mini) => (
                    <span key={mini.token}>
                      {mini.token}: {formatoKg(mini.kg)} de {mini.tipo} · pesaje {mini.pesaje} · línea {mini.linea} · para{" "}
                      {mini.destino}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {consumo ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-muted px-3 py-3 text-sm">
            <Dato etiqueta="Token" valor={consumo.token} />
            <Dato etiqueta="Pesaje" valor={String(consumo.pesaje)} />
            <Dato etiqueta="Producto" valor={consumo.destino} />
            <Dato etiqueta="Línea" valor={consumo.linea} />
            <Dato etiqueta="MPC" valor={consumo.tipo} />
            <Dato etiqueta="Kg" valor={formatoKg(consumo.kg)} />
            <Dato etiqueta="TAG de origen" valor={consumo.tag} />
            <Dato etiqueta="Tags del pesaje" valor={consumo.tags} />
          </dl>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{etiqueta}</dt>
      <dd className="font-medium break-all">{valor}</dd>
    </div>
  );
}

