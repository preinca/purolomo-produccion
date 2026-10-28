export const TURNOS = [
  { value: "manana", label: "Mañana" },
  { value: "tarde", label: "Tarde" },
  { value: "noche", label: "Noche" },
] as const;

export type Turno = (typeof TURNOS)[number]["value"];

export function etiquetaTurno(turno: string) {
  return TURNOS.find((item) => item.value === turno)?.label ?? turno;
}
