"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function FormObservacion({
  accion,
  campoId,
  id,
  valor,
  etiqueta,
}: {
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  campoId: "tag" | "pesaje_id";
  id: string;
  valor: string;
  etiqueta: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, null);

  return (
    <form action={enviar} className="grid gap-2">
      <input type="hidden" name={campoId} value={id} />
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">{etiqueta}</span>
        <Textarea
          name="observacion"
          maxLength={500}
          rows={2}
          defaultValue={valor}
          placeholder="Escribe el aviso que debe quedar guardado"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar y notificar"}
        </Button>
        {estado?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {estado.error}
          </p>
        ) : null}
        {estado?.ok ? (
          <p role="status" className="text-sm text-muted-foreground">
            Observación guardada. El aviso ya aparece en la ficha y en el QR.
          </p>
        ) : null}
      </div>
    </form>
  );
}
