import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { abrirBase } from "./db.ts";
import { buscarLote, insertarRecepcion } from "./lotes.ts";
import { sufijoDeMiniLote, tokenDeSecuencia } from "./minilote.ts";
import { abrirPesaje, aportesDelTipo, buscarMiniLote, buscarPesajePorCodigo, codigoDePesaje, codigoDelPesaje, consumirEnPesaje, existenciasDeTipos, planillaDeProducto, quitarKgDePesaje, retirosDeTag, tagsDelTipo } from "./pesajes.ts";
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

test("el excel descargado de la receta se puede volver a cargar", async () => {
  const receta = interpretarFilasReceta([
    ["Tipo", "Kg"],
    ["GL", "340"],
    ["CH", "240"],
    ["CHEXT", "150"],
  ]);
  assert.equal(receta.ok, true);
  if (!receta.ok) return;
  const archivo = await excelDeReceta({
    id: 1,
    destino: "ALIBAL 1 K",
    linea: "1",
    objetivoKg: 730,
    toleranciaKg: 15,
    items: receta.value.items,
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
  assert.equal(planillaDeProducto(db, "ALIBAL 1 K").filas.length, 0);
  const gl = aportesDelTipo(db, pesaje.value.id, "GL");
  assert.deepEqual(
    gl.map((aporte) => aporte.tag),
    ["5000001", "5000002"],
  );
  assert.equal(gl[0]?.token, primero.value.token);
  assert.equal(gl[0]?.kg, 200);
  assert.equal(gl[1]?.token, segundo.value.token);
  assert.equal(gl[1]?.kg, 140);
  assert.equal(gl.reduce((suma, aporte) => suma + aporte.kg, 0), 340);
  assert.equal(
    codigoDePesaje(
      { numero: 1, linea: "1" },
      [
        { tipo: "GL", token: "ML000001" },
        { tipo: "CH", token: "ML000002" },
        { tipo: "CHEXT", token: "ML000004" },
      ],
    ),
    "1L1-GL01-CH02-CHEXT04",
  );
  assert.equal(tokenDeSecuencia(100), "ML002S");
  assert.equal(sufijoDeMiniLote("ML002S"), "2S");
  assert.equal(codigoDePesaje({ numero: 1, linea: "1" }, [{ tipo: "GL", token: "ML002S" }]), "1L1-GL2S");
  const corto = (token: string) => sufijoDeMiniLote(token);
  const codigo = `2L1-GL${corto(primero.value.token)}-GL${corto(segundo.value.token)}`;
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

  const quitado = quitarKgDePesaje(db, { pesajeId: pesaje.value.id, token: primero.value.token });
  assert.equal(quitado.ok, true);
  assert.equal(buscarLote(db, "5000001")?.kgDespachados, 0);
  assert.equal(aportesDelTipo(db, pesaje.value.id, "GL").some((aporte) => aporte.token === primero.value.token), false);
  assert.equal(existenciasDeTipos(db, ["GL"]).find((item) => item.tag === "5000001")?.kg, 1000);

  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
