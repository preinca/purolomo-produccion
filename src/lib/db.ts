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

function dbDesdePostgres(cliente: ClientePostgres): Db {
  const sobre = (sql: ClientePostgres | postgres.TransactionSql): Conexion => ({
    async consultar(texto, params) {
      const resultado = await sql.unsafe(texto, params as postgres.ParameterOrJSON<never>[]);
      return { filas: [...resultado] as Fila[], cambios: resultado.count ?? 0 };
    },
    async ejecutar(texto) {
      // Protocolo simple: admite varias sentencias seguidas (el esquema completo, por ejemplo).
      await sql.unsafe(texto).simple();
    },
  });
  return crearDb(sobre(cliente), (fn) => cliente.begin((tx) => fn(sobre(tx))) as Promise<unknown>);
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
    const cliente = postgres(urlBaseDatos(), {
      // El pooler de Supabase en modo transacción no admite sentencias preparadas.
      prepare: false,
      max: Number(process.env.DB_MAX_CONEXIONES ?? 5),
      idle_timeout: 20,
      connect_timeout: 15,
      ssl: /localhost|127\.0\.0\.1/.test(urlBaseDatos()) ? false : "require",
    });
    globalParaDb.purolomoDb = dbDesdePostgres(cliente);
  }
  return globalParaDb.purolomoDb;
}
