"use client";

import { useActionState } from "react";
import { eliminarLoteFormulario, type EstadoFormulario } from "@/app/actions";

export function BotonEliminarTag({ tag }: { tag: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    eliminarLoteFormulario,
    null,
  );

  return (
    <form action={accion} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="tag" value={tag} />
      <input type="hidden" name="confirmar" value="si" />
      <button
        type="submit"
        disabled={pendiente}
        className="inline-flex h-8 items-center rounded-lg border border-red-600 bg-white px-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
        onClick={(evento) => {
          if (!confirm(`¿Seguro que quieres eliminar el TAG ${tag} y su historial?`)) {
            evento.preventDefault();
          }
        }}
      >
        {pendiente ? "Eliminando…" : "Eliminar"}
      </button>
      {estado?.error ? (
        <p role="alert" className="text-xs text-destructive">
          {estado.error}
        </p>
      ) : null}
    </form>
  );
}
