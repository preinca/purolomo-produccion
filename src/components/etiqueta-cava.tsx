import { etiquetaDeLote, lineasEtiqueta } from "@/lib/etiqueta-cava";
import type { Lote } from "@/lib/lotes";
import { svgQrEnPantalla } from "@/lib/qr";

export function EtiquetaCava({ lote, nota = true }: { lote: Lote; nota?: boolean }) {
  const etiqueta = etiquetaDeLote(lote);
  const svg = svgQrEnPantalla(lote.tag);
  const lineas = lineasEtiqueta(etiqueta);

  return (
    <div className="grid w-full max-w-xl gap-2">
      <article
        className="grid w-full grid-cols-[minmax(0,1fr)_34%] items-center overflow-hidden bg-white text-black"
        style={{ aspectRatio: "57 / 32" }}
      >
        <div className="flex h-full min-w-0 flex-col justify-between px-2 py-3 leading-none font-bold">
          {lineas.map((linea, indice) => (
            <p key={`${indice}-${linea}`} className={indice === 0 ? "text-2xl sm:text-4xl" : "text-sm sm:text-xl"}>
              {linea}
            </p>
          ))}
        </div>
        <div
          className="mr-1.5 aspect-square w-[88%] justify-self-end bg-white [&_svg]:h-full [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </article>
      {nota ? (
        <p className="text-xs text-muted-foreground">
          Etiqueta de 5,7 cm × 3,2 cm. Se descarga en NLBL para Zebra Designer 3.3 o en PDF.
        </p>
      ) : null}
    </div>
  );
}

export function enlaceNlbl(tag: string) {
  return `/etiquetas/nlbl/${tag}`;
}

export function enlacePdf(tag: string) {
  return `/etiquetas/pdf/${tag}`;
}

