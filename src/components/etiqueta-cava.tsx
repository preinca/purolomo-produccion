import { etiquetaDeLote, pieEtiqueta } from "@/lib/etiqueta-cava";
import type { Lote } from "@/lib/lotes";
import { svgQr } from "@/lib/qr";

export function EtiquetaCava({ lote }: { lote: Lote }) {
  const etiqueta = etiquetaDeLote(lote);
  const svg = svgQr(lote, 5);

  const detalle = [etiqueta.descripcion, etiqueta.tipo].filter(Boolean).join(" - ");

  return (
    <div className="grid w-full max-w-lg gap-2">
      <article
        className="grid w-full grid-rows-[1fr_auto] overflow-hidden border border-black bg-white text-black"
        style={{ aspectRatio: "5.7 / 3.2" }}
      >
        <div className="grid min-h-0 grid-cols-[38%_1fr]">
          <div
            className="min-h-0 bg-white p-0.5 [&_svg]:h-full [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div className="flex min-w-0 flex-col justify-between py-1 pr-1.5 leading-none">
            <p className="font-mono text-xl font-bold">{etiqueta.tag}</p>
            <p className="truncate text-sm font-bold">{etiqueta.producto}</p>
            {detalle ? <p className="truncate text-sm font-semibold">{detalle}</p> : null}
            <p className="truncate font-mono text-base font-bold">{etiqueta.codigo}</p>
            <p className="text-base font-bold">{etiqueta.kgRecibidos}</p>
            <p className="text-sm font-bold">{etiqueta.fecha}</p>
            <p className="text-sm font-bold">{etiqueta.hora}</p>
          </div>
        </div>
        <p className="border-t border-black px-1 py-0.5 text-center text-[11px] leading-tight font-bold">
          {pieEtiqueta(etiqueta.fecha)}
        </p>
      </article>
      <p className="text-xs text-muted-foreground">Etiqueta adhesiva de 5,7 cm × 3,2 cm.</p>
    </div>
  );
}

export function enlacePdf(tag: string) {
  return `/etiquetas/pdf/${tag}`;
}
