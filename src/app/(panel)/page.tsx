import { connection } from "next/server";
import { Suspense } from "react";
import { PageFrame } from "@/components/page-frame";
import { TablaLotes } from "@/components/tabla-lotes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { formatoNumero } from "@/lib/formato";
import { listarLotes, resumir } from "@/lib/lotes";

export default function Page() {
  return (
    <PageFrame
      titulo="Panel de administración"
      descripcion="Recepción de materia prima cárnica en el almacén de producción. Cada paleta tiene TAG, kilos y un QR generado por la aplicación."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando panel…</p>}>
        <Dashboard />
      </Suspense>
    </PageFrame>
  );
}

async function Dashboard() {
  await connection();
  const db = getDb();
  const resumen = resumir(db);
  const lotes = listarLotes(db, { limite: 12 });

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen">
        <Kpi
          titulo="Total paletas"
          valor={formatoNumero(resumen.paletas)}
          detalle="Lotes activos en SQLite"
          color="border-purolomo-red"
        />
        <Kpi
          titulo="Kg recibidos"
          valor={formatoNumero(resumen.kgRecibidos, 0)}
          detalle="Acumulado de recepción"
          color="border-rose-500"
        />
        <Kpi
          titulo="Kg consumidos"
          valor={formatoNumero(resumen.kgDespachados + resumen.kgConsumidos, 0)}
          detalle="Salidas registradas"
          color="border-amber-400"
        />
        <Kpi
          titulo="Kg en inventario"
          valor={formatoNumero(resumen.kgInventario, 0)}
          detalle="Recibido menos despacho y consumo"
          color="border-yellow-400"
        />
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Últimas paletas</CardTitle>
        </CardHeader>
        <CardContent>
          <TablaLotes lotes={lotes} mostrarEstado={false} vacio="Todavía no hay paletas." />
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  titulo,
  valor,
  detalle,
  color,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  color: string;
}) {
  return (
    <Card size="sm" className={`border-l-4 ${color}`}>
      <CardContent>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{titulo}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
        <p className="text-xs text-muted-foreground">{detalle}</p>
      </CardContent>
    </Card>
  );
}
