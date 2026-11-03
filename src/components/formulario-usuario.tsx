"use client";

import { useActionState } from "react";
import { crearUsuarioFormulario, type EstadoAcceso } from "@/app/usuarios-acciones";
import { Button } from "@/components/ui/button";

export function FormularioUsuario() {
  const [estado, enviar, pendiente] = useActionState<EstadoAcceso, FormData>(crearUsuarioFormulario, null);

  return (
    <form action={enviar} className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1.5 text-sm font-medium">
        Nombre
        <input name="nombre" required className="h-8 rounded-lg border border-input bg-card px-2.5 text-sm font-normal" />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Usuario
        <input name="usuario" required className="h-8 rounded-lg border border-input bg-card px-2.5 text-sm font-normal" />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Clave
        <input
          name="clave"
          type="password"
          required
          className="h-8 rounded-lg border border-input bg-card px-2.5 text-sm font-normal"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Rango
        <select name="rango" defaultValue="consulta" className="h-11 rounded-lg border border-input bg-white px-3 text-base font-normal">
          <option value="consulta">Consulta</option>
          <option value="administrador">Administrador</option>
        </select>
      </label>
      {estado?.error ? <p className="text-sm text-destructive sm:col-span-2">{estado.error}</p> : null}
      {estado && !estado.error ? (
        <p className="text-sm text-emerald-700 sm:col-span-2">Usuario creado.</p>
      ) : null}
      <Button type="submit" disabled={pendiente} className="w-fit">
        {pendiente ? "Guardando…" : "Crear usuario"}
      </Button>
    </form>
  );
}
