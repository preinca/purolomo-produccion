"use client";

import { useActionState } from "react";
import { crearConsumo, crearDespacho, type EstadoFormulario } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

  return (
    <form action={enviar} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="tag">TAG</Label>
          <Input
            id="tag"
            name="tag"
            required
            defaultValue={tagInicial}
            placeholder="Número de paleta"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="fecha">Fecha</Label>
          <Input id="fecha" name="fecha" type="date" required defaultValue={hoy} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="kg">Kg {tipo === "despacho" ? "despachados" : "consumidos"}</Label>
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
          Movimiento del TAG {estado.tag} guardado.
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pendiente} className="w-full sm:w-auto">
        {pendiente ? "Guardando…" : tipo === "despacho" ? "Registrar salida" : "Registrar consumo"}
      </Button>
    </form>
  );
}
