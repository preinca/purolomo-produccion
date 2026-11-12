"use server";

import { buscarSugerencias } from "@/lib/busqueda";
import { getDb } from "@/lib/db";
import { exigirSesion } from "@/lib/usuarios";

export async function buscarSugerenciasAccion(consulta: string) {
  await exigirSesion();
  return buscarSugerencias(getDb(), consulta.slice(0, 40));
}
