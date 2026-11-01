"use client";

import { useMemo, useState } from "react";
import { CampoFiltro } from "@/components/campo-filtro";
import { QrEtiqueta } from "@/components/qr-etiqueta";
import { coincideBusqueda } from "@/lib/coincide";
import type { Lote } from "@/lib/lotes";
import type { RetiroEnQr } from "@/lib/qr";

export function QrEnVivo({
  etiquetas,
}: {
  etiquetas: { lote: Lote; retiros: RetiroEnQr[] }[];
}) {
  const [texto, setTexto] = useState("");
  const consulta = texto.trim();
  const visibles = useMemo(() => {
    const lista = consulta
      ? etiquetas.filter((item) =>
          coincideBusqueda(consulta, [
            item.lote.tag,
            item.lote.producto,
            item.lote.codigo,
            item.lote.destino,
            ...item.retiros.map((retiro) => retiro.token),
          ]),
        )
      : etiquetas;
    return lista.slice(0, 48);
  }, [consulta, etiquetas]);

  return (
    <div className="grid gap-4">
      <div className="print:hidden">
        <CampoFiltro
          etiqueta="TAG o producto"
          placeholder="Escribe el TAG, aunque sea una parte"
          valor={texto}
          alCambiar={setTexto}
        />
      </div>
      {visibles.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No hay TAG para etiquetar.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibles.map((item) => (
            <QrEtiqueta key={item.lote.tag} lote={item.lote} retiros={item.retiros} />
          ))}
        </div>
      )}
    </div>
  );
}
