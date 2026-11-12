"use client";

import { useState } from "react";

export function ConfirmarAccion({
  action,
  proceso,
  pregunta,
  boton,
  confirmar,
  claseBoton,
  claseConfirmar,
}: {
  action: (formData: FormData) => void | Promise<void>;
  proceso: number;
  pregunta: string;
  boton: string;
  confirmar: string;
  claseBoton: string;
  claseConfirmar?: string;
}) {
  const [preguntaAbierta, setPreguntaAbierta] = useState(false);

  if (preguntaAbierta) {
    return (
      <div className="grid gap-4 rounded-xl border-2 border-amber-400 bg-amber-50 px-5 py-5">
        <p className="text-lg font-semibold leading-snug text-amber-950 sm:text-xl">{pregunta}</p>
        <form action={action} className="grid gap-3">
          <input type="hidden" name="proceso" value={String(proceso)} />
          <button type="submit" className={claseConfirmar ?? claseBoton}>
            {confirmar}
          </button>
          <button
            type="button"
            onClick={() => setPreguntaAbierta(false)}
            className="inline-flex h-14 w-full items-center justify-center rounded-xl border border-border bg-white px-6 text-base font-semibold"
          >
            No, volver
          </button>
        </form>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setPreguntaAbierta(true)} className={claseBoton}>
      {boton}
    </button>
  );
}
