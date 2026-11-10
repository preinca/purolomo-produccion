import type { Db } from "./db";
import { PRODUCTOS_MPC } from "./mpc";

/** Deja la tabla productos igual que la leyenda MPC del código (agrega los nuevos y actualiza los cambiados). */
export async function asegurarCatalogo(db: Db) {
  for (const producto of PRODUCTOS_MPC) {
    await db.run(
      `INSERT INTO productos (codigo, nombre, tipo, descripcion) VALUES (?, ?, ?, ?)
       ON CONFLICT (codigo) DO UPDATE SET nombre = excluded.nombre, tipo = excluded.tipo, descripcion = excluded.descripcion`,
      producto.codigo,
      producto.nombre,
      producto.tipo,
      producto.descripcion,
    );
  }
}
