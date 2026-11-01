"use client";

import { useActionState, useMemo, useState } from "react";
import { abrirPesajeFormulario, consumirPesajeFormulario, type EstadoFormulario, type LoteLeido } from "@/app/actions";
import { EscanerSalida } from "@/components/escaner-salida";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatoKg } from "@/lib/formato";
import { LINEAS } from "@/lib/lineas";

const PRODUCTO = "ALIBAL 1 K";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export type TrazaPesaje = { tipo: string; tag: string; token: string; kg: number };

export type PesajeVista = {
  id: number;
  numero: number;
  fecha: string;
  destino: string;
  linea: string;
  objetivo: number;
  tolerancia: number;
  total: number;
  lineas: { tipo: string; objetivo: number; usado: number }[];
  codigo: string;
  trazas: TrazaPesaje[];
};

export function SalidaAlibal({
  hoy,
  lineasConReceta,
  pesajes,
  existencias,
  pesaje,
}: {
  hoy: string;
  lineasConReceta: string[];
  pesajes: { id: number; numero: number; fecha: string; linea: string; codigo: string; trazas: TrazaPesaje[] }[];
  existencias: { tag: string; tipo: string; kg: number }[];
  pesaje: PesajeVista | null;
}) {
  return (
    <div className="grid gap-6">
      {lineasConReceta.length === 0 ? (
        <p className="text-sm">
          Carga la receta de {PRODUCTO} en{" "}
          <a href="/receta" className="font-medium underline">
            Cargar receta
          </a>{" "}
          antes de retirar.
        </p>
      ) : (
        <AbrirPesaje hoy={hoy} pesajes={pesajes} lineasConReceta={lineasConReceta} />
      )}
      {pesaje ? <Consumir pesaje={pesaje} existencias={existencias} /> : null}
    </div>
  );
}

