import { deflateSync } from "node:zlib";
import { encode } from "uqr";

/** PNG en blanco y negro del texto que va dentro del QR. */
export function pngQr(texto: string, pixel = 8) {
  const qr = encode(texto, { ecc: "M", border: 2 });
  const lado = qr.size * pixel;
  const crudo = Buffer.alloc((lado + 1) * lado);
  let offset = 0;
  for (let y = 0; y < lado; y++) {
    crudo[offset++] = 0;
    const fila = Math.floor(y / pixel);
    for (let x = 0; x < lado; x++) {
      const columna = Math.floor(x / pixel);
      crudo[offset++] = qr.data[fila]?.[columna] ? 0 : 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  const idat = deflateSync(crudo);
  const firma = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([firma, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function chunk(tipo: string, datos: Buffer) {
  const nombre = Buffer.from(tipo);
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([nombre, datos])));
  return Buffer.concat([largo, nombre, datos, crc]);
}

function crc32(datos: Buffer) {
  let crc = 0xffffffff;
  for (const byte of datos) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
