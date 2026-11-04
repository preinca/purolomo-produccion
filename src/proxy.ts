import { NextResponse, type NextRequest } from "next/server";
import { puedeEntrar } from "@/lib/acceso";
import { LOGIN_DESACTIVADO, leerFirma } from "@/lib/firma";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (LOGIN_DESACTIVADO) {
    if (pathname !== "/entrar") return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (pathname === "/entrar") return NextResponse.next();

  const sesion = leerFirma(request.cookies.get("sesion")?.value);
  if (!sesion) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = pathname === "/" ? "" : `siguiente=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  if (!puedeEntrar(sesion.rango, pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo-purolomo.png).*)"],
};
