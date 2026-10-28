"use client";

import { useActionState, useState } from "react";
import { crearRecepcion, type EstadoFormulario } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProductoMpc } from "@/lib/mpc";
import { cn } from "@/lib/utils";

const PRINCIPALES = new Set(["Z", "C", "BF", "CH", "DD", "GP", "GL"]);

export function EntradaForm({
  hoy,
  tagSugerido,
  productos,
}: {
  hoy: string;
  tagSugerido: string;
  productos: ProductoMpc[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    crearRecepcion,
    null,
  );

  return (
    <div className="grid gap-4">
      <Campos
        key={estado?.ok ? estado.tag : "form"}
        hoy={hoy}
        tagSugerido={tagSugerido}
        productos={productos}
        accion={accion}
        pendiente={pendiente}
      />
      {estado?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}
      {estado?.ok ? (
        <p role="status" className="text-sm">
          Lote {estado.tag} guardado en SQLite. El QR ya está listo en Generar QR.
        </p>
      ) : null}
    </div>
  );
}

function Campos({
  hoy,
  tagSugerido,
  productos,
  accion,
  pendiente,
}: {
  hoy: string;
  tagSugerido: string;
  productos: ProductoMpc[];
  accion: (payload: FormData) => void;
  pendiente: boolean;
}) {
  const [codigo, setCodigo] = useState("");
  const frecuentes = productos.filter((p) => PRINCIPALES.has(p.tipo));
  const otros = productos.filter((p) => !PRINCIPALES.has(p.tipo));
  const elegido = productos.find((p) => p.codigo === codigo) ?? null;

  return (
    <form action={accion} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Fecha" htmlFor="fecha">
          <Input id="fecha" name="fecha" type="date" required defaultValue={hoy} />
        </Campo>
        <Campo label="TAG" htmlFor="tag">
          <Input
            id="tag"
            name="tag"
            required
            inputMode="numeric"
            defaultValue={tagSugerido}
            placeholder="Número de paleta"
          />
        </Campo>
      </div>

      <fieldset className="grid gap-1.5">
        <legend className="text-sm font-medium">Tipo de materia prima</legend>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {frecuentes.map((producto) => {
            const activo = codigo === producto.codigo;
            return (
              <label
                key={producto.codigo}
                className={cn(
                  "cursor-pointer rounded-lg border px-2 py-2 text-left text-xs leading-tight",
                  activo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  name="codigo"
                  value={producto.codigo}
                  checked={codigo === producto.codigo}
                  onChange={() => setCodigo(producto.codigo)}
                  className="sr-only"
                  required
                />
                <span className="block font-semibold">{producto.tipo}</span>
                <span className={cn("block", activo ? "opacity-90" : "text-muted-foreground")}>
                  {producto.descripcion}
                </span>
              </label>
            );
          })}
        </div>
        <select
          aria-label="Otros productos"
          value={codigo && !PRINCIPALES.has(elegido?.tipo ?? "") ? codigo : ""}
          onChange={(event) => setCodigo(event.target.value)}
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Otros productos…</option>
          {otros.map((producto) => (
            <option key={producto.codigo} value={producto.codigo}>
              {producto.tipo} · {producto.nombre} · {producto.codigo}
            </option>
          ))}
        </select>
        {codigo && !PRINCIPALES.has(elegido?.tipo ?? "") ? (
          <input type="hidden" name="codigo" value={codigo} />
        ) : null}
        {elegido ? (
          <p className="text-xs text-muted-foreground">
            {elegido.nombre} · {elegido.codigo}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Elige un tipo. El código MPC se completa solo.</p>
        )}
      </fieldset>

      <Campo label="Kg recibidos" htmlFor="kg_recibidos">
        <Input
          id="kg_recibidos"
          name="kg_recibidos"
          type="number"
          inputMode="decimal"
          required
          min="0.001"
          step="0.001"
          placeholder="0"
        />
      </Campo>
      <Campo label="Observaciones" htmlFor="observaciones">
        <Textarea
          id="observaciones"
          name="observaciones"
          maxLength={500}
          placeholder="Remisión, proveedor o novedad de la recepción"
        />
      </Campo>
      <Button type="submit" size="lg" disabled={pendiente} className="w-full sm:w-auto">
        {pendiente ? "Guardando…" : "Registrar entrada y generar QR"}
      </Button>
    </form>
  );
}

function Campo({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
