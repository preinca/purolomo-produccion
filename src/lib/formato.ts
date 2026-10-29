export const ZONA_HORARIA = "America/Caracas";

export function fechaHoy(ahora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

export function fechaValida(fecha: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function formatoFecha(fecha: string) {
  if (!fechaValida(fecha)) return fecha;
  const [year, month, day] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-VE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatoHora(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: ZONA_HORARIA,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatoKg(valor: number) {
  return `${new Intl.NumberFormat("es-VE", {
    maximumFractionDigits: 2,
  }).format(valor)} kg`;
}

export function formatoNumero(valor: number, decimales = 0) {
  return new Intl.NumberFormat("es-VE", {
    maximumFractionDigits: decimales,
    minimumFractionDigits: 0,
  }).format(valor);
}

/** Semana ISO a partir de una fecha calendario YYYY-MM-DD. */
export function semanaDe(fecha: string) {
  if (!fechaValida(fecha)) return "";
  const [year, month, day] = fecha.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `SEMANA ${week}`;
}
