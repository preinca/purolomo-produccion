import assert from "node:assert/strict";
import test from "node:test";
import { basePrueba } from "./db-prueba.ts";
import { buscarLote, insertarRecepcion } from "./lotes.ts";
import { sufijoDeMiniLote, tokenDeSecuencia } from "./minilote.ts";
import { abrirPesaje, aportesDelTipo, buscarMiniLote, buscarPesaje, buscarPesajePorCodigo, codigoDePesaje, codigoDelPesaje, consumirEnPesaje, eliminarPesajeEnCurso, existenciasDeTipos, planillaDeProducto, quitarKgDePesaje, retirosDeTag, tagsDelTipo } from "./pesajes.ts";
import { leerConsumoQr, textoQr, textoQrMiniLote } from "./qr.ts";
import { excelDeReceta } from "./excel-receta.ts";
import { guardarReceta, eliminarReceta, interpretarFilasReceta, leerRecetaExcel, recetaVigente } from "./recetas.ts";

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
    minimoKg: 725,
    maximoKg: 755,
    items: receta.value.items,
  });
  const leida = leerRecetaExcel(archivo, "1");
  assert.equal(leida.ok, true);
  if (!leida.ok) return;
  assert.equal(leida.value.minimoKg, 725);
  assert.equal(leida.value.maximoKg, 755);
  assert.deepEqual(
    leida.value.items.map((item) => [item.tipo, item.kg, item.tolerancia, item.minimo, item.maximo]),
    [
      ["GL", 340, 20, 320, 360],
      ["CH", 240, 20, 220, 260],
      ["CHEXT", 150, 20, 130, 170],
    ],
  );
});

test("la fórmula usa el rango de cada producto y rechaza los kilos que se salen", () => {
  const fuera = interpretarFilasReceta([
    ["Producto", "ALIBAL 1 K", "Línea", "1", "Objetivo", 740],
    ["Tolerancia del pesaje", 50, "Mínimo", 675, "Máximo", 790],
    ["Tipo", "Kg", "Tolerancia", "Rango"],
    ["GL", 315, 50, "315 a 365 kg"],
    ["CH", 215, 50, "215 a 265 kg"],
    ["CHEXT", 145, 50, "145 a 195 kg"],
    ["TOTAL", 675, 50, "690 a 790 kg"],
  ]);
  assert.equal(fuera.ok, false);
  if (fuera.ok) return;
  assert.match(fuera.error, /690/);
  assert.match(fuera.error, /790/);

  const dentro = interpretarFilasReceta([
    ["Producto", "ALIBAL 1 K", "Línea", "1", "Objetivo", 740],
    ["Tolerancia del pesaje", 50, "Mínimo", 675, "Máximo", 790],
    ["Tipo", "Kg", "Tolerancia", "Rango"],
    ["GL", 340, 50, "315 a 365 kg"],
    ["CH", 240, 50, "215 a 265 kg"],
    ["CHEXT", 160, 50, "145 a 195 kg"],
    ["TOTAL", 740, 50, "690 a 790 kg"],
  ]);
  assert.equal(dentro.ok, true);
  if (!dentro.ok) return;
  assert.equal(dentro.value.minimoKg, 690);
  assert.equal(dentro.value.maximoKg, 790);
  assert.deepEqual(
    dentro.value.items.map((item) => [item.tipo, item.minimo, item.maximo]),
    [
      ["GL", 315, 365],
      ["CH", 215, 265],
      ["CHEXT", 145, 195],
    ],
  );
});

