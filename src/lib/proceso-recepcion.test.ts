import assert from "node:assert/strict";
import test from "node:test";
import { basePrueba } from "./db-prueba.ts";
import { encolarEtiquetasDelProceso } from "./impresion.ts";
import { insertarRecepcion } from "./lotes.ts";
import {
  asignarAlProceso,
  eliminarEntradaEnCurso,
  eliminarEntradaPorImprimir,
  guardarEtiquetasDelProceso,
  eliminarEntradasPorImprimir,
  iniciarProceso,
  procesoAbierto,
  procesosPorImprimir,
  reiniciarCarga,
  terminarProceso,
} from "./proceso-recepcion.ts";

test("el proceso junta las entradas y al terminar solo imprime esas etiquetas", async () => {
  const db = await basePrueba();
  assert.equal(await procesoAbierto(db), null);

  const iniciado = await iniciarProceso(db);
  assert.equal(iniciado.ok, true);
  if (!iniciado.ok) return;
  const repetido = await iniciarProceso(db);
  assert.equal(repetido.ok, false);

  const primera = await insertarRecepcion(db, {
    fecha: "2026-11-11",
    tag: "400010",
    codigo: "MPCM01042",
    kgRecibidos: 1000,
    semana: "SEMANA 46",
  });
  const segunda = await insertarRecepcion(db, {
    fecha: "2026-11-11",
    tag: "400011",
    codigo: "MPCM01047",
    kgRecibidos: 846,
    semana: "SEMANA 46",
  });
  const ajena = await insertarRecepcion(db, {
    fecha: "2026-11-11",
    tag: "400012",
    codigo: "MPCM01045",
    kgRecibidos: 500,
    semana: "SEMANA 46",
  });
  assert.equal(primera.ok && segunda.ok && ajena.ok, true);
  await asignarAlProceso(db, "400010", iniciado.value);
  await asignarAlProceso(db, "400011", iniciado.value);

  const abierto = await procesoAbierto(db);
  assert.equal(abierto?.entradas, 2);

  const cerrado = await terminarProceso(db);
  assert.equal(cerrado.ok, true);
  if (!cerrado.ok) return;
  assert.equal(cerrado.value.entradas, 2);
  assert.equal(await procesoAbierto(db), null);

  const pendientes = await procesosPorImprimir(db);
  assert.deepEqual(pendientes, [{ id: cerrado.value.id, entradas: 2 }]);

  const enviado = await encolarEtiquetasDelProceso(db, cerrado.value.id);
  assert.equal(enviado.ok, true);
  if (!enviado.ok) return;
  assert.equal(enviado.value, 2);
  assert.deepEqual(await procesosPorImprimir(db), []);

  const ajenaImpresa = await db.get<{ impresa_en: string }>("SELECT impresa_en FROM lotes WHERE tag = '400012'");
  assert.equal(ajenaImpresa?.impresa_en, "");
});

test("reiniciar la carga quita solo las entradas del proceso abierto", async () => {
  const db = await basePrueba();
  const iniciado = await iniciarProceso(db);
  assert.equal(iniciado.ok, true);
  if (!iniciado.ok) return;
  assert.equal((await insertarRecepcion(db, { fecha: "2026-11-11", tag: "400020", codigo: "MPCM01042", kgRecibidos: 100, semana: "SEMANA 46" })).ok, true);
  await asignarAlProceso(db, "400020", iniciado.value);
  assert.equal((await insertarRecepcion(db, { fecha: "2026-11-11", tag: "400021", codigo: "MPCM01045", kgRecibidos: 80, semana: "SEMANA 46" })).ok, true);

  const reinicio = await reiniciarCarga(db);
  assert.equal(reinicio.ok, true);
  if (!reinicio.ok) return;
  assert.equal(reinicio.value, 1);
  assert.equal(await db.get("SELECT tag FROM lotes WHERE tag = '400020'"), undefined);
  assert.equal((await db.get<{ tag: string }>("SELECT tag FROM lotes WHERE tag = '400021'"))?.tag, "400021");
  const abierto = await procesoAbierto(db);
  assert.equal(abierto?.id, iniciado.value);
  assert.equal(abierto?.entradas, 0);
  const repetido = await iniciarProceso(db);
  assert.equal(repetido.ok, false);
});

