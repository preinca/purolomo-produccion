import { formatoFecha, formatoKg } from "@/lib/formato";
import { svgDeTexto, textoQrPesaje } from "@/lib/qr";

export type FichaPesajeQr = {
  id: number;
  numero: number;
  fecha: string;
  linea: string;
  destino: string;
  codigo: string;
  total: number;
  observaciones: string;
  retiros: { tipo: string; kg: number; token: string; tag: string }[];
};

export function QrPesaje({ ficha }: { ficha: FichaPesajeQr }) {
  const svg = svgDeTexto(textoQrPesaje(ficha), 3);
  return (
    <article className="break-inside-avoid rounded-xl border bg-white p-4 text-[#071422]">
      <div className="flex items-start justify-between gap-3 border-b pb-2">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-purolomo.png" alt="Purolomo" className="mb-1 h-7 w-auto object-contain" />
          <p className="text-xs font-semibold text-[#e30613]">Pesaje de producción</p>
        </div>
        <p className="text-lg font-bold">Nº {ficha.numero}</p>
      </div>
      <div className="mt-3 grid grid-cols-[7rem_1fr] items-start gap-3">
        <div className="overflow-hidden rounded-md bg-white" dangerouslySetInnerHTML={{ __html: svg }} />
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <Dato etiqueta="Fecha" valor={formatoFecha(ficha.fecha)} />
          <Dato etiqueta="Línea" valor={ficha.linea} />
          <Dato etiqueta="Uso" valor={ficha.destino} />
          <Dato etiqueta="Total" valor={formatoKg(ficha.total)} />
          <div className="col-span-2">
            <dt className="text-[9px] tracking-wide text-neutral-500 uppercase">Código</dt>
            <dd className="font-mono font-medium break-all">{ficha.codigo || "—"}</dd>
          </div>
        </dl>
      </div>
      {ficha.observaciones.trim() ? (
        <p className="mt-3 rounded-md bg-amber-100 px-2 py-1.5 text-[11px] font-medium text-amber-950">
          Observación: {ficha.observaciones.trim()}
        </p>
      ) : null}
      <ul className="mt-3 grid gap-1 border-t pt-2 text-[11px]">
        {ficha.retiros.map((retiro) => (
          <li key={retiro.token}>
            {retiro.tipo}: {formatoKg(retiro.kg)} · mini lote {retiro.token} · TAG {retiro.tag}
          </li>
        ))}
      </ul>
      <div className="mt-3 print:hidden">
        <a
          href={`/qr/pesaje/${ficha.id}`}
          download={`qr-pesaje-${ficha.numero}.png`}
          className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
        >
          Descargar QR
        </a>
      </div>
    </article>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-[9px] tracking-wide text-neutral-500 uppercase">{etiqueta}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
