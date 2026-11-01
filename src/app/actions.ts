"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { fechaHoy, fechaValida } from "@/lib/formato";
import {
  buscarLote,
  eliminarLote,
  insertarRecepcion,
  kgRestantes,
  registrarConsumo,
  registrarDespacho,
  transferirLote,
  validarRecepcion,
} from "@/lib/lotes";
import { destinoValido } from "@/lib/destinos";
import { lineaPorId } from "@/lib/lineas";
import { productoPorCodigo } from "@/lib/mpc";
import { abrirPesaje, buscarMiniLote, consumirEnPesaje, retirosDeTag, tagsDelTipo } from "@/lib/pesajes";
import { leerConsumoQr, leerTextoQr } from "@/lib/qr";
import { guardarReceta, leerRecetaExcel } from "@/lib/recetas";
import { exigirAdmin, exigirSesion, leerSesion } from "@/lib/usuarios";

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
  revalidatePath("/eliminar");
  revalidatePath("/historial/entradas");
  revalidatePath("/historial/salidas");
}

export async function loteActualDesdeQr(
  textoQr: string,
): Promise<{ ok: true; lote: LoteLeido } | { ok: true; consumo: ConsumoLeido } | { ok: false; error: string }> {
  if (!(await leerSesion())) return { ok: false, error: "Inicia sesión." };
  const consumoQr = leerConsumoQr(textoQr);
  if (consumoQr) {
    const db = getDb();
    const mini = buscarMiniLote(db, consumoQr.token);
    if (!mini) return { ok: false, error: `No hay un consumo con el token ${consumoQr.token}.` };
    const tags = tagsDelTipo(db, mini.pesajeId, mini.tipo);
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
  const lote = buscarLote(db, lectura.tag);
  if (!lote) return { ok: false, error: `No hay un lote con el TAG ${lectura.tag}.` };
  const catalogo = productoPorCodigo(lote.codigo);
  return {
    ok: true,
    lote: {
      tag: lote.tag,
      fecha: lote.fecha,
      semana: lote.semana,
      producto: lote.producto,
      tipo: catalogo ? `${catalogo.tipo} · ${catalogo.descripcion}` : lectura.tipo,
      tipoCodigo: catalogo?.tipo ?? "",
      codigo: lote.codigo,
      kgRecibidos: lote.kgRecibidos,
      kgDespachados: lote.kgDespachados,
      kgConsumidos: lote.kgConsumidos,
      kgRestantes: kgRestantes(lote),
      estado: lote.estado,
      destino: lote.destino,
      minilotes: retirosDeTag(db, lote.tag),
    },
  };
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
  guardarReceta(getDb(), leida.value, linea);
  refrescar();
  redirect("/receta");
}

export async function abrirPesajeFormulario(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirSesion();
  const numero = Number(texto(formData, "numero"));
  const destino = texto(formData, "destino").trim();
  if (!destinoValido(destino)) return { error: "Elige el producto que se va a elaborar." };
  const resultado = abrirPesaje(getDb(), {
    fecha: texto(formData, "fecha"),
    numero,
    linea: texto(formData, "linea"),
    destino,
  });
  if (!resultado.ok) return { error: resultado.error };
  refrescar();
  redirect(`/salidas?pesaje=${resultado.value.id}`);
}

export async function consumirPesajeFormulario(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirSesion();
  const pesajeId = Number(texto(formData, "pesaje_id"));
  const tag = texto(formData, "tag").trim();
  const resultado = consumirEnPesaje(getDb(), {
    pesajeId,
    tag,
    kg: kilos(formData, "kg"),
    nota: texto(formData, "nota").trim().slice(0, 500),
  });
  if (!resultado.ok) return { error: resultado.error };
  refrescar();
  revalidatePath(`/lote/${tag}`);
  revalidatePath(`/qr/imagen/${tag}`);
  redirect(`/salidas?pesaje=${pesajeId}&token=${resultado.value.token}`);
}

export async function crearRecepcion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirAdmin();
  const validado = validarRecepcion({
    fecha: texto(formData, "fecha"),
    tag: texto(formData, "tag"),
    codigo: texto(formData, "codigo"),
    cantidad: texto(formData, "kg_recibidos"),
  });
  if (!validado.ok) return { error: validado.error };

  const resultado = insertarRecepcion(getDb(), {
    ...validado.value,
    observaciones: texto(formData, "observaciones").trim().slice(0, 500),
  });
  if (!resultado.ok) return { error: resultado.error };
  refrescar();
  return { ok: true, tag: resultado.value.tag };
}

export async function validarTransferencia(formData: FormData) {
  await exigirAdmin();
  const tag = texto(formData, "tag");
  const resultado = transferirLote(getDb(), tag, fechaHoy());
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
  const resultado = registrarDespacho(getDb(), {
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
  const resultado = eliminarLote(getDb(), tag);
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
  const resultado = registrarConsumo(getDb(), {
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
