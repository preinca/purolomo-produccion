import { connection } from "next/server";
import { Suspense } from "react";
import { BotonImprimir } from "@/components/boton-imprimir";
import { LectorQr } from "@/components/lector-qr";
import { PageFrame } from "@/components/page-frame";
import { QrEnVivo } from "@/components/qr-en-vivo";
import { getDb } from "@/lib/db";
import { listarLotes } from "@/lib/lotes";
import { retirosDeTag } from "@/lib/pesajes";

export default function Page() {
  return (
    <PageFrame
      titulo="Generar QR / Etiquetas"
      descripcion="Cada etiqueta lleva el TAG, los kilos recibidos, los consumidos y los disponibles. Si se acaba la materia prima, el QR se conserva."
      acciones={<BotonImprimir />}
    >
      <LectorQr />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Armando etiquetas…</p>}>
        <Etiquetas />
      </Suspense>
    </PageFrame>
  );
}

async function Etiquetas() {
  await connection();
  const db = getDb();
  const etiquetas = listarLotes(db, { limite: 300 }).map((lote) => ({
    lote,
    retiros: retirosDeTag(db, lote.tag),
  }));
  return <QrEnVivo etiquetas={etiquetas} />;
}
