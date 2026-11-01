import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CargarRecetaForm } from "@/components/cargar-receta-form";
import { PageFrame } from "@/components/page-frame";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { formatoKg } from "@/lib/formato";
import { recetasCargadas } from "@/lib/recetas";

export default function Page() {
  return (
    <PageFrame
      titulo="Cargar receta"
      descripcion="Al empezar la jornada se carga la receta de Alibal 1 kg. Después, en Registrar salidas, solo se puede retirar lo que esa receta permite."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <Receta />
      </Suspense>
    </PageFrame>
  );
}

async function Receta() {
  await connection();
  const recetas = recetasCargadas(getDb());

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
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
                <ul className="grid gap-1">
                  {receta.items.map((item) => (
                    <li key={item.tipo}>
                      {item.tipo}: {formatoKg(item.kg)}
                    </li>
                  ))}
                </ul>
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
