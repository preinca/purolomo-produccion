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
        Dos columnas: Tipo y Kg. En la línea 1 el objetivo es 740 kg y la suma puede variar 15 kg, entre 725 y
        755 kg. Por ejemplo GL 340, CH 240 y CHEXT 150. En la línea 2 los kilos van al doble: el objetivo es 1480
        kg y la suma queda entre 1450 y 1510 kg, por ejemplo GL 680, CH 480 y CHEXT 300.
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
