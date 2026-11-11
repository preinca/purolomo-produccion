"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, type Db } from "@/lib/db";
import { fechaHoy, fechaValida, formatoKg } from "@/lib/formato";
import {
  buscarLote,
  eliminarLote,
  guardarObservacionLote,
  insertarRecepcion,
  kgRestantes,
  registrarConsumo,
  registrarDespacho,
  transferirLote,
  trasladarALogistica,
  validarRecepcion,
  type Lote,
} from "@/lib/lotes";
import { destinoValido } from "@/lib/destinos";
import { lineaPorId } from "@/lib/lineas";
import { productoPorCodigo } from "@/lib/mpc";
import { abrirPesaje, buscarMiniLote, buscarPesaje, consumirEnPesaje, faltantesDeReceta, finalizarPesaje, guardarObservacionPesaje, quitarKgDePesaje, retirosDeTag, siguienteNumero, tagsDelTipo } from "@/lib/pesajes";
import { leerConsumoQr, leerTextoQr } from "@/lib/qr";
import { eliminarReceta, guardarReceta, leerRecetaExcel } from "@/lib/recetas";
import { exigirAdmin, exigirRango, exigirSesion, leerSesion } from "@/lib/usuarios";

export type EstadoFormulario = { error?: string; ok?: boolean; tag?: string } | null;

export type LoteLeido = {
  tag: string;
  fecha: string;
  semana: string;
  producto: string;
  tipo: string;
  codigo: string;
  kgRecibidos: number;
  kgDespachados: number;
  kgConsumidos: number;
  kgRestantes: number;
  estado: string;
  destino: string;
  observaciones: string;
  tipoCodigo: string;
  minilotes: { token: string; kg: number; tipo: string; pesaje: number; linea: string; destino: string }[];
};

export type ConsumoLeido = {
  token: string;
  pesaje: number;
  destino: string;
  linea: string;
  tipo: string;
  kg: number;
  tag: string;
  tags: string;
};

async function rutaConsumo(pesajeId: number, extra = "") {
  const destino = (await buscarPesaje(getDb(), pesajeId))?.destino ?? "ALIBAL 1 K";
  const base = `/salidas?modo=consumo&producto=${encodeURIComponent(destino)}&pesaje=${pesajeId}`;
  return extra ? `${base}&${extra}` : base;
}

function texto(formData: FormData, campo: string) {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}

function kilos(formData: FormData, campo: string) {
  return Number(texto(formData, campo).replace(",", "."));
}

function refrescar() {
  revalidatePath("/");
  revalidatePath("/stock");
  revalidatePath("/entradas");
  revalidatePath("/salidas");
  revalidatePath("/receta");
  revalidatePath("/pesajes");
  revalidatePath("/qr");
  revalidatePath("/etiquetas");
  revalidatePath("/eliminar");
  revalidatePath("/historial/entradas");
  revalidatePath("/historial/salidas");
}

async function armarLoteLeido(db: Db, lote: Lote, tipoQr = ""): Promise<LoteLeido> {
  const catalogo = productoPorCodigo(lote.codigo);
  return {
    tag: lote.tag,
    fecha: lote.fecha,
    semana: lote.semana,
    producto: lote.producto,
    tipo: catalogo ? `${catalogo.tipo} · ${catalogo.descripcion}` : tipoQr || lote.producto,
    tipoCodigo: catalogo?.tipo ?? "",
    codigo: lote.codigo,
    kgRecibidos: lote.kgRecibidos,
    kgDespachados: lote.kgDespachados,
    kgConsumidos: lote.kgConsumidos,
    kgRestantes: kgRestantes(lote),
    estado: lote.estado,
    destino: lote.destino,
    observaciones: lote.observaciones,
    minilotes: await retirosDeTag(db, lote.tag),
  };
}

export async function loteActualDesdeTag(
  tag: string,
): Promise<{ ok: true; lote: LoteLeido } | { ok: false; error: string }> {
  if (!(await leerSesion())) return { ok: false, error: "Inicia sesión." };
  const limpio = tag.trim();
  if (!/^\d{4,8}$/.test(limpio)) return { ok: false, error: "Escribe el número de TAG." };
  const db = getDb();
  const lote = await buscarLote(db, limpio);
  if (!lote) return { ok: false, error: `No hay un lote con el TAG ${limpio}.` };
  return { ok: true, lote: await armarLoteLeido(db, lote) };
}

