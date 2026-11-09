"use client";

import { useActionState } from "react";
import { cargarRecetaAlibal, type EstadoFormulario } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LINEAS } from "@/lib/lineas";

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-white px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function CargarRecetaForm() {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(cargarRecetaAlibal, null);

  return (
    <form action={accion} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="linea">Línea</Label>
        <select id="linea" name="linea" required defaultValue="1" className={selectClass}>
          {LINEAS.map((linea) => (
            <option key={linea.id} value={linea.id}>
              {linea.nombre}
              {linea.id === "2" ? " · kilos al doble" : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="archivo">Archivo Excel</Label>
        <Input id="archivo" name="archivo" type="file" accept=".xlsx,.xls" required />
      </div>
      <p className="text-sm text-muted-foreground">
        Las celdas amarillas se guardan al subir el archivo: tolerancia, mínimo y máximo del pesaje de Alibal y de cada materia prima.
      </p>
      {estado?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pendiente} className="w-fit">
        {pendiente ? "Cargando…" : "Cargar receta"}
      </Button>
    </form>
  );
}
