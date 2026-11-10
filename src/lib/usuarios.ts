import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Db } from "./db";
import type { Rango } from "./acceso";
import { claveValida, hashClave } from "./claves";
import { LOGIN_DESACTIVADO, SESION_DEMO, firmarSesion, leerFirma, type Sesion } from "./firma";

export type Usuario = {
  id: number;
  nombre: string;
  usuario: string;
  rango: Rango;
  activo: boolean;
};

const DURACION = 1000 * 60 * 60 * 12;

function rangoDe(valor: unknown): Rango {
  if (valor === "administrador" || valor === "recepcionista" || valor === "pesador" || valor === "consulta") {
    return valor;
  }
  return "consulta";
}

function filaUsuario(row: Record<string, unknown>): Usuario {
  return {
    id: Number(row.id),
    nombre: String(row.nombre),
    usuario: String(row.usuario),
    rango: rangoDe(row.rango),
    activo: Number(row.activo) === 1,
  };
}

export async function contarUsuarios(db: Db) {
  const fila = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM usuarios");
  return Number(fila?.n ?? 0);
}

export async function listarUsuarios(db: Db) {
  const filas = await db.all<Record<string, unknown>>(
    "SELECT id, nombre, usuario, rango, activo FROM usuarios ORDER BY nombre",
  );
  return filas.map(filaUsuario);
}

export function validarCuenta(input: { nombre: string; usuario: string; clave: string; rango: string }) {
  const nombre = input.nombre.trim();
  const usuario = input.usuario.trim().toLowerCase();
  const clave = input.clave;
  if (nombre.length < 2) return { ok: false as const, error: "Escribe el nombre." };
  if (!/^[a-z0-9._-]{3,20}$/.test(usuario)) {
    return { ok: false as const, error: "El usuario lleva de 3 a 20 letras o números, sin espacios." };
  }
  if (clave.length < 4) return { ok: false as const, error: "La clave tiene que tener al menos 4 caracteres." };
  if (
    input.rango !== "administrador" &&
    input.rango !== "consulta" &&
    input.rango !== "recepcionista" &&
    input.rango !== "pesador"
  ) {
    return { ok: false as const, error: "Elige el rango del usuario." };
  }
  const rango: Rango = input.rango;
  return { ok: true as const, value: { nombre, usuario, clave, rango } };
}

export async function crearUsuario(
  db: Db,
  input: { nombre: string; usuario: string; clave: string; rango: Rango },
) {
  const existe = await db.get("SELECT id FROM usuarios WHERE lower(usuario) = lower(?)", input.usuario);
  if (existe) return { ok: false as const, error: "Ese usuario ya existe." };
  const creado = await db.run(
    `INSERT INTO usuarios (nombre, usuario, clave, rango) VALUES (?, ?, ?, ?)
     ON CONFLICT ((lower(usuario))) DO NOTHING`,
    input.nombre,
    input.usuario,
    hashClave(input.clave),
    input.rango,
  );
  if (creado === 0) return { ok: false as const, error: "Ese usuario ya existe." };
  return { ok: true as const };
}

export async function autenticar(db: Db, usuario: string, clave: string) {
  const fila = await db.get<Record<string, unknown>>(
    "SELECT * FROM usuarios WHERE lower(usuario) = lower(?)",
    usuario.trim(),
  );
  if (!fila || Number(fila.activo) !== 1) return null;
  if (!claveValida(clave, String(fila.clave))) return null;
  return filaUsuario(fila);
}

export async function alternarActivo(db: Db, id: number, quien: Sesion) {
  if (!Number.isInteger(id)) return { ok: false as const, error: "No existe ese usuario." };
  const fila = await db.get<Record<string, unknown>>("SELECT * FROM usuarios WHERE id = ?", id);
  if (!fila) return { ok: false as const, error: "No existe ese usuario." };
  const usuario = filaUsuario(fila);
  if (usuario.id === quien.id) return { ok: false as const, error: "No puedes desactivar tu propio usuario." };
  if (usuario.activo && usuario.rango === "administrador") {
    const otros = await db.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM usuarios WHERE rango = 'administrador' AND activo = 1 AND id <> ?",
      id,
    );
    if (Number(otros?.n ?? 0) === 0) return { ok: false as const, error: "Tiene que quedar al menos un administrador activo." };
  }
  await db.run("UPDATE usuarios SET activo = ? WHERE id = ?", usuario.activo ? 0 : 1, id);
  return { ok: true as const };
}

export async function leerSesion() {
  if (LOGIN_DESACTIVADO) return SESION_DEMO;
  const jar = await cookies();
  return leerFirma(jar.get("sesion")?.value);
}

export async function sesionSigueActiva(db: Db, sesion: Sesion) {
  if (LOGIN_DESACTIVADO && sesion.id === SESION_DEMO.id) return true;
  if (!Number.isInteger(sesion.id)) return false;
  const fila = await db.get<{ activo: number }>("SELECT activo FROM usuarios WHERE id = ?", sesion.id);
  return !!fila && Number(fila.activo) === 1;
}

export async function guardarSesion(usuario: Usuario) {
  const token = firmarSesion({
    id: usuario.id,
    usuario: usuario.usuario,
    nombre: usuario.nombre,
    rango: usuario.rango,
    exp: Date.now() + DURACION,
  });
  const jar = await cookies();
  jar.set("sesion", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: DURACION / 1000 });
}

export async function borrarSesion() {
  const jar = await cookies();
  jar.set("sesion", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function exigirSesion() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");
  return sesion;
}

export async function exigirAdmin() {
  return exigirRango(["administrador"]);
}

export async function exigirRango(roles: Rango[]) {
  const sesion = await exigirSesion();
  if (!roles.includes(sesion.rango)) redirect("/");
  return sesion;
}
