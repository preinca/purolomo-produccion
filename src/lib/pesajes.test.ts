import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { abrirBase } from "./db.ts";
import { buscarLote, insertarRecepcion } from "./lotes.ts";
import { abrirPesaje, buscarMiniLote, buscarPesajePorCodigo, codigoDePesaje, codigoDelPesaje, consumirEnPesaje, existenciasDeTipos, planillaDeProducto, retirosDeTag, tagsDelTipo } from "./pesajes.ts";
import { leerConsumoQr, textoQr, textoQrMiniLote } from "./qr.ts";
import { excelDeReceta } from "./excel-receta.ts";
import { guardarReceta, interpretarFilasReceta, leerRecetaExcel } from "./recetas.ts";

function baseTemporal() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "purolomo-pesaje-"));
  const db = abrirBase(path.join(dir, "produccion.sqlite"));
  return { dir, db };
}

test("acepta una receta de Alibal 1 kg entre 725 y 755 kg", () => {
  const valida = interpretarFilasReceta([
    ["Tipo", "Kg"],
    ["GL", "340"],
    ["CH", "240"],
    ["CHEXT", "150"],
  ]);
  assert.equal(valida.ok, true);
  assert.equal(interpretarFilasReceta([["GL", "725"]]).ok, true);
  assert.equal(interpretarFilasReceta([["GL", "755"]]).ok, true);
  assert.equal(interpretarFilasReceta([["GL", "724"]]).ok, false);
  assert.equal(interpretarFilasReceta([["GL", "756"]]).ok, false);
  const alta = interpretarFilasReceta([
    ["GL", "800"],
  ]);
  assert.equal(alta.ok, false);
  const rara = interpretarFilasReceta([
    ["GL", "340"],
    ["NOEXISTE", "400"],
  ]);
  assert.equal(rara.ok, false);
  const linea2 = interpretarFilasReceta(
    [
      ["Tipo", "Kg"],
      ["GL", "680"],
      ["CH", "480"],
      ["CHEXT", "300"],
    ],
    "2",
  );
  assert.equal(linea2.ok, true);
  const linea2Corta = interpretarFilasReceta(
    [
      ["GL", "340"],
      ["CH", "240"],
      ["CHEXT", "150"],
    ],
    "2",
  );
  assert.equal(linea2Corta.ok, false);
});

test("el excel descargado de la receta se puede volver a cargar", () => {
  const receta = interpretarFilasReceta([
    ["Tipo", "Kg"],
    ["GL", "340"],
    ["CH", "240"],
    ["CHEXT", "150"],
  ]);
  assert.equal(receta.ok, true);
  if (!receta.ok) return;
  const archivo = excelDeReceta({
    id: 1,
    destino: "ALIBAL 1 K",
    linea: "1",
    objetivoKg: 730,
    toleranciaKg: 15,
    items: receta.value,
  });
  const leida = leerRecetaExcel(archivo, "1");
  assert.equal(leida.ok, true);
  if (!leida.ok) return;
  assert.deepEqual(leida.value, receta.value);
});

