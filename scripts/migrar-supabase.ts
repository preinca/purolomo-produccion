// Prepara la base de datos de Supabase para la prueba piloto.
//
//   npm run db:migrar
//
// 1. Crea las tablas (supabase/esquema.sql). Se puede volver a ejecutar sin perder datos.
// 2. Copia desde la base SQLite local SOLO: usuarios, catálogo de productos y recetas.
//    Lotes, movimientos, pesajes y mini lotes NO se copian: la piloto empieza en cero.
//
// Por seguridad no copia nada si Supabase ya tiene lotes, pesajes o movimientos.
// Lee DATABASE_URL de .env.local. La base local es data/produccion.sqlite (o SQLITE_PATH).
import fs from "node:fs";
import path from "node:path";
import { getDb, type Db } from "../src/lib/db";
import { asegurarCatalogo } from "../src/lib/seed";

type FilaSqlite = Record<string, unknown>;

async function abrirSqlite(archivo: string) {
  // node:sqlite viene con Node 22 (con --experimental-sqlite); así no hace falta better-sqlite3.
  const { DatabaseSync } = (await import("node:sqlite" as string)) as {
    DatabaseSync: new (ruta: string, opciones?: { readOnly?: boolean }) => {
      prepare(sql: string): { all(): FilaSqlite[] };
      close(): void;
    };
  };
  return new DatabaseSync(archivo, { readOnly: true });
}

function tieneTabla(sqlite: Awaited<ReturnType<typeof abrirSqlite>>, tabla: string) {
  return sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${tabla}'`).all().length > 0;
}

/** Devuelve el código de salida: 0 bien, 1 si no se copió nada por seguridad. */
export async function prepararSupabase(db: Db, archivo: string): Promise<number> {
  const esquema = fs.readFileSync(path.join(process.cwd(), "supabase", "esquema.sql"), "utf8");
  await db.exec(esquema);
  console.log("✓ Tablas creadas o ya existentes en Supabase.");

  const conteo = async (tabla: string) => Number((await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabla}`))?.n ?? 0);
  const ocupadas: string[] = [];
  for (const tabla of ["lotes", "movimientos", "pesajes", "minilotes"]) {
    if ((await conteo(tabla)) > 0) ocupadas.push(tabla);
  }
  if (ocupadas.length > 0) {
    console.log(`Supabase ya tiene datos de operación (${ocupadas.join(", ")}). No se copia nada para no mezclar.`);
    return 1;
  }

  await asegurarCatalogo(db);
  console.log(`✓ Catálogo MPC: ${await conteo("productos")} productos.`);

  if (!fs.existsSync(archivo)) {
    console.log(`No existe ${archivo}: no hay usuarios ni recetas que copiar.`);
    console.log("Supabase queda sin usuarios: el primer acceso a /entrar crea el administrador.");
    return 0;
  }
  const sqlite = await abrirSqlite(archivo);

  await db.transaction(async (tx) => {
    const usuarios = tieneTabla(sqlite, "usuarios") ? sqlite.prepare("SELECT * FROM usuarios ORDER BY id").all() : [];
    for (const u of usuarios) {
      await tx.run(
        `INSERT INTO usuarios (id, nombre, usuario, clave, rango, activo, creado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT DO NOTHING`,
        Number(u.id),
        String(u.nombre),
        String(u.usuario).toLowerCase(),
        String(u.clave),
        String(u.rango),
        Number(u.activo ?? 1),
        String(u.creado_en ?? new Date().toISOString()),
      );
    }

    const recetas = tieneTabla(sqlite, "recetas") ? sqlite.prepare("SELECT * FROM recetas ORDER BY id").all() : [];
    for (const r of recetas) {
      await tx.run(
        `INSERT INTO recetas (id, destino, linea, objetivo_kg, tolerancia_kg, minimo_kg, maximo_kg, creado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
        Number(r.id),
        String(r.destino),
        String(r.linea ?? "1"),
        Number(r.objetivo_kg),
        Number(r.tolerancia_kg),
        r.minimo_kg == null ? null : Number(r.minimo_kg),
        r.maximo_kg == null ? null : Number(r.maximo_kg),
        String(r.creado_en ?? new Date().toISOString()),
      );
    }

    const items = tieneTabla(sqlite, "receta_items") ? sqlite.prepare("SELECT * FROM receta_items ORDER BY id").all() : [];
    for (const i of items) {
      await tx.run(
        `INSERT INTO receta_items (id, receta_id, tipo, kg, tolerancia_kg, minimo_kg, maximo_kg)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT DO NOTHING`,
        Number(i.id),
        Number(i.receta_id),
        String(i.tipo),
        Number(i.kg),
        Number(i.tolerancia_kg ?? 15),
        i.minimo_kg == null ? null : Number(i.minimo_kg),
        i.maximo_kg == null ? null : Number(i.maximo_kg),
      );
    }

    // Los id copiados a mano no mueven el contador: se ajusta para que los nuevos sigan después.
    for (const tabla of ["usuarios", "recetas", "receta_items", "movimientos", "pesajes"]) {
      await tx.exec(
        `SELECT setval(pg_get_serial_sequence('${tabla}', 'id'), COALESCE((SELECT MAX(id) FROM ${tabla}), 0) + 1, false)`,
      );
    }
  });
  sqlite.close();

  console.log(`✓ Usuarios: ${await conteo("usuarios")}.`);
  console.log(`✓ Recetas: ${await conteo("recetas")} (con ${await conteo("receta_items")} materias primas).`);
  console.log("✓ Lotes, movimientos, pesajes y mini lotes: vacíos para empezar la prueba piloto.");
  return 0;
}

if (process.argv[1]?.includes("migrar-supabase")) {
  const archivo = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "produccion.sqlite");
  prepararSupabase(getDb(), archivo)
    .then((codigo) => process.exit(codigo))
    .catch((error) => {
      console.error("No se pudo preparar Supabase:", error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
