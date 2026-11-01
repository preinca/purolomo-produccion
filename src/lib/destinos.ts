/** Producto terminado y presentación donde se usa la materia prima. */
export const DESTINOS = [
  "PDM 1K",
  "PDM 1/2 K",
  "ALIBAL 1 K",
  "HM ESP 1 KG",
  "HM SUP 1KG",
  "CON TODO 900 GR",
  "BOLOGNA",
  "PDM 3 KG",
] as const;

export type Destino = (typeof DESTINOS)[number];

export function destinoValido(valor: string): valor is Destino {
  return (DESTINOS as readonly string[]).includes(valor);
}
