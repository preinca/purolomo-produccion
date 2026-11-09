import assert from "node:assert/strict";
import test from "node:test";
import { etiquetaDeLote, pieEtiqueta } from "./etiqueta-cava.ts";
import type { Lote } from "./lotes.ts";
import { pdfDeEtiqueta } from "./pdf-etiqueta.ts";
import { textoQr } from "./qr.ts";

const lote: Lote = {
  tag: "400123",
  fecha: "2026-11-05",
  semana: "SEMANA 45",
  codigo: "MPCM01042",
  producto: "CDM SP CH",
  kgRecibidos: 756,
  kgDespachados: 0,
  kgConsumidos: 0,
  estado: "RECIBIDO",
  observaciones: "",
  destino: "",
  creadoEn: "2026-11-05T17:52:08.000Z",
};

test("la etiqueta usa la fecha, la hora de Caracas y el catálogo", () => {
  const etiqueta = etiquetaDeLote(lote);
  assert.equal(etiqueta.fecha, "05/11/2026");
  assert.equal(etiqueta.hora, "13:52:08");
  assert.equal(etiqueta.producto, "CDM SP CH");
  assert.equal(etiqueta.descripcion, "Carapacho de pollo");
  assert.equal(etiqueta.tipo, "CH");
  assert.equal(etiqueta.codigo, "MPCM01042");
  assert.equal(etiqueta.kgRecibidos, "756 kg");
});

test("el pdf de la etiqueta trae el QR dibujado y la fecha de recepción", () => {
  const etiqueta = etiquetaDeLote(lote);
  assert.equal(pieEtiqueta(etiqueta.fecha), "CODIGO 22 - PRF - 012 - FECHA EMISION = 05/11/2026");
  const pdf = pdfDeEtiqueta(etiqueta, textoQr(lote));
  const texto = pdf.toString("latin1");
  assert.match(texto, /MediaBox \[0 0 161\.57 90\.71\]/);
  assert.equal(texto.startsWith("%PDF-1.4"), true);
  assert.equal(texto.trimEnd().endsWith("%%EOF"), true);
  assert.match(texto, /400123/);
  assert.match(texto, /MPCM01042/);
  assert.match(texto, /756 kg/);
  assert.match(texto, /05\/11\/2026/);
  assert.match(texto, /13:52:08/);
  assert.match(texto, /CODIGO 22 - PRF - 012 - FECHA EMISION = 05\/11\/2026/);
  assert.equal(texto.includes("N EMISION"), false);
  assert.equal(texto.includes("PAG 1 DE 1"), false);
  assert.ok(texto.split(" re f").length > 30);
});
