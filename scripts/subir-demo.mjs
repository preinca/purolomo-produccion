// Sube la base SQLite LOCAL a Supabase Storage para la demostración en Render.
// Uso: npm run demo:subir   (lee las variables de .env.local)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const url = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const bucket = process.env.SUPABASE_BUCKET || "demo-sqlite";
const objeto = process.env.SUPABASE_OBJETO || "produccion.sqlite";
const archivo = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "produccion.sqlite");

if (!url || !clave) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (ponlas en .env.local).");
  process.exit(1);
}
if (!fs.existsSync(archivo)) {
  console.error(`No existe la base local: ${archivo}`);
  process.exit(1);
}

const cabeceras = { Authorization: `Bearer ${clave}`, apikey: clave };

await fetch(`${url}/storage/v1/bucket`, {
  method: "POST",
  headers: { ...cabeceras, "Content-Type": "application/json" },
  body: JSON.stringify({ id: bucket, name: bucket, public: false }),
}).catch(() => undefined);

// backup() incluye lo que todavía esté en el archivo -wal.
const temporal = path.join(os.tmpdir(), `subir-demo-${Date.now()}.sqlite`);
const db = new Database(archivo, { readonly: true });
await db.backup(temporal);
db.close();

const datos = fs.readFileSync(temporal);
fs.rmSync(temporal, { force: true });

const res = await fetch(`${url}/storage/v1/object/${bucket}/${objeto}`, {
  method: "POST",
  headers: { ...cabeceras, "Content-Type": "application/octet-stream", "x-upsert": "true" },
  body: datos,
});
if (!res.ok) {
  console.error(`Supabase respondió ${res.status}: ${await res.text()}`);
  process.exit(1);
}
console.log(`Listo: ${archivo} (${(datos.length / 1024).toFixed(0)} KB) subido a ${bucket}/${objeto}.`);
console.log("Reinicia el servicio en Render para que cargue esta copia.");
