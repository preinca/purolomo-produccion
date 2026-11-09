export type Rango = "administrador" | "consulta" | "recepcionista" | "pesador";

const RUTAS_CONSULTA = [
  "/",
  "/stock",
  "/inventario",
  "/nomenclatura",
  "/logistica",
  "/pesajes",
  "/minilotes",
  "/consulta-pesaje",
  "/qr",
  "/etiquetas",
  "/historial",
  "/lote",
];
const RUTAS_RECEPCION = ["/entradas"];
const RUTAS_PESAJE = ["/salidas"];

export function nombreRango(rango: Rango) {
  if (rango === "administrador") return "Administrador";
  if (rango === "recepcionista") return "Recepcionista";
  if (rango === "pesador") return "Pesador";
  return "Consulta";
}

function coincide(rutas: string[], pathname: string) {
  return rutas.some((ruta) => pathname === ruta || (ruta !== "/" && pathname.startsWith(`${ruta}/`)));
}

export function puedeEntrar(rango: Rango, pathname: string) {
  if (rango === "administrador") return true;
  if (coincide(RUTAS_CONSULTA, pathname)) return true;
  if (rango === "recepcionista" && coincide(RUTAS_RECEPCION, pathname)) return true;
  if (rango === "pesador" && coincide(RUTAS_PESAJE, pathname)) return true;
  return false;
}
