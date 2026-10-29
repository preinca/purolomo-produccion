import { connection } from "next/server";
import { Suspense } from "react";
import { PageFrame } from "@/components/page-frame";
import { TablaLotes } from "@/components/tabla-lotes";
import { Card, CardContent } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { listarLotes } from "@/lib/lotes";

export default function Page() {
  return (
    <PageFrame
      titulo="Historial de entradas"
      descripcion="Recepciones guardadas en SQLite, de la más reciente a la más antigua."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando historial…</p>}>
        <Historial />
      </Suspense>
    </PageFrame>
  );
}

async function Historial() {
  await connection();
  const lotes = listarLotes(getDb(), { limite: 300 });
  return (
    <Card>
      <CardContent className="pt-4">
        <TablaLotes lotes={lotes} vacio="Todavía no hay entradas." />
      </CardContent>
    </Card>
  );
}
