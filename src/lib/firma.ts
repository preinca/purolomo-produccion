import { createHmac, timingSafeEqual } from "node:crypto";
import type { Rango } from "./acceso";

const SECRETO = process.env.SESION_SECRETO || "purolomo-cagua-40602-sesion-v1";

export type Sesion = {
  id: number;
  usuario: string;
  nombre: string;
  rango: Rango;
  exp: number;
};

// Con `true` no se pide iniciar sesión y Salir no cierra nada: todos entran como
// administrador de demostración. Déjalo en `false` para exigir usuario y clave.
export const LOGIN_DESACTIVADO = false;

export const SESION_DEMO: Sesion = {
  id: 0,
  usuario: "demo",
  nombre: "Demostración",
  rango: "administrador",
  exp: Number.MAX_SAFE_INTEGER,
};

export function firmarSesion(datos: Sesion) {
  const cuerpo = Buffer.from(JSON.stringify(datos)).toString("base64url");
  const firma = createHmac("sha256", SECRETO).update(cuerpo).digest("base64url");
  return `${cuerpo}.${firma}`;
}

export function leerFirma(token: string | undefined | null): Sesion | null {
  if (!token) return null;
  const punto = token.lastIndexOf(".");
  if (punto <= 0) return null;
  const cuerpo = token.slice(0, punto);
  const firma = token.slice(punto + 1);
  const esperada = createHmac("sha256", SECRETO).update(cuerpo).digest("base64url");
  const recibida = Buffer.from(firma);
  const correcta = Buffer.from(esperada);
  if (recibida.length !== correcta.length || !timingSafeEqual(recibida, correcta)) return null;
  try {
    const datos = JSON.parse(Buffer.from(cuerpo, "base64url").toString()) as Sesion;
    if (!Number.isFinite(datos.exp) || datos.exp < Date.now()) return null;
    if (
      datos.rango !== "administrador" &&
      datos.rango !== "consulta" &&
      datos.rango !== "recepcionista" &&
      datos.rango !== "pesador"
    ) {
      return null;
    }
    if (!datos.usuario || !datos.nombre) return null;
    return datos;
  } catch {
    return null;
  }
}