export async function loteActualDesdeQr(
  textoQr: string,
): Promise<{ ok: true; lote: LoteLeido } | { ok: true; consumo: ConsumoLeido } | { ok: false; error: string }> {
  if (!(await leerSesion())) return { ok: false, error: "Inicia sesión." };
  const consumoQr = leerConsumoQr(textoQr);
  if (consumoQr) {
    const db = getDb();
    const mini = await buscarMiniLote(db, consumoQr.token);
    if (!mini) return { ok: false, error: `No hay un consumo con el token ${consumoQr.token}.` };
    const tags = await tagsDelTipo(db, mini.pesajeId, mini.tipo);
    return {
      ok: true,
      consumo: {
        token: mini.token,
        pesaje: mini.numeroPesaje,
        destino: mini.destino,
        linea: mini.linea,
        tipo: mini.tipo,
        kg: mini.kg,
        tag: mini.tag,
        tags: tags.join(", "),
      },
    };
  }
  const lectura = leerTextoQr(textoQr);
  if (!lectura) return { ok: false, error: "Ese QR no es de una paleta de este almacén." };
  const db = getDb();
  const lote = await buscarLote(db, lectura.tag);
  if (!lote) return { ok: false, error: `No hay un lote con el TAG ${lectura.tag}.` };
  return { ok: true, lote: await armarLoteLeido(db, lote, lectura.tipo) };
}

export async function cargarRecetaAlibal(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirAdmin();
  const archivo = formData.get("archivo");
  const linea = texto(formData, "linea");
  if (linea !== "1" && linea !== "2") return { error: "Elige si la receta es para la línea 1 o la línea 2." };
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Elige un archivo Excel (.xlsx) con las columnas Tipo y Kg." };
  }
  const leida = leerRecetaExcel(Buffer.from(await archivo.arrayBuffer()), linea);
  if (!leida.ok) return { error: leida.error };
  const db = getDb();
  const faltantes = await faltantesDeReceta(db, leida.value.items);
  if (faltantes.length > 0) {
    const detalle = faltantes
      .map((item) =>
        item.disponible <= 0.001
          ? `${item.tipo} pide ${formatoKg(item.pedido)} y no hay stock`
          : `${item.tipo} pide ${formatoKg(item.pedido)} y hay ${formatoKg(item.disponible)}`,
      )
      .join(". ");
    return {
      error: `No se cargó el Excel. No hay stock suficiente para esta fórmula de Alibal. ${detalle}.`,
    };
  }
  await guardarReceta(db, leida.value, linea);
  refrescar();
  redirect("/receta");
}

export async function eliminarRecetaFormulario(formData: FormData) {
  await exigirAdmin();
  const linea = texto(formData, "linea");
  if (formData.get("confirmar") !== "si") {
    redirect(`/receta?alerta=${encodeURIComponent("Marca la casilla para confirmar que quieres eliminar la receta.")}`);
  }
  const resultado = await eliminarReceta(getDb(), linea);
  if (!resultado.ok) {
    redirect(`/receta?alerta=${encodeURIComponent(resultado.error)}`);
  }
  refrescar();
  redirect("/receta");
}

export async function numeroSiguientePesaje(fecha: string) {
  if (!(await leerSesion())) return 1;
  const dia = fecha.trim();
  if (!fechaValida(dia)) return 1;
  return await siguienteNumero(getDb(), dia);
}

export async function abrirPesajeFormulario(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirRango(["administrador", "pesador"]);
  const destino = texto(formData, "destino").trim();
  if (!destinoValido(destino)) return { error: "Elige el producto que se va a elaborar." };
  const resultado = await abrirPesaje(getDb(), {
    fecha: texto(formData, "fecha"),
    linea: texto(formData, "linea"),
    destino,
  });
  if (!resultado.ok) return { error: resultado.error };
  refrescar();
  redirect(await rutaConsumo(resultado.value.id));
}

export async function trasladarLogisticaFormulario(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirAdmin();
  const tag = texto(formData, "tag").trim();
  const resultado = await trasladarALogistica(getDb(), {
    tag,
    fecha: fechaHoy(),
    observacion: texto(formData, "observacion"),
  });
  if (!resultado.ok) return { error: resultado.error };
  refrescar();
  revalidatePath(`/lote/${tag}`);
  revalidatePath(`/qr/imagen/${tag}`);
  redirect(`/salidas?modo=logistica&trasladado=${encodeURIComponent(tag)}`);
}

export async function finalizarPesajeFormulario(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirRango(["administrador", "pesador"]);
  const pesajeId = Number(texto(formData, "pesaje_id"));
  const resultado = await finalizarPesaje(getDb(), pesajeId);
  if (!resultado.ok) return { error: resultado.error };
  refrescar();
  redirect(await rutaConsumo(pesajeId, "cerrado=1"));
}

export async function consumirPesajeFormulario(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirRango(["administrador", "pesador"]);
  const pesajeId = Number(texto(formData, "pesaje_id"));
  const tag = texto(formData, "tag").trim();
  const resultado = await consumirEnPesaje(getDb(), {
    pesajeId,
    tag,
    kg: kilos(formData, "kg"),
    nota: texto(formData, "nota").trim().slice(0, 500),
  });
  if (!resultado.ok) return { error: resultado.error };
  refrescar();
  revalidatePath(`/lote/${tag}`);
  revalidatePath(`/qr/imagen/${tag}`);
  redirect(await rutaConsumo(pesajeId, `token=${resultado.value.token}`));
}

