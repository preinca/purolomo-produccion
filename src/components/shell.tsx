"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  Menu,
  PackageSearch,
  QrCode,
  FileSearch,
  Rows3,
  Search,
  Truck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { cerrarSesion } from "@/app/usuarios-acciones";
import { BuscadorGlobal } from "@/components/buscador-global";
import { LogoPurolomo } from "@/components/logo";
import type { Rango } from "@/lib/acceso";
import type { Sugerencia } from "@/lib/sugerencia";
import { cn } from "@/lib/utils";

const grupos = [
  {
    titulo: "Principal",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, admin: false },
      { href: "/stock", label: "Stock disponible", icon: PackageSearch, admin: false },
    ],
  },
  {
    titulo: "Operaciones",
    items: [
      { href: "/inventario", label: "Catálogo CDM", icon: ClipboardList, admin: false },
      { href: "/entradas", label: "Registrar entradas", icon: ArrowDownToLine, admin: true },
      { href: "/receta", label: "Cargar receta", icon: FileSpreadsheet, admin: true },
      { href: "/salidas", label: "Registrar salidas", icon: ArrowUpFromLine, admin: false },
      { href: "/logistica", label: "Registro de Logística", icon: Truck, admin: false },
      { href: "/pesajes", label: "Registro de pesajes", icon: Rows3, admin: false },
      { href: "/minilotes", label: "Buscar mini lote", icon: Search, admin: false },
      { href: "/consulta-pesaje", label: "Buscar pesaje", icon: FileSearch, admin: false },
      { href: "/qr", label: "Consultar Qrs", icon: QrCode, admin: false },
      { href: "/eliminar", label: "Eliminar lote", icon: Trash2, admin: true },
      { href: "/usuarios", label: "Usuarios", icon: Users, admin: true },
    ],
  },
  {
    titulo: "Historiales",
    items: [
      { href: "/historial/entradas", label: "Hist. entradas", icon: History, admin: false },
      { href: "/historial/salidas", label: "Hist. salidas", icon: History, admin: false },
    ],
  },
];

function activo(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function cerrarMenu() {
  const el = document.getElementById("menu-lateral");
  if (el instanceof HTMLInputElement) el.checked = false;
}

export function Shell({
  children,
  sugerencias,
  nombre,
  rango,
}: {
  children: React.ReactNode;
  sugerencias: Sugerencia[];
  nombre: string;
  rango: Rango;
}) {
  const pathname = usePathname();
  const menu = grupos
    .map((grupo) => ({
      ...grupo,
      items: grupo.items.filter((item) => rango === "administrador" || !item.admin),
    }))
    .filter((grupo) => grupo.items.length > 0);

  useEffect(() => {
    cerrarMenu();
  }, [pathname]);

  return (
    <div className="flex min-h-dvh w-full items-stretch">
      <input id="menu-lateral" type="checkbox" className="peer sr-only" />
      <label
        htmlFor="menu-lateral"
        className="fixed inset-0 z-30 hidden bg-black/50 peer-checked:block print:hidden lg:peer-checked:hidden"
        aria-label="Cerrar menú"
      />

      <aside className="fixed inset-y-0 left-0 z-40 flex h-dvh w-[260px] shrink-0 -translate-x-full flex-col bg-navy text-white transition-transform peer-checked:translate-x-0 print:hidden lg:sticky lg:top-0 lg:bottom-auto lg:h-dvh lg:max-h-dvh lg:translate-x-0 lg:self-start">
        <div className="relative flex items-center justify-center px-4 py-4">
          <LogoPurolomo />
          <label
            htmlFor="menu-lateral"
            className="absolute right-3 cursor-pointer rounded-md p-1 text-white/70 hover:bg-white/10 lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="size-4" />
          </label>
        </div>
        <nav className="menu-lateral flex-1 overflow-y-auto px-3 pb-6">
          {menu.map((grupo) => (
            <div key={grupo.titulo} className="mb-4">
              <p className="px-3 pb-1.5 text-[10px] font-semibold tracking-[0.16em] text-white/40 uppercase">
                {grupo.titulo}
              </p>
              <ul className="grid gap-0.5">
                {grupo.items.map((item) => {
                  const Icon = item.icon;
                  const on = activo(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={cerrarMenu}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
                          on
                            ? "bg-purolomo-red font-semibold text-white"
                            : "text-white/80 hover:bg-white/10",
                        )}
                      >
                        <Icon className="size-4 shrink-0 opacity-90" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <p className="px-5 pb-4 text-[11px] text-white/35">
          Planta Embutidos Cagua · Almacén 40602-1
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-black/5 bg-white px-3 py-2.5 print:hidden sm:px-5">
          <label
            htmlFor="menu-lateral"
            className="cursor-pointer rounded-md p-1.5 hover:bg-muted lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </label>
          <BuscadorGlobal sugerencias={sugerencias} />
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold leading-tight">{nombre}</p>
              <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                {rango === "administrador" ? "Administrador" : "Consulta"}
              </p>
            </div>
            <form action={cerrarSesion}>
              <button type="submit" className="h-8 rounded-lg border px-2.5 text-sm font-medium hover:bg-muted">
                Salir
              </button>
            </form>
          </div>
        </header>
        <div className="relative min-h-0 flex-1 bg-[#f4f6f8]">{children}</div>
      </div>
    </div>
  );
}
