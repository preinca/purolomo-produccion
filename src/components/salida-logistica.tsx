"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { loteActualDesdeTag, trasladarLogisticaFormulario, type EstadoFormulario, type LoteLeido } from "@/app/actions";
import { EscanerSalida } from "@/components/escaner-salida";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatoKg } from "@/lib/formato";

export function SalidaLogistica({ trasladado }: { trasladado: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(trasladarLogisticaFormulario, null);
  const [tag, setTag] = useState("");
  const [lectura, setLectura] = useState<LoteLeido | null>(null);
  const [errorTag, setErrorTag] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const cargado = useRef("");
  const consulta = useRef(0);
  const yaEnLogistica = lectura?.estado === "LOGISTICA";

  function elegir(leido: LoteLeido) {
    cargado.current = leido.tag;
    setErrorTag(null);
    setLectura(leido);
    setTag(leido.tag);
  }

  useEffect(() => {
    const limpio = tag.trim();
    if (cargado.current === limpio) return;
    if (!/^\d{4,8}$/.test(limpio)) {
      setBuscando(false);
      setErrorTag(null);
      if (cargado.current) {
        cargado.current = "";
        setLectura(null);
      }
      return;
    }
    const id = ++consulta.current;
    setBuscando(true);
    const timer = window.setTimeout(() => {
      void loteActualDesdeTag(limpio).then((actual) => {
        if (consulta.current !== id) return;
        setBuscando(false);
        if (!actual.ok) {
          cargado.current = "";
          setErrorTag(actual.error);
          setLectura(null);
          return;
        }
        setErrorTag(null);
        elegir(actual.lote);
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [tag]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salida para logística</CardTitle>
        <CardDescription>
          El TAG sale de cava hacia logística. Después no se puede consumir y el QR queda con esa observación.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={accion} className="grid gap-5">
          {trasladado ? (
            <p role="status" className="rounded-xl border border-primary bg-white px-4 py-3 text-sm">
              El TAG {trasladado} quedó trasladado a logística. Ya no se puede consumir.{" "}
              <a href={`/qr/imagen/${trasladado}`} download={`qr-${trasladado}.png`} className="font-medium underline">
                Descargar el QR actualizado
              </a>
              .
            </p>
          ) : null}
          <EscanerSalida onLeido={elegir} />
          <div className="grid gap-1.5">
            <Label htmlFor="tag-logistica">TAG</Label>
            <Input
              id="tag-logistica"
              name="tag"
              required
              inputMode="numeric"
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              placeholder="Número de TAG o escanéalo"
            />
          </div>
          {buscando ? <p className="text-sm text-muted-foreground">Buscando el TAG…</p> : null}
          {errorTag ? (
            <p role="alert" className="text-sm text-destructive">
              {errorTag}
            </p>
          ) : null}
          {lectura ? (
            <div className="grid gap-3 rounded-xl border bg-white px-4 py-4 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">TAG</span>
                <span className="mt-0.5 block font-mono text-base font-semibold">{lectura.tag}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Tipo</span>
                <span className="mt-0.5 block font-medium">{lectura.tipo || lectura.producto}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Kg disponibles</span>
                <span className="mt-0.5 block font-semibold tabular-nums">{formatoKg(lectura.kgRestantes)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Estado</span>
                <span className="mt-0.5 block">{lectura.estado}</span>
              </p>
            </div>
          ) : null}
          {yaEnLogistica ? (
            <p role="alert" className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white">
              Este TAG ya fue trasladado a logística y no se puede consumir.
            </p>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="observacion">Observación</Label>
            <Textarea
              id="observacion"
              name="observacion"
              required
              maxLength={500}
              placeholder="Motivo del traslado a logística"
              className="min-h-24 bg-white text-base"
            />
          </div>
          {estado?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {estado.error}
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={pendiente || yaEnLogistica} className="w-fit">
            {pendiente ? "Guardando…" : "Trasladar a logística"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
