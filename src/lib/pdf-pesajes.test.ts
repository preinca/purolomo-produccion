import assert from "node:assert/strict";
import test from "node:test";
import { formatoFecha, formatoKg } from "./formato.ts";
import { pdfRegistroPesajes } from "./pdf-pesajes.ts";

test("el pdf repite el título y cada dato de la fila", () => {
  const pdf = pdfRegistroPesajes({
    fecha: "2026-11-05",
    tipos: ["GL", "CH"],
    filas: [
      {
        numero: 4,
        fecha: "2026-11-05",
        linea: "1",
        destino: "ALIBAL 1 K",
        codigo: "4L1-GL01-CH02",
        observaciones: "Listo para cava",
        total: 740,
        celdas: [
          {
            tipo: "GL",
            kg: 400,
            aportes: [
              { tag: "400111", token: "ML000001", kg: 250 },
              { tag: "400112", token: "ML000002", kg: 150 },
            ],
          },
          {
            tipo: "CH",
            kg: 340,
            aportes: [{ tag: "400220", token: "ML000004", kg: 340 }],
          },
        ],
      },
    ],
  });
  const texto = pdf.toString("latin1");
  assert.match(texto, /PUROLOMO/);
  assert.match(texto, /PLANTA CAGUA/);
  assert.match(texto, /REGISTRO DE PESAJES/);
  assert.match(texto, /2026/);
  assert.match(texto, new RegExp(formatoFecha("2026-11-05").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[áéíóúñ]/gi, ".")));
  assert.match(texto, /4L1-GL01-CH02/);
  assert.match(texto, /ALIBAL 1 K/);
  assert.match(texto, /Listo para cava/);
  assert.match(texto, /TAG 400111/);
  assert.match(texto, /Mini lote ML000001/);
  assert.match(texto, /TAG 400220/);
  assert.match(texto, /Mini lote ML000004/);
  assert.match(texto, /Suma GL/);
  assert.match(texto, /Kg totales consumidos/);
  assert.match(texto, new RegExp(formatoKg(740).replace(" kg", " kg")));
  assert.match(texto, /PESADOR/);
  assert.match(texto, /SUPERVISOR/);
  assert.equal(texto.includes("PLANTA EMBUTIDOS"), false);
});
