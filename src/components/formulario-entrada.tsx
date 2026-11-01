"use client";

import { useActionState } from "react";
import { crearPrimerAdministrador, entrar, type EstadoAcceso } from "@/app/usuarios-acciones";
import { Button } from "@/components/ui/button";

export function FormularioEntrada({
  modo,
  siguiente,
}: {
  modo: "entrar" | "crear";
  siguiente: string;
}) {
  const accion = modo === "entrar" ? entrar : crearPrimerAdministrador;
  const [estado, enviar, pendiente] = useActionState<EstadoAcceso, FormData>(accion, null);

  return (
    <form action={enviar} className="grid gap-3">
      <input type="hidden" name="siguiente" value={siguiente} />
      {modo === "crear" ? (
        <label className="grid gap-1.5 text-sm font-medium">
          Nombre
          <input
            name="nombre"
            required
            autoComplete="name"
            className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm font-normal"
          />
        </label>
      ) : null}
      <label className="grid gap-1.5 text-sm font-medium">
        Usuario
        <input
          name="usuario"
          required
          autoComplete="username"
          className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm font-normal"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Clave
        <input
          name="clave"
          type="password"
          required
          autoComplete={modo === "crear" ? "new-password" : "current-password"}
          className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm font-normal"
        />
      </label>
      {modo === "crear" ? (
        <label className="grid gap-1.5 text-sm font-medium">
          Repetir clave
          <input
            name="repetir"
            type="password"
            required
            autoComplete="new-password"
            className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm font-normal"
          />
        </label>
      ) : null}
      {estado?.error ? <p className="text-sm text-destructive">{estado.error}</p> : null}
      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Entrando…" : modo === "crear" ? "Crear administrador" : "Entrar"}
      </Button>
    </form>
  );
}
