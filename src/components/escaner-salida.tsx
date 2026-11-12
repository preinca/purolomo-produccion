"use client";

import { useEffect, useRef, useState } from "react";
import { loteActualDesdeQr, loteActualDesdeTag, type LoteLeido } from "@/app/actions";
import {
  cargarImagen,
  decodificarImagen,
  decodificarPixeles,
} from "@/components/decodificar-imagen-qr";
import { tagDePdfEtiqueta } from "@/lib/pdf-etiqueta";

export function EscanerSalida({
  onLeido,
  camaraGrande = false,
}: {
  onLeido: (lectura: LoteLeido) => void;
  camaraGrande?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [camara, setCamara] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onLeidoRef = useRef(onLeido);
  onLeidoRef.current = onLeido;

  function detenerCamara() {
    streamRef.current?.getTracks().forEach((pista) => pista.stop());
    streamRef.current = null;
    setCamara(false);
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((pista) => pista.stop());
    };
  }, []);

  useEffect(() => {
    if (!camara || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    void video.play();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let vivo = true;
    let ocupado = false;
    let espera = 0;

    const cerrar = () => {
      streamRef.current?.getTracks().forEach((pista) => pista.stop());
      streamRef.current = null;
      setCamara(false);
    };

    const tick = async () => {
      if (!vivo || ocupado) return;
      try {
        if (video.readyState >= 2 && ctx && video.videoWidth > 0) {
          const lado = Math.round(Math.min(video.videoWidth, video.videoHeight) * 0.72);
          const sx = Math.round((video.videoWidth - lado) / 2);
          const sy = Math.round((video.videoHeight - lado) / 2);
          const maxLado = 1200;
          const escala = lado > maxLado ? maxLado / lado : 1;
          const width = Math.max(1, Math.round(lado * escala));
          canvas.width = width;
          canvas.height = width;
          ctx.drawImage(video, sx, sy, lado, lado, 0, 0, width, width);
          const datos = ctx.getImageData(0, 0, width, width);
          const texto = decodificarPixeles(datos.data, width, width);
          const tag = texto ? tagDeLectura(texto) : null;
          if (texto && /TOKEN:\s*ML/i.test(texto)) {
            ocupado = true;
            const actual = await loteActualDesdeQr(texto);
            if (!vivo) return;
            if (!actual.ok) {
              setError(actual.error);
              cerrar();
              return;
            }
            if (!("lote" in actual)) {
              setError("Ese QR es de un consumo ya retirado. Escanea el QR del TAG que está en la cava.");
              cerrar();
              return;
            }
            onLeidoRef.current(actual.lote);
            cerrar();
            return;
          }
          if (tag) {
            ocupado = true;
            const actual = await loteActualDesdeTag(tag);
            if (!vivo) return;
            if (!actual.ok) {
              setError(actual.error);
              cerrar();
              return;
            }
            onLeidoRef.current(actual.lote);
            cerrar();
            return;
          }
        }
      } catch {
        ocupado = false;
      }
      if (vivo && !ocupado) espera = window.setTimeout(() => void tick(), 180);
    };

    espera = window.setTimeout(() => void tick(), 180);
    return () => {
      vivo = false;
      window.clearTimeout(espera);
    };
  }, [camara]);

  async function abrirCamara() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no abre la cámara. Carga una imagen del QR.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCamara(true);
    } catch {
      setError("No se pudo usar la cámara. Carga una imagen del QR.");
    }
  }

  async function leerArchivo(archivo: File | undefined) {
    if (!archivo) return;
    setLeyendo(true);
    setError(null);
    const url = URL.createObjectURL(archivo);
    try {
      const imagen = await cargarImagen(url);
      const texto = decodificarImagen(imagen);
      if (!texto) {
        setError("Esa imagen no tiene el QR de un TAG.");
        return;
      }
      const actual = await loteActualDesdeQr(texto);
      if (!actual.ok) {
        setError(actual.error);
        return;
      }
      if (!("lote" in actual)) {
        setError("Ese QR es de un consumo ya retirado. Escanea el QR del TAG que está en la cava.");
        return;
      }
      onLeido(actual.lote);
    } catch {
      setError("No se pudo abrir esa imagen.");
    } finally {
      URL.revokeObjectURL(url);
      setLeyendo(false);
    }
  }

  async function leerPdf(archivo: File | undefined) {
    if (!archivo) return;
    setLeyendo(true);
    setError(null);
    try {
      const datos = new Uint8Array(await archivo.arrayBuffer());
      const cabecera = new TextDecoder("latin1").decode(datos.subarray(0, 5));
      if (!cabecera.startsWith("%PDF")) {
        setError("Elige el PDF de la etiqueta.");
        return;
      }
      const tag = tagDePdfEtiqueta(datos);
      if (!tag) {
        setError("Ese PDF no tiene el TAG de una etiqueta de cava.");
        return;
      }
      const actual = await loteActualDesdeTag(tag);
      if (!actual.ok) {
        setError(actual.error);
        return;
      }
      onLeido(actual.lote);
    } catch {
      setError("No se pudo leer ese PDF.");
    } finally {
      setLeyendo(false);
    }
  }

  return (
    <div className={camaraGrande ? "grid gap-2" : "grid gap-2 rounded-lg border border-dashed px-3 py-3"}>
      <div className={camaraGrande ? "rounded-lg border border-dashed px-3 py-3" : undefined}>
      <p className="text-sm font-medium">Escanear el QR del TAG</p>
      <p className="text-xs text-muted-foreground">
        Usa el mismo QR de la recepción, carga el PDF de la etiqueta, o escribe el número de TAG en el campo de abajo.
      </p>
      </div>
      {camaraGrande ? (
        <div className="mt-4 grid gap-4">
          <button
            type="button"
            onClick={() => void abrirCamara()}
            className="inline-flex h-16 w-full items-center justify-center rounded-xl bg-blue-600 px-6 text-lg font-semibold text-white hover:bg-blue-700 sm:h-14 sm:text-base"
          >
            Escanear con cámara
          </button>
          {camara ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={detenerCamara}
                className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm"
              >
                Cerrar cámara
              </button>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <label className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-amber-500 px-3 text-center text-sm font-semibold text-white hover:bg-amber-600">
              {leyendo ? "Leyendo…" : "Cargar imagen de QR"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={leyendo}
                onChange={(event) => {
                  const archivo = event.target.files?.[0];
                  event.target.value = "";
                  void leerArchivo(archivo);
                }}
              />
            </label>
            <label className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-[#7B4B2A] px-3 text-center text-sm font-semibold text-white hover:bg-[#633C22]">
              {leyendo ? "Leyendo…" : "Cargar etiqueta PDF"}
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                disabled={leyendo}
                onChange={(event) => {
                  const archivo = event.target.files?.[0];
                  event.target.value = "";
                  void leerPdf(archivo);
                }}
              />
            </label>
          </div>
        </div>
      ) : (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void abrirCamara()}
          className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground"
        >
          Escanear con cámara
        </button>
        <label className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-amber-500 px-2.5 text-sm font-medium text-white hover:bg-amber-600">
          {leyendo ? "Leyendo…" : "Cargar imagen de QR"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={leyendo}
            onChange={(event) => {
              const archivo = event.target.files?.[0];
              event.target.value = "";
              void leerArchivo(archivo);
            }}
          />
        </label>
        <label className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-[#7B4B2A] px-2.5 text-sm font-medium text-white hover:bg-[#633C22]">
          {leyendo ? "Leyendo…" : "Cargar etiqueta PDF"}
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={leyendo}
            onChange={(event) => {
              const archivo = event.target.files?.[0];
              event.target.value = "";
              void leerPdf(archivo);
            }}
          />
        </label>
        {camara ? (
          <button
            type="button"
            onClick={detenerCamara}
            className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm"
          >
            Cerrar cámara
          </button>
        ) : null}
      </div>
      )}
      {camara ? (
        <video ref={videoRef} muted playsInline className="max-h-48 w-full rounded-lg bg-black object-cover" />
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function tagDeLectura(texto: string) {
  const marcado = texto.match(/TAG\s*[: ]\s*(\d{4,8})/i)?.[1];
  if (marcado) return marcado;
  return texto.trim().match(/^(\d{4,8})$/)?.[1] ?? null;
}
