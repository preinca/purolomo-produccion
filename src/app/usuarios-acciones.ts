"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import {
  alternarActivo,
  autenticar,
  borrarSesion,
  contarUsuarios,
  crearUsuario,
  exigirAdmin,
  guardarSesion,
  validarCuenta,
} from "@/lib/usuarios";

export type EstadoAcceso = { error?: string } | null;

function destino(valor: string) {
  if (!valor.startsWith("/") || valor.startsWith("//") || valor.startsWith("/entrar")) return "/";
  return valor;
}

export async function entrar(_estado: EstadoAcceso, formData: FormData): Promise<EstadoAcceso> {
  const usuario = String(formData.get("usuario") ?? "");
  const clave = String(formData.get("clave") ?? "");
  const cuenta = await autenticar(getDb(), usuario, clave);
  if (!cuenta) return { error: "Usuario o clave incorrectos." };
  await guardarSesion(cuenta);
  redirect(destino(String(formData.get("siguiente") ?? "")));
}

export async function crearPrimerAdministrador(
  _estado: EstadoAcceso,
  formData: FormData,
): Promise<EstadoAcceso> {
  const db = getDb();
  if (await contarUsuarios(db) > 0) return { error: "Ya existe un administrador. Inicia sesión." };
  const clave = String(formData.get("clave") ?? "");
  if (clave !== String(formData.get("repetir") ?? "")) return { error: "Las claves no coinciden." };
  const validado = validarCuenta({
    nombre: String(formData.get("nombre") ?? ""),
    usuario: String(formData.get("usuario") ?? ""),
    clave,
    rango: "administrador",
  });
  if (!validado.ok) return { error: validado.error };
  const creado = await crearUsuario(db, validado.value);
  if (!creado.ok) return { error: creado.error };
  const cuenta = await autenticar(db, validado.value.usuario, clave);
  if (!cuenta) return { error: "No se pudo abrir la sesión." };
  await guardarSesion(cuenta);
  redirect("/");
}

export async function crearUsuarioFormulario(
  _estado: EstadoAcceso,
  formData: FormData,
): Promise<EstadoAcceso> {
  await exigirAdmin();
  const validado = validarCuenta({
    nombre: String(formData.get("nombre") ?? ""),
    usuario: String(formData.get("usuario") ?? ""),
    clave: String(formData.get("clave") ?? ""),
    rango: String(formData.get("rango") ?? ""),
  });
  if (!validado.ok) return { error: validado.error };
  const creado = await crearUsuario(getDb(), validado.value);
  if (!creado.ok) return { error: creado.error };
  revalidatePath("/usuarios");
  return {};
}

export async function alternarUsuario(formData: FormData) {
  const sesion = await exigirAdmin();
  const id = Number(formData.get("id"));
  const resultado = await alternarActivo(getDb(), id, sesion);
  if (!resultado.ok) redirect(`/usuarios?error=${encodeURIComponent(resultado.error)}`);
  redirect("/usuarios");
}

export async function cerrarSesion() {
  await borrarSesion();
  redirect("/entrar");
}
