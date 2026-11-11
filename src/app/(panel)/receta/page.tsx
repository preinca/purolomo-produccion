import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { eliminarRecetaFormulario } from "@/app/actions";
import { CargarRecetaForm } from "@/components/cargar-receta-form";
import { PageFrame } from "@/components/page-frame";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { formatoKg } from "@/lib/formato";
import { recetasCargadas } from "@/lib/recetas";

export default function Page({ searchParams }: PageProps<"/receta">) {
  return (
    <PageFrame
      titulo="Cargar receta"
      descripcion="Al empezar la jornada se carga la receta de Alibal 1 kg. Después, en Registrar salidas, solo se puede retirar lo que esa receta permite."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <Receta searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}

async function Receta({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const parametros = await searchParams;
  const alerta = leer(parametros.alerta);
  const recetas = await recetasCargadas(getDb());

  return (
    <div className="grid items-start gap-8 xl:grid-cols-2">
      {alerta ? (
        <p role="alert" className="rounded-xl border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive xl:col-span-2">
          {alerta}
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Nueva receta</CardTitle>
          <CardDescription>Indica la línea y sube el Excel con los kilos de esa línea.</CardDescription>
        </CardHeader>
        <CardContent>
          <CargarRecetaForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recetas cargadas</CardTitle>
          <CardDescription>La línea 2 lleva el doble de cada materia prima que la línea 1.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {recetas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay una receta para esta jornada.</p>
          ) : (
            recetas.map((receta) => (
              <section key={receta.id} className="grid gap-1 text-sm">
                <p className="font-medium">
                  Alibal 1 kg · Línea {receta.linea} · {formatoKg(receta.objetivoKg)}
                </p>
                <p className="text-muted-foreground">
                  Tolerancia del pesaje {formatoKg(receta.toleranciaKg)}. Rango {formatoKg(receta.minimoKg)} a {formatoKg(receta.maximoKg)}.
                </p>
                <ul className="grid gap-1">
                  {receta.items.map((item) => (
                    <li key={item.tipo}>
                      {item.tipo}: {formatoKg(item.kg)} · tolerancia {formatoKg(item.tolerancia ?? receta.toleranciaKg)} · rango {formatoKg(item.minimo ?? item.kg)} a {formatoKg(item.maximo ?? item.kg)}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <a
                    href={`/receta/excel/${receta.linea}`}
                    className={buttonVariants({ variant: "outline", className: "w-fit" })}
                  >
                    Descargar Excel
                  </a>
                  <form action={eliminarRecetaFormulario} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="linea" value={receta.linea} />
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="confirmar" value="si" required className="size-4" />
                      Confirmo eliminar
                    </label>
                    <button type="submit" className={buttonVariants({ variant: "destructive" })}>
                      Eliminar receta
                    </button>
                  </form>
                </div>
              </section>
            ))
          )}
          <Link href="/salidas" className="w-fit text-sm font-medium underline">
            Ir a registrar salidas
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function leer(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}
