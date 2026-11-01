import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashClave(clave: string) {
  const sal = randomBytes(16).toString("base64url");
  const hash = scryptSync(clave, sal, 32).toString("base64url");
  return `scrypt$${sal}$${hash}`;
}

export function claveValida(clave: string, guardada: string) {
  const partes = guardada.split("$");
  if (partes.length !== 3 || partes[0] !== "scrypt") return false;
  const actual = scryptSync(clave, partes[1], 32);
  const esperada = Buffer.from(partes[2], "base64url");
  return actual.length === esperada.length && timingSafeEqual(actual, esperada);
}
