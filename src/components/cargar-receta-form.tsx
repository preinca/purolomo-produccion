"use client";

import { useActionState, useState } from "react";
import { cargarRecetaAlibal, type EstadoFormulario } from "@/app/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LINEAS } from "@/lib/lineas";

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-white px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function CargarRecetaForm() {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(cargarRecetaAlibal, null);
  const [linea, setLinea] = useState("1");

  return (
    <form action={accion} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="linea">Línea</Label>
        <select
          id="linea"
          name="linea"
          required
          value={linea}
          onChange={(evento) => setLinea(evento.target.value)}
          className={selectClass}
        >
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
        Descarga el Excel, cambia la tolerancia en las celdas amarillas y vuelve a subirlo. El rango se calcula solo.
      </p>
      {estado?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pendiente} className="w-fit">
          {pendiente ? "Cargando…" : "Cargar receta"}
        </Button>
        <a href={`/receta/excel/${linea}`} className={buttonVariants({ variant: "outline", className: "w-fit" })}>
          Descargar Excel
        </a>
      </div>
    </form>
  );
}
