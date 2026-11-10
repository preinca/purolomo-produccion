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
      descripcion="El administrador usa toda la aplicación. Recepcionista registra entradas. Pesador registra la salida para consumo. Consulta solo visualiza."
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
  const usuarios = await listarUsuarios(getDb());
  const administradores = usuarios.filter((usuario) => usuario.rango === "administrador");
  const recepcionistas = usuarios.filter((usuario) => usuario.rango === "recepcionista");
  const pesadores = usuarios.filter((usuario) => usuario.rango === "pesador");
  const consulta = usuarios.filter((usuario) => usuario.rango === "consulta");

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
      <div className="grid gap-8 lg:grid-cols-2">
        <Grupo titulo="Usuarios de administrador" usuarios={administradores} vacio="Todavía no hay administradores." />
        <Grupo titulo="Usuarios de recepcionista" usuarios={recepcionistas} vacio="Todavía no hay recepcionistas." />
        <Grupo titulo="Usuarios de pesador" usuarios={pesadores} vacio="Todavía no hay pesadores." />
        <Grupo titulo="Usuarios de consulta" usuarios={consulta} vacio="Todavía no hay usuarios de consulta." />
      </div>
    </div>
  );
}

function Grupo({
  titulo,
  usuarios,
  vacio,
}: {
  titulo: string;
  usuarios: { id: number; nombre: string; usuario: string; activo: boolean }[];
  vacio: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {usuarios.length === 0 ? (
          <p className="text-sm text-muted-foreground">{vacio}</p>
        ) : (
          usuarios.map((usuario) => (
            <article key={usuario.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="font-medium">{usuario.nombre}</p>
                <p className="text-sm text-muted-foreground">
                  {usuario.usuario}
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
          ))
        )}
      </CardContent>
    </Card>
  );
}
