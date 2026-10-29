"use client";

import { useActionState } from "react";
import { eliminarLoteFormulario, type EstadoFormulario } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function EliminarLoteForm({ tag }: { tag: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    eliminarLoteFormulario,
    null,
  );

  return (
    <form action={accion} className="grid gap-3">
      <input type="hidden" name="tag" value={tag} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirmar" value="si" required className="mt-1" />
        <span>Confirmo eliminar el lote {tag} y su historial de movimientos.</span>
      </label>
      {estado?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}
      <Button type="submit" variant="destructive" size="lg" disabled={pendiente} className="w-full sm:w-auto">
        {pendiente ? "Eliminando…" : "Eliminar lote"}
      </Button>
    </form>
  );
}
