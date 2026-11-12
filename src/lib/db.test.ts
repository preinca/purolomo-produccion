import assert from "node:assert/strict";
import test from "node:test";
import { aPostgres, crearTurnos } from "./db.ts";

test("convierte los ? en $1, $2... sin tocar los que van entre comillas", () => {
  assert.equal(aPostgres("SELECT * FROM lotes WHERE tag = ? AND nota = '¿?' AND kg > ?"), "SELECT * FROM lotes WHERE tag = $1 AND nota = '¿?' AND kg > $2");
});

test("los turnos nunca dejan más tareas en marcha que conexiones", async () => {
  for (const limite of [1, 3]) {
    const conTurno = crearTurnos(limite);
    let enMarcha = 0;
    let maximo = 0;
    const tareas = Array.from({ length: 12 }, (_, i) =>
      conTurno(async () => {
        enMarcha += 1;
        maximo = Math.max(maximo, enMarcha);
        await new Promise((r) => setTimeout(r, 5 + (i % 3)));
        enMarcha -= 1;
        return i;
      }),
    );
    assert.deepEqual(await Promise.all(tareas), Array.from({ length: 12 }, (_, i) => i));
    assert.equal(maximo, limite);
  }
});

test("un error en una tarea libera su turno", async () => {
  const conTurno = crearTurnos(1);
  await assert.rejects(conTurno(async () => Promise.reject(new Error("falla"))));
  assert.equal(await conTurno(async () => "sigue"), "sigue");
});