test("un pesaje junta dos tags del mismo MPC y rechaza lo que no está en la receta", () => {
  const { dir, db } = baseTemporal();
  const receta = interpretarFilasReceta([
    ["GL", "340"],
    ["CH", "240"],
    ["CHEXT", "160"],
  ]);
  assert.equal(receta.ok, true);
  if (!receta.ok) return;
  guardarReceta(db, receta.value);

  assert.equal(
    insertarRecepcion(db, { fecha: "2026-10-29", tag: "5000001", codigo: "MPCM01045", kgRecibidos: 1000 }).ok,
    true,
  );
  assert.equal(
    insertarRecepcion(db, { fecha: "2026-10-29", tag: "5000002", codigo: "MPCM01045", kgRecibidos: 1000, destino: "ALIBAL 1 K" }).ok,
    true,
  );
  assert.equal(
    insertarRecepcion(db, { fecha: "2026-10-29", tag: "5000003", codigo: "MPCM01047", kgRecibidos: 1000, destino: "ALIBAL 1 K" }).ok,
    true,
  );

  const pesaje = abrirPesaje(db, { fecha: "2026-10-29", numero: 2, linea: "1" });
  assert.equal(pesaje.ok, true);
  if (!pesaje.ok) return;

  const primero = consumirEnPesaje(db, { pesajeId: pesaje.value.id, tag: "5000001", kg: 200 });
  assert.equal(primero.ok, true);
  if (!primero.ok) return;
  const segundo = consumirEnPesaje(db, { pesajeId: pesaje.value.id, tag: "5000002", kg: 140 });
  assert.equal(segundo.ok, true);
  if (!segundo.ok) return;

  const paleta = buscarLote(db, "5000001");
  assert.equal(paleta?.destino, "ALIBAL 1 K");
  const retiros = retirosDeTag(db, "5000001");
  assert.equal(retiros[0]?.token, primero.value.token);
  assert.match(textoQr(paleta!, retiros), /Uso:ALIBAL 1 K/);
  assert.match(textoQr(paleta!, retiros), new RegExp(`Mini:${primero.value.token} 200 kg GL pesaje 2`));
  assert.match(textoQr(paleta!, retiros), /para ALIBAL 1 K/);
  assert.equal(retiros[0]?.destino, "ALIBAL 1 K");

  const tags = tagsDelTipo(db, pesaje.value.id, "GL");
  assert.deepEqual(tags, ["5000001", "5000002"]);
  const gl = planillaDeProducto(db, "ALIBAL 1 K").filas[0]?.celdas.find((celda) => celda.tipo === "GL");
  assert.deepEqual(
    gl?.aportes.map((aporte) => aporte.tag),
    ["5000001", "5000002"],
  );
  assert.equal(gl?.aportes[0]?.token, primero.value.token);
  assert.equal(gl?.aportes[0]?.kg, 200);
  assert.equal(gl?.aportes[1]?.token, segundo.value.token);
  assert.equal(gl?.aportes[1]?.kg, 140);
  assert.equal(gl?.kg, 340);
  assert.equal(
    codigoDePesaje(
      [
        { tipo: "GL", token: "ML000001" },
        { tipo: "CH", token: "ML000002" },
        { tipo: "CH", token: "ML000003" },
        { tipo: "CHEXT", token: "ML000004" },
      ],
      730,
    ),
    "GLML000001-CHML000002-CHML000003-CHEXTML000004-730",
  );
  const codigo = `GL${primero.value.token}-GL${segundo.value.token}-340`;
  assert.equal(codigoDelPesaje(db, pesaje.value.id), codigo);
  assert.equal(buscarPesajePorCodigo(db, codigo)?.id, pesaje.value.id);
  assert.equal(buscarPesajePorCodigo(db, "GLML999999-340"), null);
  assert.equal(buscarMiniLote(db, primero.value.token.slice(2))?.token, primero.value.token);
  const cava = existenciasDeTipos(db, ["GL"]);
  assert.ok(cava.some((item) => item.tag === "5000001" && item.kg === 800));
  assert.ok(cava.some((item) => item.tag === "5000002" && item.kg === 860));
  const texto = textoQrMiniLote({
    token: segundo.value.token,
    pesaje: 2,
    destino: "ALIBAL 1 K",
    linea: "1",
    tipo: "GL",
    kg: 140,
    tag: "5000002",
    tags,
  });
  assert.match(texto, /PESAJE:2/);
  assert.match(texto, /TAGS:5000001,5000002/);
  assert.equal(leerConsumoQr(texto)?.token, segundo.value.token);

  const ajena = consumirEnPesaje(db, { pesajeId: pesaje.value.id, tag: "5000003", kg: 10 });
  assert.equal(ajena.ok, false);

  const deMas = consumirEnPesaje(db, { pesajeId: pesaje.value.id, tag: "5000001", kg: 200 });
  assert.equal(deMas.ok, false);

  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
