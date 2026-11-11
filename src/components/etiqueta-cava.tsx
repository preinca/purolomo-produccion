import { etiquetaDeLote, lineasEtiqueta } from "@/lib/etiqueta-cava";
import type { Lote } from "@/lib/lotes";
import { svgQr } from "@/lib/qr";

export function EtiquetaCava({ lote }: { lote: Lote }) {
  const etiqueta = etiquetaDeLote(lote);
  const svg = svgQr(lote, 6);
  const lineas = lineasEtiqueta(etiqueta);

  return (
    <div className="grid w-full max-w-xl gap-2">
      <article
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-stretch overflow-hidden bg-white text-black"
        style={{ aspectRatio: "57 / 32" }}
      >
        <div className="flex min-w-0 flex-col justify-between px-1.5 py-1 leading-none font-bold">
          {lineas.map((linea, indice) => (
            <p key={`${indice}-${linea}`} className="text-lg sm:text-2xl">
              {linea}
            </p>
          ))}
        </div>
        <div className="aspect-square h-full bg-white [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      </article>
      <p className="text-xs text-muted-foreground">
        Etiqueta de 5,7 cm × 3,2 cm para abrir e imprimir en Zebra Designer 3.3.
      </p>
    </div>
  );
}

export function enlaceNlbl(tag: string) {
  return `/etiquetas/nlbl/${tag}`;
}

