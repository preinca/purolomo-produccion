import jsQR from "jsqr";

export function decodificarPixeles(data: Uint8ClampedArray, width: number, height: number) {
  if (width < 1 || height < 1) return null;
  return jsQR(data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

export function decodificarImagen(imagen: HTMLImageElement) {
  const maxLado = 1800;
  const mayor = Math.max(imagen.naturalWidth, imagen.naturalHeight);
  const escala = mayor > maxLado ? maxLado / mayor : 1;
  const width = Math.max(1, Math.round(imagen.naturalWidth * escala));
  const height = Math.max(1, Math.round(imagen.naturalHeight * escala));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(imagen, 0, 0, width, height);
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
