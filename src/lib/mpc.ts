export type ProductoMpc = {
  codigo: string;
  nombre: string;
  tipo: string;
  descripcion: string;
};

/** Leyenda de materia prima cárnica usada en recepción (CDM / MPC). */
export const PRODUCTOS_MPC: ProductoMpc[] = [
  { codigo: "MPCM01041", nombre: "CDM SP Z", tipo: "Z", descripcion: "Pollo tipo pequeño" },
  { codigo: "MPCM01043", nombre: "CDM SP C", tipo: "C", descripcion: "Cuello de pollo" },
  { codigo: "MPCM01040", nombre: "CDM SP BF", tipo: "BF", descripcion: "Pollo tipo B fresco" },
  { codigo: "MPCM01042", nombre: "CDM SP CH", tipo: "CH", descripcion: "Carapacho de pollo" },
  { codigo: "MPCM01047", nombre: "CDM SP DD", tipo: "DD", descripcion: "Despresado deshuesado de pollo" },
  { codigo: "MPCM01044", nombre: "CDM SP GP", tipo: "GP", descripcion: "Gallina pesada" },
  { codigo: "MPCM01045", nombre: "CDM SP GL", tipo: "GL", descripcion: "Gallina ligera" },
  { codigo: "MPCM01096", nombre: "CDM IMP", tipo: "IMP", descripcion: "CDM importado" },
  { codigo: "PTCM01500", nombre: "CDM Pechuga de Pollo", tipo: "PCH", descripcion: "Pechuga de pollo" },
  { codigo: "PTCM01403", nombre: "Molleja de Pollo", tipo: "MOL", descripcion: "Molleja de pollo" },
  { codigo: "PTCM01402", nombre: "Hígado De Pollo", tipo: "H", descripcion: "Hígado de pollo" },
  { codigo: "PTCM02318", nombre: "Tocino de Cerdo S/P", tipo: "TCN", descripcion: "Tocino de cerdo sin piel" },
  { codigo: "PTCM02424", nombre: "Recorte de Tocineta", tipo: "RT", descripcion: "Recorte de tocineta" },
  { codigo: "PTCM02407", nombre: "Recorte Rojo", tipo: "RR", descripcion: "Recorte rojo" },
  { codigo: "PTCM02411", nombre: "Recorte #2", tipo: "R#2", descripcion: "Recorte #2" },
  { codigo: "PTCM02412", nombre: "Recorte de teta", tipo: "RTT", descripcion: "Recorte de teta" },
  { codigo: "PTCM02402", nombre: "Cuero PP", tipo: "CPP", descripcion: "Cuero PP" },
  { codigo: "MPCM03001", nombre: "Cachete de Res", tipo: "CCT", descripcion: "Cachete de res" },
  { codigo: "MPCM01058", nombre: "Muslo", tipo: "MU", descripcion: "Muslo / pollo beneficiado" },
  { codigo: "MPCM01173", nombre: "Emulsion de tocino", tipo: "ET", descripcion: "Emulsión de tocino" },
  { codigo: "MPCM01154", nombre: "Reproceso de jamones", tipo: "RJ", descripcion: "Reproceso de jamones" },
  { codigo: "MPCM01155", nombre: "Reproceso de Aves", tipo: "RA", descripcion: "Reproceso de aves" },
  { codigo: "MPCM01157", nombre: "MTD EXTRA", tipo: "MTD", descripcion: "Mortadela extra" },
];

export const ESTADOS_LOTE = [
  "PENDIENTE POR TRANSFERIR",
  "TRANSFIRIO",
  "RECIBIDO",
  "CONSUMIDOS",
  "DEVUELTO",
] as const;

export type EstadoLote = (typeof ESTADOS_LOTE)[number];

const porCodigo = new Map(PRODUCTOS_MPC.map((p) => [p.codigo, p]));
const porNombre = new Map(PRODUCTOS_MPC.map((p) => [p.nombre.toLowerCase(), p]));

export function productoPorCodigo(codigo: string) {
  return porCodigo.get(codigo.trim()) ?? null;
}

export function productoPorNombre(nombre: string) {
  return porNombre.get(nombre.trim().toLowerCase()) ?? null;
}

export function etiquetaTipo(producto: ProductoMpc) {
  return `${producto.tipo} · ${producto.descripcion}`;
}
