import { etiquetaDeLote } from "@/lib/etiqueta-cava";
import type { Lote } from "@/lib/lotes";
import { svgQr } from "@/lib/qr";

export function EtiquetaCava({ lote }: { lote: Lote }) {
  const etiqueta = etiquetaDeLote(lote);
  const svg = svgQr(lote, 5);
  const detalle = partir(etiqueta.descripcion);

  return (
    <div className="grid w-full max-w-xl gap-2">
      <article
        className="grid w-full grid-cols-[1fr_42%] items-stretch overflow-hidden border border-black bg-white px-3 py-2 text-black"
        style={{ aspectRatio: "104 / 50.8" }}
      >
        <div className="flex min-w-0 flex-col justify-between py-0.5 pr-2 leading-none font-bold">
          <p className="font-mono text-2xl">{etiqueta.tag}</p>
          <p className="truncate text-sm">{etiqueta.producto}</p>
          {detalle.map((linea) => (
            <p key={linea} className="truncate text-sm">
              {linea}
            </p>
          ))}
          <p className="truncate font-mono text-base">{etiqueta.codigo}</p>
          <p className="text-base">{etiqueta.kgRecibidos}</p>
          <p className="text-sm">{etiqueta.fecha}</p>
          <p className="text-sm">{etiqueta.hora}</p>
        </div>
        <div className="min-h-0 bg-white [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      </article>
      <p className="text-xs text-muted-foreground">
        Etiqueta de 10,4 cm × 5,1 cm para abrir e imprimir en Zebra Designer.
      </p>
    </div>
  );
}

export function enlaceNlbl(tag: string) {
  return `/etiquetas/nlbl/${tag}`;
}

function partir(texto: string) {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  if (palabras.length <= 1) return palabras;
  const corte = Math.ceil(palabras.length / 2);
  return [palabras.slice(0, corte).join(" "), palabras.slice(corte).join(" ")];
}
