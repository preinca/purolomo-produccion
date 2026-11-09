export function coincideBusqueda(consulta: string, partes: string[]) {
  const q = consulta.trim().toLowerCase().replace(/\s+/g, "");
  if (!q) return false;
  const texto = partes.join(" ").toLowerCase().replace(/\s+/g, "");
  if (texto.includes(q)) return true;
  const corto = q.match(/^(?:ml)?([0-9a-z]{1,4})$/);
  if (corto && texto.includes(`ml${corto[1].padStart(4, "0")}`)) return true;
  const numero = q.match(/^(?:ml)?(\d{1,6})$/);
  if (!numero) return false;
  return texto.includes(`ml${numero[1].padStart(6, "0")}`);
}
