"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { coincideBusqueda } from "@/lib/coincide";
import type { Sugerencia } from "@/lib/sugerencia";

export function BuscadorGlobal({ sugerencias }: { sugerencias: Sugerencia[] }) {
  const ruta = usePathname();
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const consulta = texto.trim();
  const visibles = consulta
    ? sugerencias.filter((item) => coincideBusqueda(consulta, [item.titulo, item.detalle])).slice(0, 8)
    : [];

  useEffect(() => {
    setAbierto(false);
    setTexto("");
  }, [ruta]);

  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={texto}
        placeholder="Buscar TAG, mini lote o pesaje…"
        className="h-9 w-full rounded-lg border border-input bg-background pr-3 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        onChange={(evento) => {
          setTexto(evento.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
      />
      {abierto && consulta ? (
        <ul className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-lg border bg-white shadow-lg">
          {visibles.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias.</li>
          ) : (
            visibles.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="grid gap-0.5 px-3 py-2 hover:bg-muted">
                  <span className="font-mono text-sm font-medium break-all">{item.titulo}</span>
                  <span className="text-xs text-muted-foreground">{item.detalle}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
