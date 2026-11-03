import { connection } from "next/server";
import { Suspense } from "react";
import { alternarUsuario } from "@/app/usuarios-acciones";
import { FormularioUsuario } from "@/components/formulario-usuario";
import { PageFrame } from "@/components/page-frame";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { exigirAdmin, listarUsuarios } from "@/lib/usuarios";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PageFrame
      titulo="Usuarios"
      descripcion="El administrador usa toda la aplicación. Consulta solo ve las búsquedas, los historiales y puede hacer pesajes."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando usuarios…</p>}>
        <Lista searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}

function texto(valor: string | string[] | undefined) {
  return (Array.isArray(valor) ? valor[0] ?? "" : valor ?? "").trim();
}

async function Lista({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  await exigirAdmin();
  const error = texto((await searchParams).error);
  const usuarios = listarUsuarios(getDb());

  return (
    <div className="grid gap-8">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Card>
        <CardHeader>
          <CardTitle>Nuevo usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <FormularioUsuario />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Cuentas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {usuarios.map((usuario) => (
            <article key={usuario.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="font-medium">{usuario.nombre}</p>
                <p className="text-sm text-muted-foreground">
                  {usuario.usuario} · {usuario.rango === "administrador" ? "Administrador" : "Consulta"}
                  {usuario.activo ? "" : " · inactivo"}
                </p>
              </div>
              <form action={alternarUsuario}>
                <input type="hidden" name="id" value={usuario.id} />
                <button type="submit" className="text-sm font-medium underline">
                  {usuario.activo ? "Desactivar" : "Activar"}
                </button>
              </form>
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
