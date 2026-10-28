"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { fechaHoy, fechaValida } from "@/lib/formato";
import {
  insertarRecepcion,
  registrarConsumo,
  registrarDespacho,
  transferirLote,
  validarRecepcion,
} from "@/lib/lotes";

export type EstadoFormulario = { error?: string; ok?: boolean; tag?: string } | null;

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
  revalidatePath("/historial/entradas");
  revalidatePath("/historial/salidas");
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
