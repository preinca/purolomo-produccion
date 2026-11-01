"use client";

import { useActionState, useEffect, useState } from "react";
import { crearConsumo, crearDespacho, type EstadoFormulario, type LoteLeido } from "@/app/actions";
import { EscanerSalida } from "@/components/escaner-salida";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DESTINOS } from "@/lib/destinos";
import { formatoKg } from "@/lib/formato";
import { LINEAS } from "@/lib/lineas";

export function MovimientoForm({
  tipo,
  hoy,
  tagInicial = "",
}: {
  tipo: "despacho" | "consumo";
  hoy: string;
  tagInicial?: string;
}) {
  const accion = tipo === "despacho" ? crearDespacho : crearConsumo;
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );
  const [tag, setTag] = useState(tagInicial);
  const [lectura, setLectura] = useState<LoteLeido | null>(null);
  const [linea, setLinea] = useState("");
  const lineaElegida = LINEAS.find((item) => item.id === linea) ?? null;

  useEffect(() => {
    if (tagInicial) setTag(tagInicial);
  }, [tagInicial]);

  return (
    <form action={enviar} className="grid gap-4">
      {tipo === "despacho" ? (
        <EscanerSalida
          onLeido={(leido) => {
            setTag(leido.tag);
            setLectura(leido);
          }}
        />
      ) : null}
      {lectura ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          Paleta {lectura.tag}
          {lectura.producto ? ` · ${lectura.producto}` : ""}
          {lectura.tipo ? ` · ${lectura.tipo}` : ""}. Consumidos: {formatoKg(lectura.kgDespachados)}. Restantes: {formatoKg(lectura.kgRestantes)}. Indica los kilos que salen ahora.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="tag">TAG</Label>
          <Input
            id="tag"
            name="tag"
            required
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            placeholder="Número de paleta"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="fecha">Fecha</Label>
          <Input id="fecha" name="fecha" type="date" required defaultValue={hoy} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="kg">Kg consumidos</Label>
          <Input
            id="kg"
            name="kg"
            type="number"
            inputMode="decimal"
            required
            min="0.001"
            step="0.001"
            placeholder="0"
          />
        </div>
      </div>
      {tipo === "despacho" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="destino">Producto y presentación</Label>
            <select
              id="destino"
              name="destino"
              required
              defaultValue=""
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Elige un producto…</option>
              {DESTINOS.map((destino) => (
                <option key={destino} value={destino}>
                  {destino}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Indica en qué producto se va a consumir esta materia prima.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="linea">Línea</Label>
            <select
              id="linea"
              name="linea"
              required
              value={linea}
              onChange={(event) => setLinea(event.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Elige una línea…</option>
              {LINEAS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre} · hasta {formatoKg(item.capacidadKg)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {lineaElegida
                ? `${lineaElegida.nombre} admite hasta ${formatoKg(lineaElegida.capacidadKg)} en esta salida.`
                : "Línea 1 hasta 1800 kg. Línea 2 hasta 3600 kg."}
            </p>
          </div>
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor="nota">Nota</Label>
        <Textarea id="nota" name="nota" maxLength={500} placeholder="Destino, receta o novedad" />
      </div>
      {estado?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}
      {estado?.ok ? (
        <p role="status" className="text-sm">
          {tipo === "despacho"
            ? `Salida del TAG ${estado.tag} guardada. Los kilos de esa paleta quedaron actualizados.`
            : `Movimiento del TAG ${estado.tag} guardado.`}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pendiente} className="w-full sm:w-auto">
        {pendiente ? "Guardando…" : tipo === "despacho" ? "Registrar salida" : "Registrar consumo"}
      </Button>
    </form>
  );
}
