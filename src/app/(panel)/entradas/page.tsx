import { connection } from "next/server";
import { Suspense } from "react";
import { EntradaForm } from "@/components/entrada-form";
import { PageFrame } from "@/components/page-frame";
import { TablaLotes } from "@/components/tabla-lotes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { fechaHoy, semanaDe } from "@/lib/formato";
import { listarLotes, siguienteTag } from "@/lib/lotes";
import { PRODUCTOS_MPC } from "@/lib/mpc";

export default function Page() {
  return (
    <PageFrame
      titulo="Registrar entradas"
      descripcion="Cada materia prima que llega al almacén recibe un TAG y un código QR con fecha, semana, tipo, kilos y estado."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando formulario…</p>}>
        <Entradas />
      </Suspense>
    </PageFrame>
  );
}

async function Entradas() {
  await connection();
  const db = getDb();
  const recientes = listarLotes(db, { limite: 12 });

  return (
    <div className="grid gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Nueva recepción</CardTitle>
          <CardDescription>
            El TAG se sugiere solo. Puedes cambiarlo si la paleta ya trae número.
            La semana se puede escribir; hoy corresponde a la {semanaDe(fechaHoy()).toLowerCase()}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EntradaForm
            hoy={fechaHoy()}
            semanaSugerida={semanaDe(fechaHoy()).replace(/\D/g, "") || "45"}
            tagSugerido={siguienteTag(db)}
            productos={PRODUCTOS_MPC}
          />
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Últimas paletas</CardTitle>
          <CardDescription>
            Las recepciones más recientes, con su TAG, producto, kilos y estado.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          <TablaLotes lotes={recientes} vacio="Todavía no hay recepciones." />
        </CardContent>
      </Card>
    </div>
  );
}
