// Se ejecuta una vez al arrancar el servidor, antes de atender peticiones.
// Solo sirve para el respaldo temporal de la demostración en Supabase.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const respaldo = await import("./lib/respaldo-supabase");
  if (!respaldo.respaldoActivo()) return;

  const { getDb, rutaBaseDatos } = await import("./lib/db");
  const puedeSubir = await respaldo.restaurarDesdeSupabase(rutaBaseDatos());
  respaldo.iniciarRespaldoPeriodico(getDb(), puedeSubir);
}
