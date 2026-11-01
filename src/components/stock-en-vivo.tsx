"use client";

import { useMemo, useState } from "react";
import { CampoFiltro } from "@/components/campo-filtro";
import { TablaLotes } from "@/components/tabla-lotes";
import { Card, CardContent } from "@/components/ui/card";
import { coincideBusqueda } from "@/lib/coincide";
import type { Lote } from "@/lib/lotes";

export function StockEnVivo({ lotes }: { lotes: Lote[] }) {
  const [texto, setTexto] = useState("");
  const consulta = texto.trim();
  const visibles = useMemo(
    () =>
      consulta
        ? lotes.filter((lote) =>
            coincideBusqueda(consulta, [lote.tag, lote.producto, lote.codigo, lote.semana, lote.destino]),
          )
        : lotes,
    [consulta, lotes],
  );

  return (
    <div className="grid gap-4">
      <CampoFiltro
        etiqueta="Buscar"
        placeholder="TAG, producto o código"
        valor={texto}
        alCambiar={setTexto}
      />
      <Card>
        <CardContent className="pt-4">
          <TablaLotes
            lotes={visibles}
            mostrarEstado={false}
            vacio={consulta ? "Ningún lote coincide con esa búsqueda." : "La base todavía no tiene paletas."}
          />
        </CardContent>
      </Card>
    </div>
  );
}
