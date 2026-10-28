"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { eliminarRegistro, insertarRegistro, validarRegistro } from "@/lib/produccion";

export type EstadoRegistro = { error?: string; ok?: boolean } | null;

function texto(formData: FormData, campo: string) {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}

export async function crearRegistro(
  _estado: EstadoRegistro,
  formData: FormData,
): Promise<EstadoRegistro> {
  const validado = validarRegistro({
    fecha: texto(formData, "fecha"),
    turno: texto(formData, "turno"),
    linea: texto(formData, "linea"),
    producto: texto(formData, "producto"),
    cantidad: texto(formData, "cantidad_kg"),
    observaciones: texto(formData, "observaciones"),
  });

  if (!validado.ok) return { error: validado.error };

  insertarRegistro(getDb(), validado.value);
  revalidatePath("/");
  return { ok: true };
}

export async function quitarRegistro(formData: FormData) {
  const id = Number(texto(formData, "id"));
  if (!Number.isInteger(id) || id <= 0) return;
  eliminarRegistro(getDb(), id);
  revalidatePath("/");
}
