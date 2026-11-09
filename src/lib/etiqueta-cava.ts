import { fechaValida, formatoKg, ZONA_HORARIA } from "./formato";
import type { Lote } from "./lotes";
import { productoPorCodigo } from "./mpc";

export function pieEtiqueta(fecha: string) {
  return `CODIGO 22 - PRF - 012 - FECHA EMISION = ${fecha}`;
}

export type EtiquetaCava = {
  tag: string;
  fecha: string;
  hora: string;
  producto: string;
  descripcion: string;
  tipo: string;
  codigo: string;
  kgRecibidos: string;
};

export function etiquetaDeLote(lote: Lote): EtiquetaCava {
  const catalogo = productoPorCodigo(lote.codigo);
  return {
    tag: lote.tag,
    fecha: fechaCorta(lote.fecha),
    hora: horaRecepcion(lote.creadoEn),
    producto: catalogo?.nombre ?? lote.producto,
    descripcion: catalogo?.descripcion ?? "",
    tipo: catalogo?.tipo ?? "",
    codigo: catalogo?.codigo ?? lote.codigo,
    kgRecibidos: formatoKg(lote.kgRecibidos),
  };
}

export function fechaCorta(fecha: string) {
  if (!fechaValida(fecha)) return fecha;
  const [year, month, day] = fecha.split("-");
  return `${day}/${month}/${year}`;
}

export function horaRecepcion(creadoEn: string) {
  const instante = instanteDe(creadoEn);
  if (!instante) return "—";
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: ZONA_HORARIA,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(instante);
}

function instanteDe(creadoEn: string) {
  const texto = creadoEn.trim();
  if (!texto) return null;
  const iso = texto.includes("T") ? texto : texto.replace(" ", "T");
  const conZona = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`;
  const fecha = new Date(conZona);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}
