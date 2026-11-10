import type { Db } from "./db";

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

/** Siguiente código de mini lote. El contador sube en una sola sentencia, así dos pesajes a la vez no repiten código. */
export async function siguienteToken(db: Db) {
  const fila = await db.get<{ valor: string }>(
    `INSERT INTO app_meta (clave, valor) VALUES ('minilote_seq', '1')
     ON CONFLICT (clave) DO UPDATE SET valor = (app_meta.valor::integer + 1)::text
     RETURNING valor`,
  );
  return tokenDeSecuencia(Number(fila?.valor ?? 1));
}
