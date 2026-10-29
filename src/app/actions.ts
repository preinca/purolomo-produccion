"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { fechaHoy, fechaValida } from "@/lib/formato";
import {
  buscarLote,
  eliminarLote,
  insertarRecepcion,
  kgRestantes,
  registrarConsumo,
  registrarDespacho,
  transferirLote,
  validarRecepcion,
} from "@/lib/lotes";
import { productoPorCodigo } from "@/lib/mpc";
import { leerTextoQr } from "@/lib/qr";

export type EstadoFormulario = { error?: string; ok?: boolean; tag?: string } | null;

export type LoteLeido = {
  tag: string;
  fecha: string;
  semana: string;
  producto: string;
  tipo: string;
  codigo: string;
  kgRecibidos: number;
  kgDespachados: number;
  kgConsumidos: number;
  kgRestantes: number;
  estado: string;
};

function texto(formData: FormData, campo: string) {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}

function kilos(formData: FormData, campo: string) {
  return Number(texto(formData, campo).replace(",", "."));
}

function refrescar() {
  revalidatePath("/");
  revalidatePath("/stock");
  revalidatePath("/entradas");
  revalidatePath("/salidas");
  revalidatePath("/consumo");
  revalidatePath("/qr");
  revalidatePath("/eliminar");
  revalidatePath("/historial/entradas");
  revalidatePath("/historial/salidas");
}

export async function loteActualDesdeQr(
  textoQr: string,
): Promise<{ ok: true; lote: LoteLeido } | { ok: false; error: string }> {
  const lectura = leerTextoQr(textoQr);
  if (!lectura) return { ok: false, error: "Ese QR no es de una paleta de este almacén." };
  const lote = buscarLote(getDb(), lectura.tag);
  if (!lote) return { ok: false, error: `No hay un lote con el TAG ${lectura.tag}.` };
  const catalogo = productoPorCodigo(lote.codigo);
  return {
    ok: true,
    lote: {
      tag: lote.tag,
      fecha: lote.fecha,
      semana: lote.semana,
      producto: lote.producto,
      tipo: catalogo ? `${catalogo.tipo} · ${catalogo.descripcion}` : lectura.tipo,
      codigo: lote.codigo,
      kgRecibidos: lote.kgRecibidos,
      kgDespachados: lote.kgDespachados,
      kgConsumidos: lote.kgConsumidos,
      kgRestantes: kgRestantes(lote),
      estado: lote.estado,
    },
  };
}

export async function crearRecepcion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const validado = validarRecepcion({
    fecha: texto(formData, "fecha"),
    tag: texto(formData, "tag"),
    codigo: texto(formData, "codigo"),
    cantidad: texto(formData, "kg_recibidos"),
  });
  if (!validado.ok) return { error: validado.error };

  const resultado = insertarRecepcion(getDb(), {
    ...validado.value,
    observaciones: texto(formData, "observaciones").trim().slice(0, 500),
  });
  if (!resultado.ok) return { error: resultado.error };
  refrescar();
  return { ok: true, tag: resultado.value.tag };
}

export async function validarTransferencia(formData: FormData) {
  const tag = texto(formData, "tag");
  const resultado = transferirLote(getDb(), tag, fechaHoy());
  if (!resultado.ok) return;
  refrescar();
  revalidatePath(`/lote/${tag}`);
}

export async function crearDespacho(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const tag = texto(formData, "tag").trim();
  const fecha = texto(formData, "fecha");
  const kg = kilos(formData, "kg");
  if (!fechaValida(fecha)) return { error: "Indica una fecha válida." };
  const resultado = registrarDespacho(getDb(), {
    tag,
    fecha,
    kg,
    nota: texto(formData, "nota").trim().slice(0, 500),
  });
  if (!resultado.ok) return { error: resultado.error };
  refrescar();
  revalidatePath(`/lote/${tag}`);
  return { ok: true, tag };
}

export async function eliminarLoteFormulario(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const tag = texto(formData, "tag").trim();
  if (texto(formData, "confirmar") !== "si") {
    return { error: "Confirma que quieres eliminar el lote." };
  }
  const resultado = eliminarLote(getDb(), tag);
  if (!resultado.ok) return { error: resultado.error };
  refrescar();
  revalidatePath(`/lote/${tag}`);
  redirect(`/eliminar?eliminado=${encodeURIComponent(tag)}`);
}

export async function crearConsumo(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const tag = texto(formData, "tag").trim();
  const fecha = texto(formData, "fecha");
  const kg = kilos(formData, "kg");
  if (!fechaValida(fecha)) return { error: "Indica una fecha válida." };
  const resultado = registrarConsumo(getDb(), {
    tag,
    fecha,
    kg,
    nota: texto(formData, "nota").trim().slice(0, 500),
  });
  if (!resultado.ok) return { error: resultado.error };
  refrescar();
  revalidatePath(`/lote/${tag}`);
  return { ok: true, tag };
}