function AbrirPesaje({
  hoy,
  pesajes,
  lineasConReceta,
}: {
  hoy: string;
  pesajes: { id: number; numero: number; fecha: string; linea: string; codigo: string; trazas: TrazaPesaje[] }[];
  lineasConReceta: string[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(abrirPesajeFormulario, null);
  return (
    <form action={accion} className="grid gap-3">
      <input type="hidden" name="destino" value={PRODUCTO} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="fecha">Fecha</Label>
          <Input id="fecha" name="fecha" type="date" required defaultValue={hoy} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="numero">Nº de pesaje</Label>
          <Input id="numero" name="numero" type="number" required min={1} max={99} placeholder="1" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="linea-pesaje">Línea</Label>
          <select
            id="linea-pesaje"
            name="linea"
            required
            defaultValue={lineasConReceta[0] ?? "1"}
            className={selectClass}
          >
            {LINEAS.filter((linea) => lineasConReceta.includes(linea.id)).map((linea) => (
              <option key={linea.id} value={linea.id}>
                {linea.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button type="submit" disabled={pendiente} className="w-fit">
        {pendiente ? "Abriendo…" : "Abrir pesaje"}
      </Button>
      {estado?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}
      {pesajes.length > 0 ? (
        <div className="grid gap-2">
          {pesajes.map((item) => (
            <a
              key={item.id}
              href={`/salidas?pesaje=${item.id}`}
              className="grid gap-2 rounded-lg border p-3 text-sm hover:bg-muted"
            >
              <span className="font-medium">
                Pesaje {item.numero}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · línea {item.linea} · {item.fecha}
                </span>
              </span>
              {item.codigo ? <span className="font-mono text-xs break-all">{item.codigo}</span> : null}
              {item.trazas.length > 0 ? (
                <span className="grid gap-2">
                  {item.trazas.map((traza) => (
                    <span key={traza.token} className="grid gap-0.5 rounded-md bg-background px-2.5 py-2 text-xs">
                      <span className="font-medium">
                        {traza.tipo} · {formatoKg(traza.kg)}
                      </span>
                      <span>TAG {traza.tag}</span>
                      <span className="font-mono">Mini lote {traza.token}</span>
                    </span>
                  ))}
                </span>
              ) : null}
            </a>
          ))}
        </div>
      ) : null}
    </form>
  );
}

function Consumir({
  pesaje,
  existencias,
}: {
  pesaje: PesajeVista;
  existencias: { tag: string; tipo: string; kg: number }[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(consumirPesajeFormulario, null);
  const [tag, setTag] = useState("");
  const [kg, setKg] = useState("");
  const [lectura, setLectura] = useState<LoteLeido | null>(null);
  const partida = pesaje.lineas.find((linea) => linea.tipo === lectura?.tipoCodigo) ?? null;
  const maximo = useMemo(() => {
    if (!lectura || !partida) return 0;
    const faltaTipo = Math.max(0, partida.objetivo + pesaje.tolerancia - partida.usado);
    const faltaTotal = Math.max(0, pesaje.objetivo + pesaje.tolerancia - pesaje.total);
    return Math.round(Math.min(lectura.kgRestantes, faltaTipo, faltaTotal) * 1000) / 1000;
  }, [lectura, partida, pesaje]);
  const faltaDelTipo = partida ? Math.max(0, partida.objetivo - partida.usado) : 0;
  const fueraDeReceta = Boolean(lectura && !partida);
  const noAlcanza = Boolean(lectura && partida && lectura.kgRestantes + 0.001 < faltaDelTipo);
  const otros = existencias.filter((item) => item.tipo === lectura?.tipoCodigo && item.tag !== lectura?.tag && item.kg > 0.001);

  function elegir(leido: LoteLeido) {
    setLectura(leido);
    setTag(leido.tag);
    const linea = pesaje.lineas.find((item) => item.tipo === leido.tipoCodigo);
    if (!linea) {
      setKg("");
      return;
    }
    const faltaObjetivo = Math.max(0, linea.objetivo - linea.usado);
    const faltaTipo = Math.max(0, linea.objetivo + pesaje.tolerancia - linea.usado);
    const faltaTotal = Math.max(0, pesaje.objetivo + pesaje.tolerancia - pesaje.total);
    const tope = Math.min(leido.kgRestantes, faltaTipo, faltaTotal);
    const sugerido = Math.min(tope, faltaObjetivo > 0 ? faltaObjetivo : tope);
    setKg(sugerido > 0 ? String(Math.round(sugerido * 1000) / 1000) : "");
  }

  return (
    <form
      action={accion}
      className="grid gap-4"
      onSubmit={(event) => {
        if (fueraDeReceta) event.preventDefault();
      }}
    >
      <input type="hidden" name="pesaje_id" value={pesaje.id} />
      <p className="text-sm">
        Pesaje {pesaje.numero} · {pesaje.destino} · línea {pesaje.linea}. Lleva {formatoKg(pesaje.total)} de{" "}
        {formatoKg(pesaje.objetivo)} (puede variar {formatoKg(pesaje.tolerancia)}).
      </p>
      {pesaje.codigo ? (
        <p className="rounded-lg bg-muted px-3 py-2 font-mono text-sm break-all">{pesaje.codigo}</p>
      ) : null}
      {pesaje.trazas.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium">Trazabilidad del pesaje {pesaje.numero}</p>
          <div className="grid gap-2">
            {pesaje.trazas.map((traza) => (
              <div key={traza.token} className="grid gap-1 rounded-lg bg-muted px-3 py-2 text-sm">
                <p className="font-semibold">
                  {traza.tipo} · {formatoKg(traza.kg)}
                </p>
                <p>
                  <span className="text-muted-foreground">TAG </span>
                  <span className="font-mono">{traza.tag}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Mini lote </span>
                  <span className="font-mono">{traza.token}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <ul className="grid gap-1 text-sm">
        {pesaje.lineas.map((linea) => (
          <li key={linea.tipo}>
            {linea.tipo}: {formatoKg(linea.usado)} de {formatoKg(linea.objetivo)}
            {linea.usado + 0.001 < linea.objetivo ? ` · faltan ${formatoKg(linea.objetivo - linea.usado)}` : ""}
          </li>
        ))}
      </ul>
      {pesaje.lineas.some((linea) => linea.usado + 0.001 < linea.objetivo) ? (
        <div className="grid gap-2 text-sm">
          {pesaje.lineas
            .filter((linea) => linea.usado + 0.001 < linea.objetivo)
            .map((linea) => {
              const candidatos = existencias.filter(
                (item) => item.tipo === linea.tipo && item.kg > 0.001 && !(noAlcanza && item.tag === lectura?.tag),
              );
              if (candidatos.length === 0) return null;
              return (
                <div key={linea.tipo} className="grid gap-2">
                  <p>
                    Completar {linea.tipo}: faltan {formatoKg(linea.objetivo - linea.usado)}. Elige otro TAG del mismo
                    tipo.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {candidatos.map((item) => (
                      <button
                        key={item.tag}
                        type="button"
                        className="rounded-lg border px-2.5 py-1 hover:bg-muted"
                        onClick={() =>
                          elegir({
                            tag: item.tag,
                            fecha: "",
                            semana: "",
                            producto: item.tipo,
                            tipo: item.tipo,
                            codigo: "",
                            kgRecibidos: item.kg,
                            kgDespachados: 0,
                            kgConsumidos: 0,
                            kgRestantes: item.kg,
                            estado: "",
                            destino: "",
                            tipoCodigo: item.tipo,
                            minilotes: [],
                          })
                        }
                      >
                        TAG {item.tag} · {formatoKg(item.kg)} en cava
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      ) : null}
      <EscanerSalida onLeido={elegir} />
      {lectura && partida ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          TAG {lectura.tag} · {lectura.tipo}. Restan {formatoKg(lectura.kgRestantes)} en cava.
          {lectura.minilotes.length > 0
            ? ` Mini lotes: ${lectura.minilotes.map((mini) => `${mini.token} ${formatoKg(mini.kg)} ${mini.tipo} para ${mini.destino}`).join(", ")}.`
            : ""}
          {` Para este pesaje de ${partida.tipo} puedes retirar hasta ${formatoKg(maximo)}.`}
        </p>
      ) : null}
      {fueraDeReceta && lectura ? (
        <p role="alert" className="rounded-lg border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          El {lectura.tipoCodigo || lectura.tipo || "tipo leído"} no está en la receta de este pesaje. Solo se puede usar{" "}
          {pesaje.lineas.map((linea) => linea.tipo).join(", ")}. No se pueden cargar estos kilos.
        </p>
      ) : null}
      {noAlcanza && partida && lectura ? (
        <div className="grid gap-2 rounded-lg border border-primary px-3 py-2 text-sm">
          <p>
            Este TAG no alcanza para los {formatoKg(partida.objetivo)} de {partida.tipo}. En cava quedan{" "}
            {formatoKg(lectura.kgRestantes)} y todavía faltan {formatoKg(faltaDelTipo)}. Registra lo que hay y completa
            el pesaje con otro TAG de {partida.tipo}.
          </p>
          {otros.length > 0 ? (
            <p>Después de registrar este retiro podrás completar con {otros.map((item) => `TAG ${item.tag}`).join(", ")}.</p>
          ) : (
            <p>No hay otro TAG de {partida.tipo} con kilos en cava.</p>
          )}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="tag">TAG</Label>
          <Input
            id="tag"
            name="tag"
            required
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            placeholder="Escanea el QR del TAG"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="kg">Kg consumidos</Label>
          <Input
            id="kg"
            name="kg"
            type="number"
            inputMode="decimal"
            required
            min="0.001"
            step="0.001"
            max={maximo > 0 ? maximo : undefined}
            value={kg}
            onChange={(event) => setKg(event.target.value)}
            disabled={fueraDeReceta}
            placeholder="0"
          />
        </div>
      </div>
      {estado?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pendiente || fueraDeReceta} className="w-fit">
        {pendiente ? "Guardando…" : "Registrar consumo"}
      </Button>
    </form>
  );
}
