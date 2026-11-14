import assert from "node:assert/strict";
import test from "node:test";
import { puedeEntrar } from "./acceso.ts";
import { claveValida, hashClave } from "./claves.ts";
import { firmarSesion, leerFirma } from "./firma.ts";

test("consulta entra a pesajes y consultas, y no a entradas ni usuarios", () => {
  assert.equal(puedeEntrar("consulta", "/salidas"), false);
  assert.equal(puedeEntrar("consulta", "/entradas"), false);
  assert.equal(puedeEntrar("consulta", "/stock"), true);
  assert.equal(puedeEntrar("consulta", "/minilotes"), true);
  assert.equal(puedeEntrar("consulta", "/pesajes"), true);
  assert.equal(puedeEntrar("consulta", "/registro-entrada"), true);
  assert.equal(puedeEntrar("pesador", "/registro-entrada/pdf"), true);
  assert.equal(puedeEntrar("consulta", "/lote/400001"), true);
  assert.equal(puedeEntrar("consulta", "/qr/imagen/400001"), true);
  assert.equal(puedeEntrar("consulta", "/usuarios"), false);
  assert.equal(puedeEntrar("consulta", "/qr"), true);
  assert.equal(puedeEntrar("administrador", "/usuarios"), true);
  assert.equal(puedeEntrar("recepcionista", "/entradas"), true);
  assert.equal(puedeEntrar("recepcionista", "/salidas"), false);
  assert.equal(puedeEntrar("recepcionista", "/pesajes"), true);
  assert.equal(puedeEntrar("pesador", "/salidas"), true);
  assert.equal(puedeEntrar("pesador", "/entradas"), false);
  assert.equal(puedeEntrar("pesador", "/stock"), true);
});

test("la clave y la sesión firmada se pueden comprobar", () => {
  const guardada = hashClave("cagua");
  assert.equal(claveValida("cagua", guardada), true);
  assert.equal(claveValida("otra", guardada), false);
  const token = firmarSesion({
    id: 1,
    usuario: "admin",
    nombre: "Planta",
    rango: "administrador",
    exp: Date.now() + 1000,
  });
  assert.equal(leerFirma(token)?.usuario, "admin");
  assert.equal(leerFirma(`${token}x`), null);
});
