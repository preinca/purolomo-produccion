export function coincideBusqueda(consulta: string, partes: string[]) {
  const q = consulta.trim().toLowerCase().replace(/\s+/g, "");
  if (!q) return false;
  const texto = partes.join(" ").toLowerCase().replace(/\s+/g, "");
  if (texto.includes(q)) return true;
  const numero = q.match(/^(?:ml)?(\d+)$/);
  if (!numero) return false;
  return texto.includes(`ml${numero[1].padStart(6, "0")}`);
}
