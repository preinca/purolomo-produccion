export type Rango = "administrador" | "consulta";

const RUTAS_ADMIN = ["/inventario", "/entradas", "/receta", "/eliminar", "/usuarios", "/hello"];

export function rutaDeAdmin(pathname: string) {
  return RUTAS_ADMIN.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`));
}

export function puedeEntrar(rango: Rango, pathname: string) {
  if (rango === "administrador") return true;
  return !rutaDeAdmin(pathname);
}
