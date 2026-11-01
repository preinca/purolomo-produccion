import { connection } from "next/server";
import { Suspense } from "react";
import { PageFrame } from "@/components/page-frame";
import { StockEnVivo } from "@/components/stock-en-vivo";
import { getDb } from "@/lib/db";
import { listarLotes } from "@/lib/lotes";

export default function Page() {
  return (
    <PageFrame
      titulo="Consultar stock"
      descripcion="Escribe el TAG, el producto o el código. La lista se va filtrando mientras escribes."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando stock…</p>}>
        <Stock />
      </Suspense>
    </PageFrame>
  );
}

async function Stock() {
  await connection();
  const lotes = listarLotes(getDb(), { limite: 300 });
  return <StockEnVivo lotes={lotes} />;
}
