import assert from "node:assert/strict";
import test from "node:test";
import { etiquetaDeLote } from "./etiqueta-cava.ts";
import type { Lote } from "./lotes.ts";
import { nlblDeEtiqueta, xmlDeEtiqueta } from "./nlbl-etiqueta.ts";
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

test("el nlbl de la etiqueta usa la plantilla de Zebra y los datos del lote", () => {
  const etiqueta = etiquetaDeLote(lote);
  const archivo = nlblDeEtiqueta(etiqueta, textoQr(lote));
  assert.equal(archivo.subarray(0, 2).toString(), "PK");
  const xml = xmlDeEtiqueta(archivo);
  assert.match(xml, /ZDesigner ZD220-203dpi ZPL/);
  assert.match(xml, /<Width>104000<\/Width>/);
  assert.match(xml, /400123/);
  assert.match(xml, /CDM SP CH/);
  assert.match(xml, /MPCM01042/);
  assert.match(xml, /756 kg/);
  assert.match(xml, /05\/11\/2026/);
  assert.match(xml, /13:52:08/);
  assert.match(xml, /BarcodeDocumentItem/);
  assert.equal(xml.includes("CODIGO 22"), false);
});
