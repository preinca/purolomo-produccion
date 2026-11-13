import { formatoFecha, formatoKg } from "@/lib/formato";
import { kgConsumidosDe, kgDisponiblesDe, tagAgotado, type Lote } from "@/lib/lotes";
import { productoPorCodigo } from "@/lib/mpc";
import { svgQrEnPantalla, type RetiroEnQr } from "@/lib/qr";

export function QrEtiqueta({ lote, retiros = [] }: { lote: Lote; retiros?: RetiroEnQr[] }) {
  const tipo = productoPorCodigo(lote.codigo);
  const svg = svgQrEnPantalla(lote.tag);
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
      <div className="mt-3 grid grid-cols-1 items-start gap-3 sm:grid-cols-[12rem_1fr]">
        <div
          className="w-full max-w-48 rounded-md bg-white [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <dl className="grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] min-[420px]:grid-cols-2">
          <Dato etiqueta="Fecha" valor={formatoFecha(lote.fecha)} />
          <Dato etiqueta="Semana" valor={lote.semana} />
          <Dato etiqueta="Producto" valor={lote.producto} />
          <Dato etiqueta="Tipo" valor={tipo ? `${tipo.tipo} · ${tipo.descripcion}` : "—"} />
          <Dato etiqueta="Código" valor={lote.codigo} />
          <Dato etiqueta="Estado" valor={lote.estado} />
          <Dato etiqueta="Kg rec." valor={formatoKg(lote.kgRecibidos)} />
          <Dato etiqueta="Kg consumidos" valor={formatoKg(kgConsumidosDe(lote))} />
          <Dato etiqueta="Kg disponibles" valor={formatoKg(kgDisponiblesDe(lote))} />
          <Dato etiqueta="Para" valor={lote.destino || "—"} />
        </dl>
      </div>
      {lote.observaciones.trim() ? (
        <p className="mt-3 rounded-md bg-amber-100 px-2 py-1.5 text-[11px] font-medium text-amber-950">
          Observación: {lote.observaciones.trim()}
        </p>
      ) : null}
      {lote.estado === "LOGISTICA" ? (
        <p className="mt-3 rounded-md bg-orange-500 px-2 py-1.5 text-[11px] font-medium text-white">
          Este TAG fue trasladado a logística y ya no se puede consumir.
        </p>
      ) : tagAgotado(lote) ? (
        <p className="mt-3 rounded-md bg-red-600 px-2 py-1.5 text-[11px] font-medium text-white">
          Se acabaron todos los kg de esta materia prima. El QR se conserva para la trazabilidad.
        </p>
      ) : null}
      {retiros.length > 0 ? (
        <ul className="mt-3 grid gap-1 border-t pt-2 text-[11px]">
          {retiros.map((retiro) => (
            <li key={retiro.token}>
              Mini lote {retiro.token}: {formatoKg(retiro.kg)} de {retiro.tipo} · pesaje {retiro.pesaje} · línea{" "}
              {retiro.linea} · para {retiro.destino}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 print:hidden">
        <a
          href={`/qr/imagen/${lote.tag}`}
          download={`qr-${lote.tag}.png`}
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
