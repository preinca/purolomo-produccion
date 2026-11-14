import assert from "node:assert/strict";
import test from "node:test";
import { pdfRegistroEntradas } from "./pdf-entradas.ts";

test("el pdf de entradas lleva el día, el tag y el total recibido", () => {
  const pdf = pdfRegistroEntradas({
    fecha: "2026-11-13",
    producto: "CDM SP CH EXTERNO",
    filas: [
      {
        fecha: "2026-11-13",
        hora: "09:04",
        tag: "400038",
        producto: "Recorte Rojo",
        codigo: "PTCM02407",
        kg: 1000,
        destino: "",
        observaciones: "",
      },
    ],
  });
  const texto = pdf.toString("latin1");
  assert.match(texto, /^%PDF-1\.4/);
  assert.match(texto, /REGISTRO DE ENTRADA/);
  assert.match(texto, /400038/);
  assert.match(texto, /PTCM02407/);
  assert.match(texto, /RECEPCIONISTA/);
  assert.match(texto, /SUPERVISOR/);
  assert.match(texto, /Kg totales recibidos/);
});
