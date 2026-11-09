import type { SqliteDb } from "./db";

const ALFABETO = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Código del mini lote: ML y cuatro caracteres en base 36. El 100 queda ML002S, no ML000100. */
export function tokenDeSecuencia(n: number) {
  let resto = Math.max(0, Math.floor(n));
  let cuerpo = "";
  for (let i = 0; i < 4; i += 1) {
    cuerpo = ALFABETO[resto % 36] + cuerpo;
    resto = Math.floor(resto / 36);
  }
  return `ML${cuerpo}`;
}

export function secuenciaDeToken(token: string) {
  const texto = token.trim().toUpperCase();
  const viejo = texto.match(/^ML(\d{6})$/);
  if (viejo) return Number(viejo[1]);
  const nuevo = texto.match(/^ML([0-9A-Z]{4})$/);
  if (!nuevo) return 0;
  let valor = 0;
  for (const caracter of nuevo[1]) {
    const indice = ALFABETO.indexOf(caracter);
    if (indice < 0) return 0;
    valor = valor * 36 + indice;
  }
  return valor;
}

/** Los dos últimos caracteres del mini lote, que identifican el pesaje. */
export function sufijoDeMiniLote(token: string) {
  const cuerpo = token.toUpperCase().replace(/^ML/, "").replace(/[^0-9A-Z]/g, "");
  if (!cuerpo) return "";
  return cuerpo.slice(-2).padStart(2, "0");
}

export function normalizarToken(valor: string) {
  const texto = valor.trim().toUpperCase().replace(/\s+/g, "");
  if (/^ML\d{6}$/.test(texto) || /^ML[0-9A-Z]{4}$/.test(texto)) return texto;
  if (/^\d{5,6}$/.test(texto)) return `ML${texto.padStart(6, "0")}`;
  if (/^[0-9A-Z]{1,4}$/.test(texto)) return `ML${texto.padStart(4, "0")}`;
  return texto;
}

export function siguienteToken(db: SqliteDb) {
  db.exec("CREATE TABLE IF NOT EXISTS app_meta (clave TEXT PRIMARY KEY, valor TEXT NOT NULL)");
  const guardado = db.prepare("SELECT valor FROM app_meta WHERE clave = 'minilote_seq'").get() as
    | { valor: string }
    | undefined;
  let seq = Number(guardado?.valor ?? 0);
  if (!Number.isFinite(seq) || seq < 0) seq = 0;
  const filas = db.prepare("SELECT token FROM minilotes").all() as { token: string }[];
  for (const fila of filas) seq = Math.max(seq, secuenciaDeToken(fila.token));
  const siguiente = seq + 1;
  db.prepare(
    "INSERT INTO app_meta (clave, valor) VALUES ('minilote_seq', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
  ).run(String(siguiente));
  return tokenDeSecuencia(siguiente);
}
