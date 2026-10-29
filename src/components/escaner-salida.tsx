"use client";

import { useEffect, useRef, useState } from "react";
import { loteActualDesdeQr, type LoteLeido } from "@/app/actions";
import {
  cargarImagen,
  decodificarImagen,
  decodificarPixeles,
} from "@/components/decodificar-imagen-qr";

export function EscanerSalida({ onLeido }: { onLeido: (lectura: LoteLeido) => void }) {
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

    const tick = async () => {
      if (!vivo) return;
      if (video.readyState >= 2 && ctx && video.videoWidth > 0) {
        const maxLado = 800;
        const mayor = Math.max(video.videoWidth, video.videoHeight);
        const escala = mayor > maxLado ? maxLado / mayor : 1;
        const width = Math.max(1, Math.round(video.videoWidth * escala));
        const height = Math.max(1, Math.round(video.videoHeight * escala));
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(video, 0, 0, width, height);
        const datos = ctx.getImageData(0, 0, width, height);
        const texto = decodificarPixeles(datos.data, width, height);
        if (texto) {
          const actual = await loteActualDesdeQr(texto);
          if (!actual.ok) {
            setError(actual.error);
            streamRef.current?.getTracks().forEach((pista) => pista.stop());
            streamRef.current = null;
            setCamara(false);
            return;
          }
          onLeidoRef.current(actual.lote);
          streamRef.current?.getTracks().forEach((pista) => pista.stop());
          streamRef.current = null;
          setCamara(false);
          return;
        }
      }
      requestAnimationFrame(() => {
        void tick();
      });
    };

    const marco = requestAnimationFrame(tick);
    return () => {
      vivo = false;
      cancelAnimationFrame(marco);
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
        video: { facingMode: { ideal: "environment" } },
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
        setError("Esa imagen no tiene el QR de una paleta.");
        return;
      }
      const actual = await loteActualDesdeQr(texto);
      if (!actual.ok) {
        setError(actual.error);
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

  return (
    <div className="grid gap-2 rounded-lg border border-dashed px-3 py-3">
      <p className="text-sm font-medium">Escanear el QR de la paleta</p>
      <p className="text-xs text-muted-foreground">
        Usa el mismo QR de la recepción. Al leerlo se completa el TAG para descontar los kilos de esta salida.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void abrirCamara()}
          className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground"
        >
          Escanear con cámara
        </button>
        <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted">
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
