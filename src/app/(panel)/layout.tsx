import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { getDb } from "@/lib/db";
import { leerSesion, sesionSigueActiva } from "@/lib/usuarios";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" />}>
      <Marco>{children}</Marco>
    </Suspense>
  );
}

async function Marco({ children }: { children: React.ReactNode }) {
  await connection();
  const db = getDb();
  const sesion = await leerSesion();
  if (!sesion || !await sesionSigueActiva(db, sesion)) redirect("/entrar");
  return (
    <Shell nombre={sesion.nombre} rango={sesion.rango}>
      {children}
    </Shell>
  );
}
