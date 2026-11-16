"use client";

import { useActionState } from "react";
import { imprimirEtiquetaZebra, type EstadoFormulario } from "@/app/actions";

export function BotonImprimirZebra({ tag }: { tag: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    imprimirEtiquetaZebra,
    null,
  );

  return (
    <form action={accion} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="tag" value={tag} />
      <button
        type="submit"
        disabled={pendiente}
        className="inline-flex h-8 items-center rounded-lg border border-blue-600 bg-white px-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
        onClick={(evento) => {
          if (!confirm(`¿Enviar el TAG ${tag} a la impresora Zebra?`)) {
            evento.preventDefault();
          }
        }}
      >
        {pendiente ? "Enviando…" : estado?.ok ? "Enviado" : "Imprimir Zebra"}
      </button>
      {estado?.error ? (
        <p role="alert" className="text-xs text-destructive">
          {estado.error}
        </p>
      ) : null}
      {estado?.ok ? (
        <p role="status" className="text-xs text-emerald-700">
          En cola para la Zebra.
        </p>
      ) : null}
    </form>
  );
}
