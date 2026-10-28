"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  ClipboardList,
  History,
  LayoutDashboard,
  Menu,
  PackageSearch,
  QrCode,
  Search,
  Utensils,
  X,
} from "lucide-react";
import { LogoPurolomo } from "@/components/logo";
import { cn } from "@/lib/utils";

const grupos = [
  {
    titulo: "Principal",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/stock", label: "Consultar stock", icon: PackageSearch },
    ],
  },
  {
    titulo: "Operaciones",
    items: [
      { href: "/inventario", label: "Inventario inicial", icon: ClipboardList },
      { href: "/entradas", label: "Registrar entradas", icon: ArrowDownToLine },
      { href: "/salidas", label: "Registrar salidas", icon: ArrowUpFromLine },
      { href: "/consumo", label: "Registrar consumo", icon: Utensils },
      { href: "/qr", label: "Generar QR / Etiquetas", icon: QrCode },
      { href: "/nomenclatura", label: "Leyenda MPC", icon: BookOpen },
    ],
  },
  {
    titulo: "Historiales",
    items: [
      { href: "/historial/entradas", label: "Hist. entradas", icon: History },
      { href: "/historial/salidas", label: "Hist. salidas", icon: History },
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

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    cerrarMenu();
  }, [pathname]);

  return (
    <div className="flex min-h-full">
      <input id="menu-lateral" type="checkbox" className="peer sr-only" />
      <label
        htmlFor="menu-lateral"
        className="fixed inset-0 z-30 hidden bg-black/50 peer-checked:block print:hidden lg:peer-checked:hidden"
        aria-label="Cerrar menú"
      />

      <aside className="fixed inset-y-0 left-0 z-40 flex w-[260px] -translate-x-full flex-col bg-navy text-white transition-transform peer-checked:translate-x-0 print:hidden lg:static lg:translate-x-0">
        <div className="flex items-center justify-between px-4 py-4">
          <LogoPurolomo />
          <label
            htmlFor="menu-lateral"
            className="cursor-pointer rounded-md p-1 text-white/70 hover:bg-white/10 lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="size-4" />
          </label>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-6">
          {grupos.map((grupo) => (
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
          <form action="/stock" className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              placeholder="Buscar producto, TAG o código…"
              className="h-9 w-full rounded-lg border border-input bg-background pr-3 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </form>
          <div className="hidden items-center gap-2 sm:flex">
            <div className="text-right">
              <p className="text-xs font-semibold leading-tight">Planta Cagua</p>
              <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                Almacén producción
              </p>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-purolomo-red text-xs font-bold text-white">
              PL
            </span>
          </div>
        </header>
        <div className="relative flex-1 bg-white">{children}</div>
      </div>
    </div>
  );
}
