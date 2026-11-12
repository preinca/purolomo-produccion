import assert from "node:assert/strict";
import test from "node:test";
import { etiquetaDeLote } from "./etiqueta-cava.ts";
import type { Lote } from "./lotes.ts";
import { leerTextoQr, textoQrDeEtiqueta } from "./qr.ts";
import { zplDeEtiqueta } from "./zpl-etiqueta.ts";

const lote: Lote = {
  tag: "393710",
  fecha: "2026-11-10",
  semana: "SEMANA 46",
  codigo: "MPCM01047",
  producto: "CDM SP DD",
  kgRecibidos: 846,
  kgDespachados: 0,
  kgConsumidos: 0,
  estado: "RECIBIDO",
  observaciones: "",
  destino: "",
  creadoEn: "2026-11-10T14:45:40.000Z",
};

test("el zpl deja el tag y el qr en la etiqueta de la zebra", () => {
  const zpl = zplDeEtiqueta(etiquetaDeLote(lote), "PUROLOMO MPC\nTAG:393710");
  assert.match(zpl, /\^FDTAG 393710\^FS/);
  assert.match(zpl, /CDM SP DD/);
  assert.match(zpl, /MPCM01047/);
  assert.match(zpl, /846 kg/);
  assert.match(zpl, /10\/11\/2026/);
  assert.match(zpl, /Despresado/);
  assert.match(zpl, /deshuesado/);
  assert.match(zpl, /pollo/);
  assert.match(zpl, /\^PW456/);
  assert.match(zpl, /\^LL256/);
  assert.doesNotMatch(zpl, /\^BQ/);
  const modulos = [...zpl.matchAll(/\^FO(\d+),\d+\^GB(\d+),4,5/g)];
  assert.ok(modulos.length > 0);
  for (const modulo of modulos) {
    const x = Number(modulo[1]);
    const ancho = Number(modulo[2]);
    assert.ok(x >= 286);
    assert.ok(x + ancho <= 456);
    assert.equal(ancho % 3, 0);
  }
  assert.match(zpl, /\^FO8,24\^A0N,3[0-9],/);
  assert.equal(/^[\s\S]*\^A0N,1[0-9],/.test(zpl) || /\^A0N,2[0-9],/.test(zpl), true);
  assert.equal(zpl.includes("^"), true);
});

test("el qr de la etiqueta se reconoce aunque el celular junte el texto", () => {
  assert.equal(leerTextoQr(textoQrDeEtiqueta("393710"))?.tag, "393710");
  assert.equal(leerTextoQr("PUROLOMO MPC TAG:393710 Fecha:2026-11-10")?.tag, "393710");
  assert.equal(leerTextoQr("393710")?.tag, "393710");
  assert.equal(leerTextoQr("esto no es una paleta"), null);
});
