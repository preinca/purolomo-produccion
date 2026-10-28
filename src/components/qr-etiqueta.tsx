import { formatoFecha, formatoKg } from "@/lib/formato";
import { productoPorCodigo } from "@/lib/mpc";
import { svgQr } from "@/lib/qr";
import type { Lote } from "@/lib/lotes";

export function QrEtiqueta({ lote }: { lote: Lote }) {
  const tipo = productoPorCodigo(lote.codigo);
  return (
    <article className="break-inside-avoid rounded-xl border bg-white p-4 text-[#071422]">
      <div className="flex items-start justify-between gap-3 border-b pb-2">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-purolomo.png"
            alt="Purolomo"
            className="mb-1 h-7 w-auto object-contain"
          />
          <p className="text-xs font-semibold text-[#e30613]">Control de recepción MPC</p>
        </div>
        <p className="font-mono text-lg font-bold">{lote.tag}</p>
      </div>
      <div className="mt-3 grid grid-cols-[7rem_1fr] items-start gap-3">
        <div
          className="overflow-hidden rounded-md bg-white"
          dangerouslySetInnerHTML={{ __html: svgQr(lote, 3) }}
        />
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <Dato etiqueta="Fecha" valor={formatoFecha(lote.fecha)} />
          <Dato etiqueta="Semana" valor={lote.semana} />
          <Dato etiqueta="Producto" valor={lote.producto} />
          <Dato etiqueta="Tipo" valor={tipo ? `${tipo.tipo} · ${tipo.descripcion}` : "—"} />
          <Dato etiqueta="Código" valor={lote.codigo} />
          <Dato etiqueta="Estado" valor={lote.estado} />
          <Dato etiqueta="Kg rec." valor={formatoKg(lote.kgRecibidos)} />
          <Dato etiqueta="Kg desp." valor={formatoKg(lote.kgDespachados)} />
          <Dato etiqueta="Kg cons." valor={formatoKg(lote.kgConsumidos)} />
        </dl>
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
