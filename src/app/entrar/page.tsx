import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormularioEntrada } from "@/components/formulario-entrada";
import { LogoPurolomo } from "@/components/logo";
import { getDb } from "@/lib/db";
import { contarUsuarios, leerSesion } from "@/lib/usuarios";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Cargando…</p>}>
      <Entrada searchParams={searchParams} />
    </Suspense>
  );
}

function texto(valor: string | string[] | undefined) {
  const leido = Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
  if (!leido.startsWith("/") || leido.startsWith("//") || leido.startsWith("/entrar")) return "";
  return leido;
}

async function Entrada({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  if (await leerSesion()) redirect("/");
  const siguiente = texto((await searchParams).siguiente);
  const primero = contarUsuarios(getDb()) === 0;

  return (
    <main className="grid min-h-dvh place-items-center bg-white px-4 py-10">
      <section className="grid w-full max-w-sm gap-6">
        <LogoPurolomo />
        <div>
          <h1 className="text-2xl font-semibold">{primero ? "Crear administrador" : "Iniciar sesión"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {primero
              ? "La primera vez se crea el usuario administrador. Después, desde Usuarios, se agregan las cuentas de consulta."
              : "Entra con tu usuario para ver el almacén y los pesajes."}
          </p>
        </div>
        <FormularioEntrada modo={primero ? "crear" : "entrar"} siguiente={siguiente} />
      </section>
    </main>
  );
}