test("eliminar una etiqueta del proceso abierto deja las demás y el proceso sigue abierto", async () => {
  const db = await basePrueba();
  const iniciado = await iniciarProceso(db);
  assert.equal(iniciado.ok, true);
  if (!iniciado.ok) return;
  assert.equal((await insertarRecepcion(db, { fecha: "2026-11-11", tag: "400040", codigo: "MPCM01042", kgRecibidos: 100, semana: "SEMANA 46" })).ok, true);
  assert.equal((await insertarRecepcion(db, { fecha: "2026-11-11", tag: "400041", codigo: "MPCM01047", kgRecibidos: 90, semana: "SEMANA 46" })).ok, true);
  assert.equal((await insertarRecepcion(db, { fecha: "2026-11-11", tag: "400042", codigo: "MPCM01045", kgRecibidos: 80, semana: "SEMANA 46" })).ok, true);
  await asignarAlProceso(db, "400040", iniciado.value);
  await asignarAlProceso(db, "400041", iniciado.value);

  const quitada = await eliminarEntradaEnCurso(db, "400040");
  assert.equal(quitada.ok, true);
  assert.equal(await db.get("SELECT tag FROM lotes WHERE tag = '400040'"), undefined);
  assert.equal((await db.get<{ tag: string }>("SELECT tag FROM lotes WHERE tag = '400041'"))?.tag, "400041");
  assert.equal((await db.get<{ tag: string }>("SELECT tag FROM lotes WHERE tag = '400042'"))?.tag, "400042");
  const abierto = await procesoAbierto(db);
  assert.equal(abierto?.id, iniciado.value);
  assert.equal(abierto?.entradas, 1);
});

test("guardar las etiquetas las deja en el almacén y no las manda a imprimir", async () => {
  const db = await basePrueba();
  const iniciado = await iniciarProceso(db);
  assert.equal(iniciado.ok, true);
  if (!iniciado.ok) return;
  assert.equal((await insertarRecepcion(db, { fecha: "2026-11-12", tag: "400050", codigo: "MPCM01042", kgRecibidos: 100, semana: "SEMANA 46" })).ok, true);
  assert.equal((await insertarRecepcion(db, { fecha: "2026-11-12", tag: "400051", codigo: "MPCM01047", kgRecibidos: 90, semana: "SEMANA 46" })).ok, true);
  await asignarAlProceso(db, "400050", iniciado.value);
  await asignarAlProceso(db, "400051", iniciado.value);
  const cerrado = await terminarProceso(db);
  assert.equal(cerrado.ok, true);
  if (!cerrado.ok) return;

  const guardadas = await guardarEtiquetasDelProceso(db, cerrado.value.id);
  assert.equal(guardadas.ok, true);
  if (!guardadas.ok) return;
  assert.equal(guardadas.value, 2);
  assert.equal((await db.get<{ impresa_en: string }>("SELECT impresa_en FROM lotes WHERE tag = '400050'"))?.impresa_en, "guardada");
  assert.equal((await db.get<{ tag: string }>("SELECT tag FROM lotes WHERE tag = '400051'"))?.tag, "400051");
  assert.deepEqual(await procesosPorImprimir(db), []);

  const enviado = await encolarEtiquetasDelProceso(db, cerrado.value.id);
  assert.equal(enviado.ok, false);
});

test("eliminar una etiqueta lista para imprimir deja las demás", async () => {
  const db = await basePrueba();
  const iniciado = await iniciarProceso(db);
  assert.equal(iniciado.ok, true);
  if (!iniciado.ok) return;
  assert.equal((await insertarRecepcion(db, { fecha: "2026-11-11", tag: "400030", codigo: "MPCM01042", kgRecibidos: 100, semana: "SEMANA 46" })).ok, true);
  assert.equal((await insertarRecepcion(db, { fecha: "2026-11-11", tag: "400031", codigo: "MPCM01047", kgRecibidos: 90, semana: "SEMANA 46" })).ok, true);
  await asignarAlProceso(db, "400030", iniciado.value);
  await asignarAlProceso(db, "400031", iniciado.value);
  const cerrado = await terminarProceso(db);
  assert.equal(cerrado.ok, true);
  if (!cerrado.ok) return;

  const quitada = await eliminarEntradaPorImprimir(db, cerrado.value.id, "400030");
  assert.equal(quitada.ok, true);
  assert.equal(await db.get("SELECT tag FROM lotes WHERE tag = '400030'"), undefined);
  const pendientes = await procesosPorImprimir(db);
  assert.deepEqual(pendientes, [{ id: cerrado.value.id, entradas: 1 }]);

  const todas = await eliminarEntradasPorImprimir(db, cerrado.value.id, "todas");
  assert.equal(todas.ok, true);
  if (!todas.ok) return;
  assert.equal(todas.value, 1);
  assert.deepEqual(await procesosPorImprimir(db), []);
});
