import { connection } from "next/server";
import { Suspense } from "react";
import { enlacePdf, EtiquetaCava } from "@/components/etiqueta-cava";
import { EntradaForm } from "@/components/entrada-form";
import { PageFrame } from "@/components/page-frame";
import { TablaLotes } from "@/components/tabla-lotes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { fechaHoy, semanaDe } from "@/lib/formato";
import { buscarLote, listarLotes, siguienteTag } from "@/lib/lotes";
import { PRODUCTOS_MPC } from "@/lib/mpc";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PageFrame
      titulo="Registrar entradas"
      descripcion="Cada materia prima que llega al almacén recibe un TAG, un código QR y una etiqueta de cava con la fecha y hora de recepción, el producto y el código del catálogo."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando formulario…</p>}>
        <Entradas searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}

async function Entradas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const parametros = await searchParams;
  const pedido = (Array.isArray(parametros.etiqueta) ? parametros.etiqueta[0] : parametros.etiqueta ?? "").trim();
  const db = getDb();
  const etiqueta = /^\d{4,8}$/.test(pedido) ? await buscarLote(db, pedido) : null;
  const recientes = await listarLotes(db, { limite: 12 });

  return (
    <div className="grid gap-8">
      {etiqueta ? (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Etiqueta generada</CardTitle>
              <CardDescription>
                El QR y la etiqueta del TAG {etiqueta.tag} ya quedaron en Etiquetas en Cava.
              </CardDescription>
            </div>
            <a
              href={enlacePdf(etiqueta.tag)}
              download={`etiqueta-${etiqueta.tag}.pdf`}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              Descargar PDF
            </a>
          </CardHeader>
          <CardContent>
            <EtiquetaCava lote={etiqueta} />
          </CardContent>
        </Card>
      ) : null}
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
            tagSugerido={await siguienteTag(db)}
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
