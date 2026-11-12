"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { abrirPesajeFormulario, consumirPesajeFormulario, eliminarPesajeEnCursoFormulario, finalizarPesajeFormulario, guardarObservacionPesajeFormulario, loteActualDesdeTag, numeroSiguientePesaje, quitarKgPesajeFormulario, type EstadoFormulario, type LoteLeido } from "@/app/actions";
import { EscanerSalida } from "@/components/escaner-salida";
import { FormObservacion } from "@/components/form-observacion";
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
  minimo: number;
  maximo: number;
  total: number;
  lineas: { tipo: string; objetivo: number; usado: number; tolerancia?: number; minimo?: number; maximo?: number }[];
  codigo: string;
  finalizado: boolean;
  observaciones: string;
  trazas: TrazaPesaje[];
};

export function SalidaAlibal({
  hoy,
  lineasConReceta,
  existencias,
  pesaje,
  enCurso,
  numeroSiguiente,
  token,
}: {
  hoy: string;
  lineasConReceta: string[];
  existencias: { tag: string; tipo: string; kg: number }[];
  pesaje: PesajeVista | null;
  enCurso: { id: number; numero: number; linea: string; fecha: string } | null;
  numeroSiguiente: number;
  token?: string;
}) {
  return (
    <div className="grid gap-8">
      <div className="rounded-2xl border border-purolomo-red bg-white px-5 py-4">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Producto del pesaje</p>
        <p className="mt-1 text-2xl font-semibold">{PRODUCTO}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Abrir pesaje</CardTitle>
          <CardDescription>
            El pesaje es de {PRODUCTO}. La fecha y la línea lo definen. El número sigue solo y no se abre otro hasta terminar el actual.
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
            <CardTitle>Registrar consumo de {pesaje.destino}</CardTitle>
            <CardDescription>
              Pesaje {pesaje.numero} de {pesaje.destino} · línea {pesaje.linea}. Escanea el QR o escribe el número de TAG y confirma los kilos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Consumir pesaje={pesaje} existencias={existencias} token={token ?? ""} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function AbrirPesaje({
  hoy,
  lineasConReceta,
  activoId,
  enCurso,
  numeroSiguiente,
}: {
  hoy: string;
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
              <a href={`/salidas?modo=consumo&producto=${encodeURIComponent(PRODUCTO)}&pesaje=${enCurso.id}`} className="font-medium underline">
                Continuar ese pesaje
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="grid gap-1.5">
          <Label htmlFor="producto-pesaje">Producto</Label>
          <p id="producto-pesaje" className="flex h-11 items-center rounded-lg border bg-white px-3 text-base font-semibold">
            {PRODUCTO}
          </p>
        </div>
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
    </form>
  );
}

function Consumir({
  pesaje,
  existencias,
  token,
}: {
  pesaje: PesajeVista;
  existencias: { tag: string; tipo: string; kg: number }[];
  token: string;
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
    const faltaTipo = Math.max(0, (partida.maximo ?? partida.objetivo + (partida.tolerancia ?? pesaje.tolerancia)) - partida.usado);
    const faltaPromedio = Math.max(0, partida.objetivo - partida.usado);
    const faltaTotal = Math.max(0, pesaje.maximo - pesaje.total);
    return Math.round(Math.min(lectura.kgRestantes, Math.max(faltaTipo, faltaPromedio), faltaTotal) * 1000) / 1000;
  }, [lectura, partida, pesaje]);
  const faltaDelTipo = partida ? Math.max(0, partida.objetivo - partida.usado) : 0;
  const enLogistica = lectura?.estado === "LOGISTICA";
  const fueraDeReceta = Boolean(lectura && !enLogistica && !partida);
  const noAlcanza = Boolean(lectura && partida && lectura.kgRestantes + 0.001 < faltaDelTipo);
  const otros = existencias.filter((item) => item.tipo === lectura?.tipoCodigo && item.tag !== lectura?.tag && item.kg > 0.001);
  const minimoTipo = partida?.minimo ?? partida?.objetivo ?? 0;
  const maximoTipo = partida?.maximo ?? (partida ? partida.objetivo + (partida.tolerancia ?? pesaje.tolerancia) : 0);
  const kilosEscritos = Number(kg.replace(",", "."));
  const proyectadoTipo = partida
    ? Math.round((partida.usado + (Number.isFinite(kilosEscritos) ? kilosEscritos : 0)) * 1000) / 1000
    : 0;
  const faltaMinimo = partida ? Math.max(0, minimoTipo - partida.usado) : 0;
  const tagAlcanza = Boolean(lectura && lectura.kgRestantes + 0.001 >= faltaMinimo);
  const faltaPromedio = partida ? Math.max(0, partida.objetivo - partida.usado) : 0;
  const formulaLista =
    pesaje.lineas.length > 0 &&
    pesaje.lineas.every(
      (linea) =>
        linea.usado + 0.001 >= linea.objetivo &&
        linea.usado <= (linea.maximo ?? linea.objetivo) + 0.001,
    );
  const completaPromedio = Boolean(
    partida &&
      lectura &&
      Number.isFinite(kilosEscritos) &&
      proyectadoTipo <= partida.objetivo + 0.001 &&
      (Math.abs(kilosEscritos - lectura.kgRestantes) < 0.001 || Math.abs(kilosEscritos - faltaPromedio) < 0.001),
  );
  const fueraDeRango = Boolean(
    partida &&
      Number.isFinite(kilosEscritos) &&
      kilosEscritos > 0 &&
      !completaPromedio &&
      (proyectadoTipo > maximoTipo + 0.001 || (proyectadoTipo + 0.001 < minimoTipo && tagAlcanza)),
  );

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
    const faltaPromedio = Math.max(0, Math.round((linea.objetivo - linea.usado) * 1000) / 1000);
    const sugerido = Math.min(leido.kgRestantes, faltaPromedio);
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
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-[#f4f6f8] px-4 py-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Producto</p>
          <p className="mt-1 text-2xl font-semibold">{pesaje.destino}</p>
        </div>
        <div className="rounded-xl bg-[#f4f6f8] px-4 py-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Llevamos</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatoKg(pesaje.total)}</p>
          <p className="text-sm text-muted-foreground">
            rango {formatoKg(pesaje.minimo)} a {formatoKg(pesaje.maximo)} · tolerancia {formatoKg(pesaje.tolerancia)}
          </p>
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
              rango {formatoKg(linea.minimo ?? linea.objetivo)} a {formatoKg(linea.maximo ?? linea.objetivo)}
              {" · "}
              tolerancia {formatoKg(linea.tolerancia ?? pesaje.tolerancia)}
              {linea.usado + 0.001 < (linea.minimo ?? linea.objetivo)
                ? ` · faltan ${formatoKg((linea.minimo ?? linea.objetivo) - linea.usado)}`
                : " · listo"}
            </p>
          </div>
        ))}
      </div>
      {pesaje.finalizado ? null : (
      <>
      {pesaje.trazas.length > 0 ? (
        <div className="grid gap-3">
          <div>
            <p className="text-base font-medium">Kg cargados</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Si al escanear el QR o al colocar el TAG los kilos quedaron mal, quítalos y vuelve a cargarlos.
            </p>
          </div>
          {pesaje.trazas.map((mini) => (
            <article
              key={mini.token}
              className={`flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between ${tag.trim() === mini.tag ? "border-primary" : ""}`}
            >
              <div>
                <p className="font-medium">
                  {mini.tipo} · {formatoKg(mini.kg)}
                </p>
                <p className="text-sm text-muted-foreground">
                  TAG <span className="font-mono">{mini.tag}</span> · <span className="font-mono">{mini.token}</span>
                </p>
              </div>
              <QuitarKg pesajeId={pesaje.id} token={mini.token} />
            </article>
          ))}
        </div>
      ) : null}
      <form
        action={accion}
        className="grid gap-6"
        onSubmit={(event) => {
          if (fueraDeReceta || enLogistica || fueraDeRango) event.preventDefault();
        }}
      >
      <input type="hidden" name="pesaje_id" value={pesaje.id} />
      {formulaLista ? null : <EscanerSalida onLeido={elegir} camaraGrande />}
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
              {partida.tipo} opera de {formatoKg(minimoTipo)} a {formatoKg(maximoTipo)}. Los kilos tienen que quedar dentro de ese rango.
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
      {fueraDeRango && partida ? (
        <p role="alert" className="rounded-lg border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {partida.tipo} opera de {formatoKg(minimoTipo)} a {formatoKg(maximoTipo)}. Esos kilos quedan fuera del rango y no se pueden cargar.
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
      {formulaLista ? null : (
      <button
        type="submit"
        disabled={pendiente || fueraDeReceta || enLogistica}
        className="inline-flex h-16 w-full items-center justify-center rounded-xl bg-green-600 px-6 text-lg font-semibold text-white hover:bg-green-700 disabled:opacity-50 sm:h-14 sm:text-base"
      >
        {pendiente ? "Guardando…" : "Registrar consumo"}
      </button>
      )}
      </form>
      <EliminarRegistro pesajeId={pesaje.id} />
      </>
      )}
      {pesaje.finalizado ? (
        <div className="grid gap-2 rounded-xl border border-primary bg-white px-4 py-4">
          <p className="text-sm font-medium">Pesaje finalizado. Ya quedó en el registro.</p>
          <p className="font-mono text-2xl leading-snug font-semibold break-all">{pesaje.codigo}</p>
        </div>
      ) : pesaje.lineas.length > 0 &&
        pesaje.total + 0.001 >= pesaje.minimo &&
        pesaje.total <= pesaje.maximo + 0.001 &&
        pesaje.lineas.every((linea) => linea.usado + 0.001 >= (linea.minimo ?? linea.objetivo) && linea.usado <= (linea.maximo ?? linea.objetivo) + 0.001) ? (
        <>
          {pesaje.trazas.length > 0 ? <Retiros pesaje={pesaje} token={token} /> : null}
          <FormObservacion
            key={`${pesaje.id}-${pesaje.observaciones}`}
            accion={guardarObservacionPesajeFormulario}
            campoId="pesaje_id"
            id={String(pesaje.id)}
            valor={pesaje.observaciones}
            etiqueta="Observación de este pesaje"
          />
          {pesaje.observaciones.trim() ? (
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-950">
              Observación: {pesaje.observaciones.trim()}
            </p>
          ) : null}
          <FinalizarPesaje pesajeId={pesaje.id} />
        </>
      ) : null}
    </div>
  );
}

