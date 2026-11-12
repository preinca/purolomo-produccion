import postgres from "postgres";

export type Fila = Record<string, unknown>;

/**
 * Acceso a la base de datos (Postgres en Supabase).
 * Las consultas se escriben con `?` como en la versión SQLite; se convierten a $1, $2...
 */
export interface Db {
  get<T = Fila>(sql: string, ...params: unknown[]): Promise<T | undefined>;
  all<T = Fila>(sql: string, ...params: unknown[]): Promise<T[]>;
  /** Ejecuta INSERT/UPDATE/DELETE y devuelve cuántas filas cambiaron. */
  run(sql: string, ...params: unknown[]): Promise<number>;
  exec(sql: string): Promise<void>;
  /** Ejecuta `fn` dentro de una transacción. Dentro de otra transacción reutiliza la misma. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}

/** Cambia los `?` fuera de comillas simples por $1, $2... */
export function aPostgres(sql: string) {
  let salida = "";
  let n = 0;
  let enTexto = false;
  for (const caracter of sql) {
    if (caracter === "'") enTexto = !enTexto;
    if (caracter === "?" && !enTexto) {
      n += 1;
      salida += `$${n}`;
    } else {
      salida += caracter;
    }
  }
  return salida;
}

export { arregloPg } from "./arreglo-pg";

/** Lo que necesita `crearDb` de una conexión: consultas con parámetros y SQL de varias sentencias. */
export type Conexion = {
  consultar: (texto: string, params: unknown[]) => Promise<{ filas: Fila[]; cambios: number }>;
  ejecutar: (texto: string) => Promise<void>;
};

export function crearDb(
  conexion: Conexion,
  transaccion: (fn: (conexionTx: Conexion) => Promise<unknown>) => Promise<unknown>,
  dentroDeTransaccion = false,
): Db {
  const db: Db = {
    async get<T>(sql: string, ...params: unknown[]) {
      const { filas } = await conexion.consultar(aPostgres(sql), params);
      return filas[0] as T | undefined;
    },
    async all<T>(sql: string, ...params: unknown[]) {
      const { filas } = await conexion.consultar(aPostgres(sql), params);
      return filas as T[];
    },
    async run(sql: string, ...params: unknown[]) {
      const { cambios } = await conexion.consultar(aPostgres(sql), params);
      return cambios;
    },
    async exec(sql: string) {
      await conexion.ejecutar(sql);
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      if (dentroDeTransaccion) return fn(db);
      return (await transaccion((conexionTx) => fn(crearDb(conexionTx, transaccion, true)))) as T;
    },
  };
  return db;
}

type ClientePostgres = ReturnType<typeof postgres>;

/** Deja pasar como mucho `limite` tareas a la vez; las demás esperan su turno en orden. */
export function crearTurnos(limite: number) {
  let enCurso = 0;
  const cola: (() => void)[] = [];
  return async function conTurno<T>(tarea: () => Promise<T>): Promise<T> {
    if (enCurso >= limite) await new Promise<void>((avisar) => cola.push(avisar));
    else enCurso += 1;
    try {
      return await tarea();
    } finally {
      const siguiente = cola.shift();
      if (siguiente) siguiente();
      else enCurso -= 1;
    }
  };
}

/**
 * El driver, cuando hay más consultas que conexiones, envía varias seguidas por la misma
 * conexión (pipelining). El pooler de Supabase en modo transacción deja colgadas las consultas
 * sin parámetros enviadas así: la página se quedaba en blanco. Para que nunca ocurra, aquí
 * nunca hay más consultas en marcha que conexiones, y dentro de una transacción van de una en una.
 */
function dbDesdePostgres(cliente: ClientePostgres, conexiones: number): Db {
  const turnoGeneral = crearTurnos(conexiones);
  const sobre = (sql: ClientePostgres | postgres.TransactionSql, turno: ReturnType<typeof crearTurnos>): Conexion => ({
    consultar: (texto, params) =>
      turno(async () => {
        const resultado = await sql.unsafe(texto, params as postgres.ParameterOrJSON<never>[]);
        return { filas: [...resultado] as Fila[], cambios: resultado.count ?? 0 };
      }),
    ejecutar: (texto) =>
      turno(async () => {
        // Protocolo simple: admite varias sentencias seguidas (el esquema completo, por ejemplo).
        await sql.unsafe(texto).simple();
      }),
  });
  return crearDb(sobre(cliente, turnoGeneral), (fn) =>
    // La transacción ocupa una conexión (un turno) mientras dura.
    turnoGeneral(() => cliente.begin((tx) => fn(sobre(tx, crearTurnos(1)))) as Promise<unknown>),
  );
}

const globalParaDb = globalThis as unknown as { purolomoDb?: Db };

export function urlBaseDatos() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL: la cadena de conexión de Supabase (botón Connect > Transaction pooler).",
    );
  }
  return url;
}

export function getDb(): Db {
  if (!globalParaDb.purolomoDb) {
    // En Vercel cada instancia es corta: una sola conexión evita saturar el pooler.
    const conexiones = Math.max(1, process.env.VERCEL ? 1 : Number(process.env.DB_MAX_CONEXIONES ?? 3));
    const cliente = postgres(urlBaseDatos(), {
      // El pooler de Supabase en modo transacción no admite sentencias preparadas.
      prepare: false,
      max: conexiones,
      idle_timeout: 20,
      max_lifetime: 60 * 10,
      connect_timeout: 10,
      ssl: /localhost|127\.0\.0\.1/.test(urlBaseDatos()) ? false : "require",
    });
    globalParaDb.purolomoDb = dbDesdePostgres(cliente, conexiones);
  }
  return globalParaDb.purolomoDb;
}