test("no carga kilos de salida fuera del rango de la fórmula", async () => {
  const db = await basePrueba();
  const receta = interpretarFilasReceta([
    ["Producto", "ALIBAL 1 K", "Línea", "1", "Objetivo", 740],
    ["Tolerancia del pesaje", 50],
    ["Tipo", "Kg", "Tolerancia", "Rango"],
    ["GL", 340, 50, "315 a 365 kg"],
    ["CH", 240, 50, "215 a 265 kg"],
    ["CHEXT", 160, 50, "145 a 195 kg"],
    ["TOTAL", 740, 50, "690 a 790 kg"],
  ]);
  assert.equal(receta.ok, true);
  if (!receta.ok) return;
  await guardarReceta(db, receta.value);
  assert.equal(
    (await insertarRecepcion(db, { fecha: "2026-11-12", tag: "5000101", codigo: "MPCM01045", kgRecibidos: 1000 })).ok,
    true,
  );
  const pesaje = await abrirPesaje(db, { fecha: "2026-11-12", numero: 1, linea: "1" });
  assert.equal(pesaje.ok, true);
  if (!pesaje.ok) return;

  const bajo = await consumirEnPesaje(db, { pesajeId: pesaje.value.id, tag: "5000101", kg: 100 });
  assert.equal(bajo.ok, false);
  const alto = await consumirEnPesaje(db, { pesajeId: pesaje.value.id, tag: "5000101", kg: 400 });
  assert.equal(alto.ok, false);
  const justo = await consumirEnPesaje(db, { pesajeId: pesaje.value.id, tag: "5000101", kg: 340 });
  assert.equal(justo.ok, true);

  const eliminado = await eliminarPesajeEnCurso(db, pesaje.value.id);
  assert.equal(eliminado.ok, true);
  assert.equal(await buscarPesaje(db, pesaje.value.id), null);
  assert.equal((await buscarLote(db, "5000101"))?.kgDespachados, 0);
  assert.equal((await db.get("SELECT token FROM minilotes WHERE pesaje_id = ?", pesaje.value.id)), undefined);

  const otra = await eliminarPesajeEnCurso(db, pesaje.value.id);
  assert.equal(otra.ok, false);
});

test("un tag corto entrega todo y el siguiente completa el promedio sin que el rango lo frene", async () => {
  const db = await basePrueba();
  const receta = interpretarFilasReceta([
    ["Producto", "ALIBAL 1 K", "Línea", "1", "Objetivo", 300],
    ["Tolerancia del pesaje", 20],
    ["Tipo", "Kg", "Tolerancia", "Rango"],
    ["GL", 300, 20, "280 a 320 kg"],
    ["TOTAL", 300, 20, "280 a 320 kg"],
  ]);
  assert.equal(receta.ok, true);
  if (!receta.ok) return;
  await guardarReceta(db, receta.value);
  assert.equal(
    (await insertarRecepcion(db, { fecha: "2026-11-12", tag: "5000201", codigo: "MPCM01045", kgRecibidos: 200 })).ok,
    true,
  );
  assert.equal(
    (await insertarRecepcion(db, { fecha: "2026-11-12", tag: "5000202", codigo: "MPCM01045", kgRecibidos: 1000 })).ok,
    true,
  );
  const pesaje = await abrirPesaje(db, { fecha: "2026-11-12", numero: 3, linea: "1" });
  assert.equal(pesaje.ok, true);
  if (!pesaje.ok) return;

  const corto = await consumirEnPesaje(db, { pesajeId: pesaje.value.id, tag: "5000201", kg: 200 });
  assert.equal(corto.ok, true);
  const resto = await consumirEnPesaje(db, { pesajeId: pesaje.value.id, tag: "5000202", kg: 100 });
  assert.equal(resto.ok, true);
  const deMas = await consumirEnPesaje(db, { pesajeId: pesaje.value.id, tag: "5000202", kg: 50 });
  assert.equal(deMas.ok, false);
});