function Retiros({ pesaje, token }: { pesaje: PesajeVista; token: string }) {
  return (
    <div className="grid gap-5 border-t pt-6">
      <div>
        <p className="text-base font-medium">Retiros de este pesaje</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada retiro queda con su mini lote, el TAG y los kilos. Si un tipo usa dos TAG, aparecen los dos.
        </p>
      </div>
      {pesaje.codigo ? (
            <div className="grid gap-2">
              <p className="rounded-lg bg-muted px-3 py-2 font-mono text-sm break-all">{pesaje.codigo}</p>
              <a
                href={`/qr/pesaje/${pesaje.id}`}
                download={`qr-pesaje-${pesaje.numero}.png`}
                className="w-fit text-sm font-medium underline"
              >
                Descargar el QR del pesaje
              </a>
            </div>
          ) : null}
          {pesaje.trazas.map((mini) => (
            <article
              key={mini.token}
              className={`grid gap-4 rounded-xl border bg-white p-5 ${token === mini.token ? "border-primary" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-mono text-base font-semibold">{mini.token}</p>
                <p className="text-base font-semibold tabular-nums">{formatoKg(mini.kg)}</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Tipo</dt>
                  <dd className="mt-0.5 font-medium">{mini.tipo}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">TAG</dt>
                  <dd className="mt-0.5 font-mono font-medium">{mini.tag}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Pesaje</dt>
                  <dd className="mt-0.5 font-medium">{pesaje.numero}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Línea</dt>
                  <dd className="mt-0.5 font-medium">{pesaje.linea}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Producto</dt>
                  <dd className="mt-0.5 font-medium">{pesaje.destino}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`/qr/imagen/${mini.tag}`}
                  download={`qr-${mini.tag}.png`}
                  className="w-fit text-sm font-medium underline"
                >
                  Descargar el QR del TAG
                </a>
                {pesaje.finalizado ? null : <QuitarKg pesajeId={pesaje.id} token={mini.token} />}
              </div>
            </article>
          ))}
    </div>
  );
}

function EliminarRegistro({ pesajeId }: { pesajeId: number }) {
  const [pregunta, setPregunta] = useState(false);
  if (!pregunta) {
    return (
      <div className="border-t-2 border-neutral-800 pt-6">
        <button
          type="button"
          onClick={() => setPregunta(true)}
          className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-red-600 px-4 text-base font-semibold text-white hover:bg-red-700"
        >
          Eliminar pesaje en proceso
        </button>
      </div>
    );
  }
  return (
    <div className="grid gap-4 rounded-xl border-2 border-amber-400 bg-amber-50 px-5 py-5">
      <p className="text-lg font-semibold leading-snug text-amber-950 sm:text-xl">
        ¿Estás seguro de eliminar el pesaje en proceso? Se quitan los kilos ya cargados y este pesaje deja de existir.
      </p>
      <form action={eliminarPesajeEnCursoFormulario} className="grid gap-3">
        <input type="hidden" name="pesaje_id" value={pesajeId} />
        <label className="flex items-center gap-2 text-base font-medium">
          <input name="confirmar" type="checkbox" value="si" required className="size-5" />
          Confirmo eliminar este pesaje
        </label>
        <button
          type="submit"
          className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-red-600 px-4 text-base font-semibold text-white hover:bg-red-700"
        >
          Sí, eliminar
        </button>
        <button
          type="button"
          onClick={() => setPregunta(false)}
          className="inline-flex h-14 w-full items-center justify-center rounded-xl border border-border bg-white px-6 text-base font-semibold"
        >
          No, volver
        </button>
      </form>
    </div>
  );
}

function QuitarKg({ pesajeId, token }: { pesajeId: number; token: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(quitarKgPesajeFormulario, null);
  return (
    <form action={accion} className="grid gap-2">
      <input type="hidden" name="pesaje_id" value={pesajeId} />
      <input type="hidden" name="token" value={token} />
      <Button type="submit" variant="outline" disabled={pendiente} className="h-11">
        {pendiente ? "Quitando…" : "Quitar kg"}
      </Button>
      {estado?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}
    </form>
  );
}

function FinalizarPesaje({ pesajeId }: { pesajeId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(finalizarPesajeFormulario, null);
  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="pesaje_id" value={pesajeId} />
      <p className="rounded-xl bg-green-600 px-4 py-4 text-base font-medium text-white">
        Todos los kilos del pesaje ya están cargados. Ya puedes procesar la salida del pesaje.
      </p>
      <Button type="submit" disabled={pendiente} className="h-14 w-full text-lg">
        {pendiente ? "Finalizando…" : "Registrar pesaje"}
      </Button>
      {estado?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}
    </form>
  );
}
