import jsQR from "jsqr";

export function decodificarPixeles(data: Uint8ClampedArray, width: number, height: number) {
  if (width < 1 || height < 1) return null;
  return jsQR(data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

/** Prueba el cuadro completo, el centro y el mismo cuadro un poco más bajo, porque el QR impreso es más alto que ancho. */
export function decodificarVideo(video: HTMLVideoElement, modo: number) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw < 2 || vh < 2) return null;
  const margenX = Math.round(vw * 0.12);
  const margenY = Math.round(vh * 0.12);
  const regiones = [
    { sx: 0, sy: 0, sw: vw, sh: vh, aplastar: false },
    { sx: margenX, sy: margenY, sw: vw - margenX * 2, sh: vh - margenY * 2, aplastar: false },
    { sx: 0, sy: 0, sw: vw, sh: vh, aplastar: true },
  ];
  const region = regiones[modo % regiones.length];
  return leerDeVideo(video, region.sx, region.sy, region.sw, region.sh, region.aplastar);
}

function leerDeVideo(
  video: HTMLVideoElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  aplastar: boolean,
) {
  const maxLado = 1100;
  const mayor = Math.max(sw, sh);
  const escala = mayor > maxLado ? maxLado / mayor : 1;
  const width = Math.max(1, Math.round(sw * escala));
  const height = Math.max(1, Math.round(sh * escala * (aplastar ? 0.84 : 1)));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
  const datos = ctx.getImageData(0, 0, width, height);
  return decodificarPixeles(datos.data, datos.width, datos.height);
}

export function decodificarImagen(imagen: HTMLImageElement) {
  const completo = leerRegion(imagen, 0, 0, imagen.naturalWidth, imagen.naturalHeight, 1400);
  if (completo) return completo;
  const lado = Math.round(Math.min(imagen.naturalWidth, imagen.naturalHeight) * 0.62);
  const sx = Math.round((imagen.naturalWidth - lado) / 2);
  const sy = Math.round((imagen.naturalHeight - lado) / 2);
  return leerRegion(imagen, sx, sy, lado, lado, 1400);
}

function leerRegion(
  imagen: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  maxLado: number,
) {
  const mayor = Math.max(sw, sh);
  const escala = mayor > maxLado ? maxLado / mayor : 1;
  const width = Math.max(1, Math.round(sw * escala));
  const height = Math.max(1, Math.round(sh * escala));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(imagen, sx, sy, sw, sh, 0, 0, width, height);
  const datos = ctx.getImageData(0, 0, width, height);
  return decodificarPixeles(datos.data, datos.width, datos.height);
}

export function cargarImagen(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const imagen = new Image();
    imagen.onload = () => resolve(imagen);
    imagen.onerror = () => reject(new Error("imagen"));
    imagen.src = url;
  });
}
