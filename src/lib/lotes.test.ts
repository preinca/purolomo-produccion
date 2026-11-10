import assert from "node:assert/strict";
import test from "node:test";
import { basePrueba } from "./db-prueba.ts";
import { semanaDe } from "./formato.ts";
import {
  buscarLote,
  eliminarLote,
  insertarRecepcion,
  kgRestantes,
  registrarConsumo,
  registrarDespacho,
  resumir,
  siguienteTag,
  validarRecepcion,
} from "./lotes.ts";
import { pngQr } from "./png-qr.ts";
import { leerTextoQr, textoQr } from "./qr.ts";

test("la semana ISO del 21 de octubre 2026 es 43", () => {
  assert.equal(semanaDe("2026-10-21"), "SEMANA 43");
});

test("arranca sin lotes hasta que el operador registre entradas", async () => {
  const db = await basePrueba();
  const lotes = Number((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM lotes"))?.n);
  assert.equal(lotes, 0);
  const resumen = await resumir(db);
  assert.equal(resumen.paletas, 0);
});

test("registra una recepción, genera QR y mueve kilos", async () => {
  const db = await basePrueba();
  const tag = await siguienteTag(db);
  const validado = validarRecepcion({
    fecha: "2026-10-26",
    tag,
    codigo: "MPCM01047",
    cantidad: "860,5",
    destino: "PDM 1K",
  });
  assert.equal(validado.ok, true);
  if (!validado.ok) return;

  const creado = await insertarRecepcion(db, validado.value);
  assert.equal(creado.ok, true);
  if (!creado.ok) return;
  assert.equal(creado.value.semana, "SEMANA 44");
  assert.equal(creado.value.producto, "CDM SP DD");
  assert.equal(creado.value.kgRecibidos, 860.5);
  assert.equal(creado.value.destino, "PDM 1K");

  const qr = textoQr(creado.value);
  assert.match(qr, new RegExp(`TAG:${tag}`));
  assert.match(qr, /Codigo:MPCM01047/);
  assert.match(qr, /Kg rec:860.5/);
  assert.match(qr, /Uso:PDM 1K/);
  assert.equal(leerTextoQr(qr)?.tag, tag);
  assert.equal(leerTextoQr(qr)?.codigo, "MPCM01047");
  const png = pngQr(qr);
  assert.equal(png[0], 137);
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");

  assert.equal(
    (await registrarDespacho(db, { tag, fecha: "2026-10-26", kg: 200, destino: "PDM 1K", linea: "1" })).ok,
    true,
  );
  assert.equal(
    (await registrarConsumo(db, { tag, fecha: "2026-10-26", kg: 100 })).ok,
    true,
  );
  const lote = await buscarLote(db, tag);
  assert.equal(lote?.kgDespachados, 200);
  assert.equal(lote?.kgConsumidos, 100);
  assert.equal(kgRestantes(lote!), 560.5);
  const qrActualizado = textoQr(lote!);
  assert.match(qrActualizado, /Kg consumidos:300/);
  assert.match(qrActualizado, /Kg disponibles:560.5/);
  assert.equal(
    (await registrarDespacho(db, { tag, fecha: "2026-10-26", kg: 560.5, destino: "PDM 1K", linea: "1" })).ok,
    true,
  );
  const agotado = await buscarLote(db, tag);
  assert.ok(agotado);
  assert.match(textoQr(agotado!), /Kg disponibles:0/);
  assert.match(textoQr(agotado!), /Se acabaron todos los kg de esta materia prima/);

  const extra = await registrarDespacho(db, {
    tag,
    fecha: "2026-10-26",
    kg: 99999,
    destino: "PDM 1K",
    linea: "1",
  });
  assert.equal(extra.ok, false);

  const resumen = await resumir(db);
  assert.ok(resumen.paletas >= 1);
});

test("elimina un lote y sus movimientos", async () => {
  const db = await basePrueba();
  const tag = "9100001";
  const creado = await insertarRecepcion(db, {
    fecha: "2026-10-26",
    tag,
    codigo: "MPCM01043",
    kgRecibidos: 12,
  });
  assert.equal(creado.ok, true);

  const borrado = await eliminarLote(db, tag);
  assert.equal(borrado.ok, true);
  assert.equal(await buscarLote(db, tag), null);
  const movimientos = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM movimientos WHERE tag = ?", tag);
  assert.equal(Number(movimientos?.n), 0);

  const ausente = await eliminarLote(db, tag);
  assert.equal(ausente.ok, false);
});

test("rechaza TAG duplicado y producto desconocido", async () => {
  const db = await basePrueba();
  const tag = "9000001";
  const primera = await insertarRecepcion(db, {
    fecha: "2026-10-26",
    tag,
    codigo: "MPCM01043",
    kgRecibidos: 10,
  });
  assert.equal(primera.ok, true);
  const dup = await insertarRecepcion(db, {
    fecha: "2026-10-26",
    tag,
    codigo: "MPCM01043",
    kgRecibidos: 10,
  });
  assert.equal(dup.ok, false);

  const malo = validarRecepcion({
    fecha: "2026-10-26",
    tag: "12",
    codigo: "NOEXISTE",
    cantidad: "10",
    destino: "PDM 1K",
  });
  assert.equal(malo.ok, false);
});

test("la salida respeta la capacidad de la línea", async () => {
  const db = await basePrueba();
  const tag = "9200001";
  const creado = await insertarRecepcion(db, {
    fecha: "2026-10-26",
    tag,
    codigo: "MPCM01043",
    kgRecibidos: 4000,
  });
  assert.equal(creado.ok, true);

  const linea1 = await registrarDespacho(db, {
    tag,
    fecha: "2026-10-26",
    kg: 1801,
    destino: "BOLOGNA",
    linea: "1",
  });
  assert.equal(linea1.ok, false);

  const linea2 = await registrarDespacho(db, {
    tag,
    fecha: "2026-10-26",
    kg: 3600,
    destino: "PDM 3 KG",
    linea: "2",
  });
  assert.equal(linea2.ok, true);
  const lote = await buscarLote(db, tag);
  assert.equal(lote?.kgDespachados, 3600);
  assert.equal(lote?.destino, "PDM 3 KG");
  assert.match(textoQr(lote!), /Uso:PDM 3 KG/);
});