export async function quitarKgPesajeFormulario(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirRango(["administrador", "pesador"]);
  const pesajeId = Number(texto(formData, "pesaje_id"));
  const resultado = await quitarKgDePesaje(getDb(), { pesajeId, token: texto(formData, "token") });
  if (!resultado.ok) return { error: resultado.error };
  refrescar();
  revalidatePath(`/lote/${resultado.value.tag}`);
  revalidatePath(`/qr/imagen/${resultado.value.tag}`);
  redirect(await rutaConsumo(pesajeId));
}

export async function guardarObservacionTagFormulario(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirRango(["administrador", "recepcionista"]);
  const tag = texto(formData, "tag").trim();
  const resultado = await guardarObservacionLote(getDb(), tag, texto(formData, "observacion"));
  if (!resultado.ok) return { error: resultado.error };
  refrescar();
  revalidatePath(`/lote/${tag}`);
  revalidatePath(`/qr/imagen/${tag}`);
  return { ok: true, tag };
}

export async function guardarObservacionPesajeFormulario(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirRango(["administrador", "pesador"]);
  const pesajeId = Number(texto(formData, "pesaje_id"));
  const resultado = await guardarObservacionPesaje(getDb(), pesajeId, texto(formData, "observacion"));
  if (!resultado.ok) return { error: resultado.error };
  refrescar();
  revalidatePath(`/qr/pesaje/${pesajeId}`);
  return { ok: true };
}

export async function crearRecepcion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirRango(["administrador", "recepcionista"]);
  const validado = validarRecepcion({
    fecha: texto(formData, "fecha"),
    tag: texto(formData, "tag"),
    codigo: texto(formData, "codigo"),
    cantidad: texto(formData, "kg_recibidos"),
    semana: texto(formData, "semana"),
  });
  if (!validado.ok) return { error: validado.error };

  const resultado = await insertarRecepcion(getDb(), {
    ...validado.value,
    observaciones: texto(formData, "observaciones").trim().slice(0, 500),
  });
  if (!resultado.ok) return { error: resultado.error };
  refrescar();
  redirect(`/entradas?etiqueta=${resultado.value.tag}`);
}

export async function validarTransferencia(formData: FormData) {
  await exigirAdmin();
  const tag = texto(formData, "tag");
  const resultado = await transferirLote(getDb(), tag, fechaHoy());
  if (!resultado.ok) return;
  refrescar();
  revalidatePath(`/lote/${tag}`);
}

export async function crearDespacho(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirAdmin();
  const tag = texto(formData, "tag").trim();
  const fecha = texto(formData, "fecha");
  const kg = kilos(formData, "kg");
  const destino = texto(formData, "destino").trim();
  const linea = texto(formData, "linea").trim();
  if (!fechaValida(fecha)) return { error: "Indica una fecha válida." };
  if (!destinoValido(destino)) {
    return { error: "Elige el producto y la presentación donde se va a usar." };
  }
  if (!lineaPorId(linea)) return { error: "Elige si se usa en la línea 1 o en la línea 2." };
  const resultado = await registrarDespacho(getDb(), {
    tag,
    fecha,
    kg,
    destino,
    linea,
    nota: texto(formData, "nota").trim().slice(0, 500),
  });
  if (!resultado.ok) return { error: resultado.error };
  refrescar();
  revalidatePath(`/lote/${tag}`);
  return { ok: true, tag };
}

export async function eliminarLoteFormulario(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirAdmin();
  const tag = texto(formData, "tag").trim();
  if (texto(formData, "confirmar") !== "si") {
    return { error: "Confirma que quieres eliminar el lote." };
  }
  const resultado = await eliminarLote(getDb(), tag);
  if (!resultado.ok) return { error: resultado.error };
  refrescar();
  revalidatePath(`/lote/${tag}`);
  redirect(`/eliminar?eliminado=${encodeURIComponent(tag)}`);
}

export async function crearConsumo(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirAdmin();
  const tag = texto(formData, "tag").trim();
  const fecha = texto(formData, "fecha");
  const kg = kilos(formData, "kg");
  if (!fechaValida(fecha)) return { error: "Indica una fecha válida." };
  const resultado = await registrarConsumo(getDb(), {
    tag,
    fecha,
    kg,
    nota: texto(formData, "nota").trim().slice(0, 500),
  });
  if (!resultado.ok) return { error: resultado.error };
  refrescar();
  revalidatePath(`/lote/${tag}`);
  return { ok: true, tag };
}
