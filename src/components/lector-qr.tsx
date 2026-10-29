"use client";

import { useState } from "react";
import { loteActualDesdeQr, type LoteLeido } from "@/app/actions";
import { cargarImagen, decodificarImagen } from "@/components/decodificar-imagen-qr";
import { EstadoBadge } from "@/components/estado-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoFecha, formatoKg } from "@/lib/formato";

export function LectorQr() {
  const [lote, setLote] = useState<LoteLeido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);

  async function leer(archivo: File | undefined) {
    if (!archivo) return;
    setLeyendo(true);
    setError(null);
    setLote(null);
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
            <div>
              <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Estado</dt>
              <dd className="mt-1">
                <EstadoBadge estado={lote.estado} />
              </dd>
            </div>
            <Dato etiqueta="Kg recibidos" valor={formatoKg(lote.kgRecibidos)} />
            <Dato etiqueta="Kg despachados" valor={formatoKg(lote.kgDespachados)} />
            <Dato etiqueta="Kg consumidos" valor={formatoKg(lote.kgConsumidos)} />
            <Dato etiqueta="Kg restantes" valor={formatoKg(lote.kgRestantes)} />
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

