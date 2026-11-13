"use client";

import { useEffect, useRef, useState } from "react";
import { loteActualDesdeQr, loteActualDesdeTag, type LoteLeido } from "@/app/actions";
import { cargarImagen, decodificarImagen, decodificarVideo } from "@/components/decodificar-imagen-qr";
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
    const stream = streamRef.current;
    video.srcObject = stream;
    void video.play().then(() => enfocarCamaraPrincipal(stream.getVideoTracks()[0]));
    const detector = crearDetectorQr();
    let vivo = true;
    let ocupado = false;
    let espera = 0;
    let modo = 0;
    const reenfocar = window.setTimeout(() => {
      void enfocarCamaraPrincipal(streamRef.current?.getVideoTracks()[0]);
    }, 700);

    const cerrar = () => {
      streamRef.current?.getTracks().forEach((pista) => pista.stop());
      streamRef.current = null;
      setCamara(false);
    };

    const tick = async () => {
      if (!vivo || ocupado) return;
      try {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          let texto: string | null = null;
          if (detector) {
            try {
              const codigos = await detector.detect(video);
              texto = codigos.find((codigo) => codigo.rawValue)?.rawValue ?? null;
            } catch {
              texto = null;
            }
          }
          if (!texto) {
            texto = decodificarVideo(video, modo);
            modo += 1;
          }
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
      window.clearTimeout(reenfocar);
    };
  }, [camara]);

  async function abrirCamara() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no abre la cámara. Carga una imagen del QR.");
      return;
    }
    try {
      const stream = await abrirCamaraPrincipal();
      await enfocarCamaraPrincipal(stream.getVideoTracks()[0]);
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

function crearDetectorQr() {
  const Api = (
    window as unknown as {
      BarcodeDetector?: new (opciones: { formats: string[] }) => {
        detect: (origen: CanvasImageSource) => Promise<{ rawValue?: string }[]>;
      };
    }
  ).BarcodeDetector;
  if (!Api) return null;
  try {
    return new Api({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

async function abrirCamaraPrincipal() {
  const pedido = {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  };
  const stream = await navigator.mediaDevices.getUserMedia(pedido);
  const actual = stream.getVideoTracks()[0]?.getSettings().deviceId;
  const dispositivos = await navigator.mediaDevices.enumerateDevices();
  const etiqueta = dispositivos.find((dispositivo) => dispositivo.deviceId === actual)?.label ?? "";
  if (!esGranAngular(etiqueta)) return stream;
  const otra = dispositivos.find(
    (dispositivo) =>
      dispositivo.kind === "videoinput" &&
      dispositivo.deviceId !== actual &&
      /back|rear|trasera|facing back/i.test(dispositivo.label) &&
      !esGranAngular(dispositivo.label),
  );
  if (!otra) return stream;
  stream.getTracks().forEach((pista) => pista.stop());
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { deviceId: { exact: otra.deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
  } catch {
    return navigator.mediaDevices.getUserMedia(pedido);
  }
}

function esGranAngular(etiqueta: string) {
  return /ultra|wide|0\.5|gran angular/i.test(etiqueta);
}

async function enfocarCamaraPrincipal(pista: MediaStreamTrack | undefined) {
  if (!pista) return;
  const capacidades = pista.getCapabilities?.() as
    | (MediaTrackCapabilities & {
        zoom?: { min: number; max: number };
        focusMode?: string[];
      })
    | undefined;
  const zoom = capacidades?.zoom;
  const pedidos: MediaTrackConstraintSet[] = [];
  if (zoom) {
    let objetivo = zoom.min;
    if (zoom.min <= 0.6 && zoom.max >= 1) objetivo = 1;
    else if (zoom.min <= 1 && zoom.max >= 2) objetivo = 2;
    pedidos.push({ zoom: objetivo } as MediaTrackConstraintSet);
  }
  if (capacidades?.focusMode?.includes("continuous")) {
    pedidos.push({ focusMode: "continuous" } as MediaTrackConstraintSet);
  }
  for (const pedido of pedidos) {
    try {
      await pista.applyConstraints({ advanced: [pedido] });
    } catch {
      // El celular no deja cambiar ese ajuste. La cámara sigue abierta.
    }
  }
}

function tagDeLectura(texto: string) {
  const marcado = texto.match(/TAG\s*[: ]\s*(\d{4,8})/i)?.[1];
  if (marcado) return marcado;
  return texto.trim().match(/^(\d{4,8})$/)?.[1] ?? null;
}
