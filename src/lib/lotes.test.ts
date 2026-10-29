import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { abrirBase } from "./db.ts";
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
  transferirLote,
  validarRecepcion,
} from "./lotes.ts";
import { pngQr } from "./png-qr.ts";
import { leerTextoQr, textoQr } from "./qr.ts";

function baseTemporal() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "purolomo-mpc-"));
  const db = abrirBase(path.join(dir, "produccion.sqlite"));
  return { dir, db };
}

test("la semana ISO del 21 de octubre 2026 es 43", () => {
  assert.equal(semanaDe("2026-10-21"), "SEMANA 43");
});

test("carga el catálogo MPC y, con SEED_LOTES_CDM=1, los lotes del CDM", () => {
  const prev = process.env.SEED_LOTES_CDM;
  process.env.SEED_LOTES_CDM = "1";
  try {
    const { dir, db } = baseTemporal();
    const productos = Number(db.prepare("SELECT COUNT(*) AS n FROM productos").get()?.n);
    const lotes = Number(db.prepare("SELECT COUNT(*) AS n FROM lotes").get()?.n);
    assert.ok(productos >= 20);
    assert.ok(lotes >= 20);
    const muestra = buscarLote(db, "382513");
    assert.equal(muestra?.producto, "CDM SP C");
    assert.equal(muestra?.codigo, "MPCM01043");
    assert.equal(muestra?.estado, "PENDIENTE POR TRANSFERIR");
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  } finally {
    if (prev === undefined) delete process.env.SEED_LOTES_CDM;
    else process.env.SEED_LOTES_CDM = prev;
  }
});

test("arranca sin lotes hasta que el operador registre entradas", () => {
  const { dir, db } = baseTemporal();
  const lotes = Number(db.prepare("SELECT COUNT(*) AS n FROM lotes").get()?.n);
  assert.equal(lotes, 0);
  const resumen = resumir(db);
  assert.equal(resumen.paletas, 0);
  assert.equal(resumen.pendientes, 0);
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("registra una recepción, genera QR y mueve kilos", () => {
  const { dir, db } = baseTemporal();
  const tag = siguienteTag(db);
  const validado = validarRecepcion({
    fecha: "2026-10-26",
    tag,
    codigo: "MPCM01047",
    cantidad: "860,5",
  });
  assert.equal(validado.ok, true);
  if (!validado.ok) return;

  const creado = insertarRecepcion(db, validado.value);
  assert.equal(creado.ok, true);
  if (!creado.ok) return;
  assert.equal(creado.value.semana, "SEMANA 44");
  assert.equal(creado.value.producto, "CDM SP DD");
  assert.equal(creado.value.kgRecibidos, 860.5);

  const qr = textoQr(creado.value);
  assert.match(qr, new RegExp(`TAG:${tag}`));
  assert.match(qr, /Codigo:MPCM01047/);
  assert.match(qr, /Kg rec:860.5/);
  assert.equal(leerTextoQr(qr)?.tag, tag);
  assert.equal(leerTextoQr(qr)?.codigo, "MPCM01047");
  const png = pngQr(qr);
  assert.equal(png[0], 137);
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");

  assert.equal(transferirLote(db, tag, "2026-10-26").ok, true);
  assert.equal(
    registrarDespacho(db, { tag, fecha: "2026-10-26", kg: 200 }).ok,
    true,
  );
  assert.equal(
    registrarConsumo(db, { tag, fecha: "2026-10-26", kg: 100 }).ok,
    true,
  );
  const lote = buscarLote(db, tag);
  assert.equal(lote?.kgDespachados, 200);
  assert.equal(lote?.kgConsumidos, 100);
  assert.equal(kgRestantes(lote!), 560.5);

  const extra = registrarDespacho(db, { tag, fecha: "2026-10-26", kg: 99999 });
  assert.equal(extra.ok, false);

  const resumen = resumir(db);
  assert.ok(resumen.paletas >= 1);
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("elimina un lote y sus movimientos", () => {
  const { dir, db } = baseTemporal();
  const tag = "9100001";
  const creado = insertarRecepcion(db, {
    fecha: "2026-10-26",
    tag,
    codigo: "MPCM01043",
    kgRecibidos: 12,
  });
  assert.equal(creado.ok, true);

  const borrado = eliminarLote(db, tag);
  assert.equal(borrado.ok, true);
  assert.equal(buscarLote(db, tag), null);
  const movimientos = db.prepare("SELECT COUNT(*) AS n FROM movimientos WHERE tag = ?").get(tag) as
    | { n: number }
    | undefined;
  assert.equal(Number(movimientos?.n), 0);

  const ausente = eliminarLote(db, tag);
  assert.equal(ausente.ok, false);

  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("rechaza TAG duplicado y producto desconocido", () => {
  const { dir, db } = baseTemporal();
  const tag = "9000001";
  const primera = insertarRecepcion(db, {
    fecha: "2026-10-26",
    tag,
    codigo: "MPCM01043",
    kgRecibidos: 10,
  });
  assert.equal(primera.ok, true);
  const dup = insertarRecepcion(db, {
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
  });
  assert.equal(malo.ok, false);
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
