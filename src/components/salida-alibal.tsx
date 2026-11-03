"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { abrirPesajeFormulario, consumirPesajeFormulario, loteActualDesdeTag, numeroSiguientePesaje, type EstadoFormulario, type LoteLeido } from "@/app/actions";
import { EscanerSalida } from "@/components/escaner-salida";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatoKg } from "@/lib/formato";
import { LINEAS } from "@/lib/lineas";

const PRODUCTO = "ALIBAL 1 K";

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-white px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

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
  enCurso,
  numeroSiguiente,
}: {
  hoy: string;
  lineasConReceta: string[];
  pesajes: { id: number; numero: number; fecha: string; linea: string; codigo: string; trazas: TrazaPesaje[] }[];
  existencias: { tag: string; tipo: string; kg: number }[];
  pesaje: PesajeVista | null;
  enCurso: { id: number; numero: number; linea: string; fecha: string } | null;
  numeroSiguiente: number;
}) {
  return (
    <div className="grid gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Abrir pesaje</CardTitle>
          <CardDescription>
            La fecha y la línea definen el pesaje. El número sigue solo y no se abre otro hasta terminar el actual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lineasConReceta.length === 0 ? (
            <p className="text-base leading-relaxed">
              Carga la receta de {PRODUCTO} en{" "}
              <a href="/receta" className="font-medium underline">
                Cargar receta
              </a>{" "}
              antes de retirar.
            </p>
          ) : (
            <AbrirPesaje
              hoy={hoy}
              pesajes={pesajes}
              lineasConReceta={lineasConReceta}
              activoId={pesaje?.id}
              enCurso={enCurso}
              numeroSiguiente={numeroSiguiente}
            />
          )}
        </CardContent>
      </Card>
      {pesaje ? (
        <Card>
          <CardHeader>
            <CardTitle>Registrar consumo</CardTitle>
            <CardDescription>
              Pesaje {pesaje.numero} · línea {pesaje.linea}. Escanea el QR o escribe el número de TAG y confirma los kilos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Consumir pesaje={pesaje} existencias={existencias} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function AbrirPesaje({
  hoy,
  pesajes,
  lineasConReceta,
  activoId,
  enCurso,
  numeroSiguiente,
}: {
  hoy: string;
  pesajes: { id: number; numero: number; fecha: string; linea: string; codigo: string; trazas: TrazaPesaje[] }[];
  lineasConReceta: string[];
  activoId?: number;
  enCurso: { id: number; numero: number; linea: string; fecha: string } | null;
  numeroSiguiente: number;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(abrirPesajeFormulario, null);
  const fechaBase = enCurso?.fecha ?? hoy;
  const [fecha, setFecha] = useState(fechaBase);
  const [numeroElegido, setNumeroElegido] = useState<number | null>(null);
  const numero = enCurso ? enCurso.numero : fecha === fechaBase ? numeroSiguiente : (numeroElegido ?? numeroSiguiente);

  useEffect(() => {
    if (enCurso || fecha === fechaBase) {
      setNumeroElegido(null);
      return;
    }
    let activo = true;
    void numeroSiguientePesaje(fecha).then((valor) => {
      if (activo) setNumeroElegido(valor);
    });
    return () => {
      activo = false;
    };
  }, [fecha, fechaBase, enCurso]);
  return (
    <form action={accion} className="grid gap-5">
      <input type="hidden" name="destino" value={PRODUCTO} />
      {enCurso ? (
        <p className="rounded-xl border border-primary bg-white px-4 py-3 text-sm">
          El pesaje {enCurso.numero} de la línea {enCurso.linea} sigue abierto. Termínalo para abrir el siguiente.
          {enCurso.id !== activoId ? (
            <>
              {" "}
              <a href={`/salidas?pesaje=${enCurso.id}`} className="font-medium underline">
                Continuar ese pesaje
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="fecha">Fecha</Label>
          <Input
            id="fecha"
            name="fecha"
            type="date"
            required
            value={enCurso ? enCurso.fecha : fecha}
            onChange={(event) => setFecha(event.target.value)}
            disabled={Boolean(enCurso)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="numero-pesaje">Nº de pesaje</Label>
          <p id="numero-pesaje" className="flex h-11 items-center rounded-lg border bg-white px-3 text-base font-semibold">
            {enCurso ? enCurso.numero : numero}
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="linea-pesaje">Línea</Label>
          <select
            id="linea-pesaje"
            name="linea"
            required
            defaultValue={lineasConReceta[0] ?? "1"}
            disabled={Boolean(enCurso)}
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
      <Button type="submit" disabled={pendiente || Boolean(enCurso)} className="w-fit">
        {pendiente ? "Abriendo…" : "Abrir pesaje"}
      </Button>
      {estado?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}
      {pesajes.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {pesajes.map((item) => (
            <a
              key={item.id}
              href={`/salidas?pesaje=${item.id}`}
              className={`grid gap-1 rounded-xl border px-4 py-3 text-sm hover:bg-muted ${item.id === activoId ? "border-primary bg-white" : "bg-white"}`}
            >
              <span className="text-base font-semibold">Pesaje {item.numero}</span>
              <span className="text-muted-foreground">
                Línea {item.linea} · {item.fecha}
                {item.trazas.length > 0 ? ` · ${item.trazas.length} retiro${item.trazas.length === 1 ? "" : "s"}` : ""}
              </span>
              {item.codigo ? <span className="font-mono text-xs leading-5 break-all">{item.codigo}</span> : null}
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
  const [errorTag, setErrorTag] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const cargado = useRef("");
  const consulta = useRef(0);
  const partida = pesaje.lineas.find((linea) => linea.tipo === lectura?.tipoCodigo) ?? null;
  const maximo = useMemo(() => {
    if (!lectura || !partida) return 0;
    const faltaTipo = Math.max(0, partida.objetivo + pesaje.tolerancia - partida.usado);
    const faltaTotal = Math.max(0, pesaje.objetivo + pesaje.tolerancia - pesaje.total);
    return Math.round(Math.min(lectura.kgRestantes, faltaTipo, faltaTotal) * 1000) / 1000;
  }, [lectura, partida, pesaje]);
  const faltaDelTipo = partida ? Math.max(0, partida.objetivo - partida.usado) : 0;
  const enLogistica = lectura?.estado === "LOGISTICA";
  const fueraDeReceta = Boolean(lectura && !enLogistica && !partida);
  const noAlcanza = Boolean(lectura && partida && lectura.kgRestantes + 0.001 < faltaDelTipo);
  const otros = existencias.filter((item) => item.tipo === lectura?.tipoCodigo && item.tag !== lectura?.tag && item.kg > 0.001);

  function elegir(leido: LoteLeido) {
    cargado.current = leido.tag;
    setErrorTag(null);
    setLectura(leido);
    setTag(leido.tag);
    if (leido.estado === "LOGISTICA") {
      setKg("");
      return;
    }
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

  useEffect(() => {
    const limpio = tag.trim();
    if (cargado.current === limpio) return;
    if (!/^\d{4,8}$/.test(limpio)) {
      setBuscando(false);
      setErrorTag(null);
      if (cargado.current) {
        cargado.current = "";
        setLectura(null);
      }
      return;
    }
    const id = ++consulta.current;
    setBuscando(true);
    const timer = window.setTimeout(() => {
      void loteActualDesdeTag(limpio).then((actual) => {
        if (consulta.current !== id) return;
        setBuscando(false);
        if (!actual.ok) {
          cargado.current = "";
          setErrorTag(actual.error);
          setLectura(null);
          setKg("");
          return;
        }
        setErrorTag(null);
        elegir(actual.lote);
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [tag, pesaje]);

  return (
    <form
      action={accion}
      className="grid gap-6"
      onSubmit={(event) => {
        if (fueraDeReceta || enLogistica) event.preventDefault();
      }}
    >
      <input type="hidden" name="pesaje_id" value={pesaje.id} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-[#f4f6f8] px-4 py-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Llevamos</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatoKg(pesaje.total)}</p>
          <p className="text-sm text-muted-foreground">de {formatoKg(pesaje.objetivo)}</p>
        </div>
        <div className="rounded-xl bg-[#f4f6f8] px-4 py-3 sm:col-span-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Código del pesaje</p>
          <p className="mt-2 font-mono text-sm leading-6 break-all">{pesaje.codigo || "Se arma al registrar el primer retiro."}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {pesaje.lineas.map((linea) => (
          <div key={linea.tipo} className="rounded-xl border px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{linea.tipo}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatoKg(linea.usado)}</p>
            <p className="text-sm text-muted-foreground">
              de {formatoKg(linea.objetivo)}
              {linea.usado + 0.001 < linea.objetivo ? ` · faltan ${formatoKg(linea.objetivo - linea.usado)}` : " · listo"}
            </p>
          </div>
        ))}
      </div>
      <EscanerSalida onLeido={elegir} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="tag">TAG</Label>
          <Input
            id="tag"
            name="tag"
            required
            inputMode="numeric"
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            placeholder="Número de TAG o escanéalo"
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
      {buscando ? <p className="text-sm text-muted-foreground">Buscando el TAG…</p> : null}
      {errorTag ? (
        <p role="alert" className="text-sm text-destructive">
          {errorTag}
        </p>
      ) : null}
      {lectura ? (
        <div className="grid gap-3 rounded-xl border bg-white px-4 py-4 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">TAG</span>
            <span className="mt-0.5 block font-mono text-base font-semibold">{lectura.tag}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Tipo</span>
            <span className="mt-0.5 block font-medium">{lectura.tipo || lectura.producto}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Producto</span>
            <span className="mt-0.5 block">{lectura.producto}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Código</span>
            <span className="mt-0.5 block font-mono">{lectura.codigo}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Fecha</span>
            <span className="mt-0.5 block">
              {lectura.fecha} · {lectura.semana}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">Estado</span>
            <span className="mt-0.5 block">{lectura.estado}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Kg recibidos</span>
            <span className="mt-0.5 block tabular-nums">{formatoKg(lectura.kgRecibidos)}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Kg consumidos</span>
            <span className="mt-0.5 block tabular-nums">{formatoKg(lectura.kgConsumidos)}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Kg disponibles</span>
            <span className="mt-0.5 block font-semibold tabular-nums">{formatoKg(lectura.kgRestantes)}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Uso</span>
            <span className="mt-0.5 block">{lectura.destino || "Sin uso"}</span>
          </p>
          {lectura.minilotes.length > 0 ? (
            <p className="sm:col-span-2">
              <span className="text-muted-foreground">Mini lotes</span>
              <span className="mt-0.5 block">
                {lectura.minilotes
                  .map((mini) => `${mini.token} ${formatoKg(mini.kg)} ${mini.tipo} pesaje ${mini.pesaje} línea ${mini.linea} para ${mini.destino}`)
                  .join(" · ")}
              </span>
            </p>
          ) : null}
          {partida ? (
            <p className="sm:col-span-2 text-muted-foreground">
              Para este pesaje de {partida.tipo} puedes retirar hasta {formatoKg(maximo)}.
            </p>
          ) : null}
        </div>
      ) : null}
      {lectura?.observaciones.trim() ? (
        <p role="status" className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-950">
          Observación: {lectura.observaciones.trim()}
        </p>
      ) : null}
      {enLogistica && lectura ? (
        <p role="alert" className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white">
          Este TAG fue trasladado a logística y ya no se puede consumir.
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
      {estado?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pendiente || fueraDeReceta || enLogistica} className="w-fit">
        {pendiente ? "Guardando…" : "Registrar consumo"}
      </Button>
    </form>
  );
}
