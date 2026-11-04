// Respaldo TEMPORAL para la demostración en Render.
// SQLite sigue siendo la base de datos; Supabase Storage solo guarda una copia
// del archivo .sqlite para que los datos sobrevivan a los reinicios de Render.
// Si SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están definidas, no hace nada.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SqliteDb } from "./db";

// Acepta también la URL con /rest/v1 que muestra la página "Data API" de Supabase.
const URL_SUPABASE = (process.env.SUPABASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/(rest|storage)\/v1$/, "");
const CLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BUCKET = process.env.SUPABASE_BUCKET || "demo-sqlite";
const OBJETO = process.env.SUPABASE_OBJETO || "produccion.sqlite";
const INTERVALO_MS = 15_000;

const estado = globalThis as unknown as {
  respaldoListo?: boolean;
  respaldoSubiendo?: boolean;
  respaldoUltimosCambios?: number;
};

export function respaldoActivo() {
  return Boolean(URL_SUPABASE && CLAVE);
}

function cabeceras(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${CLAVE}`, apikey: CLAVE, ...extra };
}

async function asegurarBucket() {
  const res = await fetch(`${URL_SUPABASE}/storage/v1/bucket`, {
    method: "POST",
    headers: cabeceras({ "Content-Type": "application/json" }),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  });
  if (res.ok) console.log(`[respaldo] Bucket "${BUCKET}" creado en Supabase.`);
}

/**
 * Descarga la copia desde Supabase y la deja en `archivo` antes de abrir SQLite.
 * Devuelve true si es seguro empezar a subir respaldos (se restauró la copia
 * o se confirmó que todavía no existe). Si Supabase falla, devuelve false para
 * no pisar la copia buena con una base vacía.
 */
export async function restaurarDesdeSupabase(archivo: string): Promise<boolean> {
  await asegurarBucket().catch(() => undefined);

  for (let intento = 1; intento <= 3; intento++) {
    try {
      const res = await fetch(`${URL_SUPABASE}/storage/v1/object/${BUCKET}/${OBJETO}`, {
        headers: cabeceras(),
        cache: "no-store",
      });
      if (res.ok) {
        const datos = Buffer.from(await res.arrayBuffer());
        fs.mkdirSync(path.dirname(archivo), { recursive: true });
        for (const extra of ["-wal", "-shm"]) fs.rmSync(archivo + extra, { force: true });
        fs.writeFileSync(archivo, datos);
        console.log(`[respaldo] Base restaurada desde Supabase (${(datos.length / 1024).toFixed(0)} KB).`);
        return true;
      }
      const texto = await res.text();
      if (res.status === 404 || /not.?found/i.test(texto)) {
        console.log("[respaldo] Todavía no hay copia en Supabase; se empieza con la base local.");
        return true;
      }
      console.error(`[respaldo] Supabase respondió ${res.status}: ${texto}`);
    } catch (error) {
      console.error(`[respaldo] Error descargando la copia (intento ${intento}):`, error);
    }
    await new Promise((r) => setTimeout(r, 2000 * intento));
  }
  console.error("[respaldo] No se pudo descargar la copia. Los respaldos quedan DESACTIVADOS para no sobrescribirla.");
  return false;
}

function cambiosTotales(db: SqliteDb) {
  return Number((db.prepare("SELECT total_changes() AS n").get() as { n: number }).n);
}

export async function subirASupabase(db: SqliteDb, forzar = false) {
  if (!estado.respaldoListo || estado.respaldoSubiendo) return;
  const cambios = cambiosTotales(db);
  if (!forzar && cambios === estado.respaldoUltimosCambios) return;

  estado.respaldoSubiendo = true;
  const temporal = path.join(os.tmpdir(), `respaldo-${process.pid}-${Date.now()}.sqlite`);
  try {
    await db.backup(temporal);
    const datos = fs.readFileSync(temporal);
    const res = await fetch(`${URL_SUPABASE}/storage/v1/object/${BUCKET}/${OBJETO}`, {
      method: "POST",
      headers: cabeceras({ "Content-Type": "application/octet-stream", "x-upsert": "true" }),
      body: datos,
    });
    if (!res.ok) throw new Error(`Supabase respondió ${res.status}: ${await res.text()}`);
    estado.respaldoUltimosCambios = cambios;
    console.log(`[respaldo] Copia subida a Supabase (${(datos.length / 1024).toFixed(0)} KB).`);
  } catch (error) {
    console.error("[respaldo] No se pudo subir la copia:", error);
  } finally {
    fs.rmSync(temporal, { force: true });
    estado.respaldoSubiendo = false;
  }
}

export function iniciarRespaldoPeriodico(db: SqliteDb, puedeSubir: boolean) {
  estado.respaldoListo = puedeSubir;
  estado.respaldoUltimosCambios = cambiosTotales(db);
  if (!puedeSubir) return;

  const temporizador = setInterval(() => void subirASupabase(db), INTERVALO_MS);
  temporizador.unref();

  // Render envía SIGTERM al redesplegar o al dormir el servicio: último intento.
  process.once("SIGTERM", () => void subirASupabase(db));
  console.log(`[respaldo] Respaldo a Supabase activo cada ${INTERVALO_MS / 1000} s (bucket "${BUCKET}").`);
}