test("un pesaje junta dos tags del mismo MPC y rechaza lo que no está en la receta", async () => {
  const db = await basePrueba();
  const receta = interpretarFilasReceta([
    ["GL", "340"],
    ["CH", "240"],
    ["CHEXT", "160"],
  ]);
  assert.equal(receta.ok, true);
  if (!receta.ok) return;
  await guardarReceta(db, receta.value);

  assert.equal(
    (await insertarRecepcion(db, { fecha: "2026-10-29", tag: "5000001", codigo: "MPCM01045", kgRecibidos: 200 })).ok,
    true,
  );
  assert.equal(
    (await insertarRecepcion(db, { fecha: "2026-10-29", tag: "5000002", codigo: "MPCM01045", kgRecibidos: 1000, destino: "ALIBAL 1 K" })).ok,
    true,
  );
  assert.equal(
    (await insertarRecepcion(db, { fecha: "2026-10-29", tag: "5000003", codigo: "MPCM01047", kgRecibidos: 1000, destino: "ALIBAL 1 K" })).ok,
    true,
  );

  const pesaje = await abrirPesaje(db, { fecha: "2026-10-29", numero: 2, linea: "1" });
  assert.equal(pesaje.ok, true);
  if (!pesaje.ok) return;

  const primero = await consumirEnPesaje(db, { pesajeId: pesaje.value.id, tag: "5000001", kg: 200 });
  assert.equal(primero.ok, true);
  if (!primero.ok) return;
  const segundo = await consumirEnPesaje(db, { pesajeId: pesaje.value.id, tag: "5000002", kg: 140 });
  assert.equal(segundo.ok, true);
  if (!segundo.ok) return;

  const paleta = await buscarLote(db, "5000001");
  assert.equal(paleta?.destino, "ALIBAL 1 K");
  const retiros = await retirosDeTag(db, "5000001");
  assert.equal(retiros[0]?.token, primero.value.token);
  assert.match(textoQr(paleta!, retiros), /Uso:ALIBAL 1 K/);
  assert.match(textoQr(paleta!, retiros), new RegExp(`Mini:${primero.value.token} 200 kg GL pesaje 2`));
  assert.match(textoQr(paleta!, retiros), /para ALIBAL 1 K/);
  assert.equal(retiros[0]?.destino, "ALIBAL 1 K");

  const tags = await tagsDelTipo(db, pesaje.value.id, "GL");
  assert.deepEqual(tags, ["5000001", "5000002"]);
  assert.equal((await planillaDeProducto(db, "ALIBAL 1 K")).filas.length, 0);
  const gl = await aportesDelTipo(db, pesaje.value.id, "GL");
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
  assert.equal(await codigoDelPesaje(db, pesaje.value.id), codigo);
  assert.equal((await buscarPesajePorCodigo(db, codigo))?.id, pesaje.value.id);
  assert.equal(await buscarPesajePorCodigo(db, "GLML999999-340"), null);
  assert.equal((await buscarMiniLote(db, primero.value.token.slice(2)))?.token, primero.value.token);
  const cava = await existenciasDeTipos(db, ["GL"]);
  assert.equal((await existenciasDeTipos(db, ["GL"])).find((item) => item.tag === "5000001"), undefined);
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

  const ajena = await consumirEnPesaje(db, { pesajeId: pesaje.value.id, tag: "5000003", kg: 10 });
  assert.equal(ajena.ok, false);

  const deMas = await consumirEnPesaje(db, { pesajeId: pesaje.value.id, tag: "5000001", kg: 200 });
  assert.equal(deMas.ok, false);

  const quitado = await quitarKgDePesaje(db, { pesajeId: pesaje.value.id, token: primero.value.token });
  assert.equal(quitado.ok, true);
  assert.equal((await buscarLote(db, "5000001"))?.kgDespachados, 0);
  assert.equal((await aportesDelTipo(db, pesaje.value.id, "GL")).some((aporte) => aporte.token === primero.value.token), false);
  assert.equal((await existenciasDeTipos(db, ["GL"])).find((item) => item.tag === "5000001")?.kg, 200);
});

test("no elimina la receta mientras su pesaje sigue en curso", async () => {
  const db = await basePrueba();
  const receta = interpretarFilasReceta([
    ["Tipo", "Kg"],
    ["GL", "340"],
    ["CH", "240"],
    ["CHEXT", "160"],
  ]);
  assert.equal(receta.ok, true);
  if (!receta.ok) return;
  await guardarReceta(db, receta.value);
  const pesaje = await abrirPesaje(db, { fecha: "2026-11-12", numero: 1, linea: "1" });
  assert.equal(pesaje.ok, true);
  if (!pesaje.ok) return;

  const bloqueada = await eliminarReceta(db, "1");
  assert.equal(bloqueada.ok, false);
  assert.ok(await recetaVigente(db, "1"));

  await db.run("UPDATE pesajes SET finalizado = 1 WHERE id = ?", pesaje.value.id);
  const quitada = await eliminarReceta(db, "1");
  assert.equal(quitada.ok, true);
  assert.equal(await recetaVigente(db, "1"), null);
  const guardada = await db.get<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM receta_items WHERE receta_id = ?",
    pesaje.value.recetaId,
  );
  assert.ok(Number(guardada?.n ?? 0) > 0);
});
