"use client";

import { useActionState, useEffect, useRef } from "react";
import { crearRegistro, type EstadoRegistro } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TURNOS } from "@/lib/turnos";

const campo =
  "grid gap-1.5";
const selector =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function RegistroForm({ hoy }: { hoy: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoRegistro, FormData>(
    crearRegistro,
    null,
  );
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok) formulario.current?.reset();
  }, [estado]);

  return (
    <form ref={formulario} action={accion} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={campo}>
          <Label htmlFor="fecha">Fecha</Label>
          <Input id="fecha" name="fecha" type="date" required defaultValue={hoy} />
        </div>
        <div className={campo}>
          <Label htmlFor="turno">Turno</Label>
          <select id="turno" name="turno" required defaultValue="manana" className={selector}>
            {TURNOS.map((turno) => (
              <option key={turno.value} value={turno.value}>
                {turno.label}
              </option>
            ))}
          </select>
        </div>
        <div className={campo}>
          <Label htmlFor="linea">Línea</Label>
          <Input
            id="linea"
            name="linea"
            required
            minLength={2}
            maxLength={80}
            placeholder="Ej. Embutidos"
            autoComplete="off"
          />
        </div>
        <div className={campo}>
          <Label htmlFor="producto">Producto</Label>
          <Input
            id="producto"
            name="producto"
            required
            minLength={2}
            maxLength={120}
            placeholder="Ej. Salchicha"
            list="productos-conocidos"
            autoComplete="off"
          />
          <datalist id="productos-conocidos">
            <option value="Salchicha" />
            <option value="Jamón" />
            <option value="Mortadela" />
            <option value="Chorizo" />
            <option value="Butifarra" />
            <option value="Salchichón" />
          </datalist>
        </div>
      </div>
      <div className={campo}>
        <Label htmlFor="cantidad_kg">Cantidad (kg)</Label>
        <Input
          id="cantidad_kg"
          name="cantidad_kg"
          type="number"
          inputMode="decimal"
          required
          min="0.001"
          step="0.001"
          placeholder="0"
        />
      </div>
      <div className={campo}>
        <Label htmlFor="observaciones">Observaciones</Label>
        <Textarea
          id="observaciones"
          name="observaciones"
          maxLength={500}
          placeholder="Lote, parada o novedad del turno"
        />
      </div>
      {estado?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}
      {estado?.ok ? (
        <p role="status" className="text-sm text-foreground">
          Registro guardado en SQLite.
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pendiente} className="w-full sm:w-auto">
        {pendiente ? "Guardando…" : "Guardar registro"}
      </Button>
    </form>
  );
}
