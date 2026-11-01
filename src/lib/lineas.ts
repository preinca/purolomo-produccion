/** Capacidad máxima de kilos que admite cada línea en una salida. */
export const LINEAS = [
  { id: "1", nombre: "Línea 1", capacidadKg: 1800 },
  { id: "2", nombre: "Línea 2", capacidadKg: 3600 },
] as const;

export type LineaId = (typeof LINEAS)[number]["id"];

export function lineaPorId(id: string) {
  return LINEAS.find((linea) => linea.id === id) ?? null;
}
