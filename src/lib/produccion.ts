import type { DatabaseSync } from "node:sqlite";
import { fechaValida } from "@/lib/formato";
import { TURNOS, type Turno } from "@/lib/turnos";

export type Registro = {
  id: number;
  fecha: string;
  turno: Turno;
  linea: string;
  producto: string;
  cantidadKg: number;
  observaciones: string;
  creadoEn: string;
};

export type NuevoRegistro = Omit<Registro, "id" | "creadoEn">;

export type ResultadoValidacion =
  | { ok: true; value: NuevoRegistro }
  | { ok: false; error: string };

const TURNOS_VALIDOS = new Set<string>(TURNOS.map((turno) => turno.value));

export function validarRegistro(input: {
  fecha: string;
  turno: string;
  linea: string;
  producto: string;
  cantidad: string;
  observaciones: string;
}): ResultadoValidacion {
  const fecha = input.fecha.trim();
  const turno = input.turno.trim();
  const linea = input.linea.trim();
  const producto = input.producto.trim();
  const observaciones = input.observaciones.trim();
  const cantidad = Number(input.cantidad.trim().replace(",", "."));

  if (!fechaValida(fecha)) {
    return { ok: false, error: "Indica una fecha válida." };
  }
  if (!TURNOS_VALIDOS.has(turno)) {
    return { ok: false, error: "Elige el turno de mañana, tarde o noche." };
  }
  if (linea.length < 2 || linea.length > 80) {
    return { ok: false, error: "La línea debe tener entre 2 y 80 caracteres." };
  }
  if (producto.length < 2 || producto.length > 120) {
    return { ok: false, error: "El producto debe tener entre 2 y 120 caracteres." };
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 1_000_000) {
    return { ok: false, error: "La cantidad tiene que ser mayor que 0." };
  }
  if (observaciones.length > 500) {
    return { ok: false, error: "Las observaciones no pueden pasar de 500 caracteres." };
  }

  return {
    ok: true,
    value: {
      fecha,
      turno: turno as Turno,
      linea,
      producto,
      cantidadKg: Math.round(cantidad * 1000) / 1000,
      observaciones,
    },
  };
}

function fila(row: Record<string, string | number | bigint | null | Uint8Array>): Registro {
  return {
    id: Number(row.id),
    fecha: String(row.fecha),
    turno: String(row.turno) as Turno,
    linea: String(row.linea),
    producto: String(row.producto),
    cantidadKg: Number(row.cantidad_kg),
    observaciones: String(row.observaciones ?? ""),
    creadoEn: String(row.creado_en),
  };
}

export function insertarRegistro(db: DatabaseSync, registro: NuevoRegistro) {
  const result = db
    .prepare(
      `INSERT INTO registros_produccion
        (fecha, turno, linea, producto, cantidad_kg, observaciones)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      registro.fecha,
      registro.turno,
      registro.linea,
      registro.producto,
      registro.cantidadKg,
      registro.observaciones,
    );
  return Number(result.lastInsertRowid);
}

export function listarRegistros(db: DatabaseSync, fecha: string | null) {
  const rows = db
    .prepare(
      `SELECT id, fecha, turno, linea, producto, cantidad_kg, observaciones, creado_en
       FROM registros_produccion
       WHERE (? IS NULL OR fecha = ?)
       ORDER BY fecha DESC, id DESC
       LIMIT 200`,
    )
    .all(fecha, fecha);
  return rows.map(fila);
}

export function eliminarRegistro(db: DatabaseSync, id: number) {
  const result = db.prepare("DELETE FROM registros_produccion WHERE id = ?").run(id);
  return Number(result.changes) > 0;
}

export function resumir(registros: Registro[]) {
  const porTurno = { manana: 0, tarde: 0, noche: 0 };
  let totalKg = 0;
  for (const registro of registros) {
    totalKg += registro.cantidadKg;
    porTurno[registro.turno] += registro.cantidadKg;
  }
  return {
    totalKg: Math.round(totalKg * 1000) / 1000,
    cantidad: registros.length,
    porTurno,
  };
}
