/** Lista como literal de arreglo de Postgres, para usar con `= ANY(?::int[])` o `= ANY(?::text[])`. */
export function arregloPg(valores: (string | number)[]) {
  const partes = valores.map((valor) =>
    typeof valor === "number" ? String(valor) : `"${String(valor).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
  );
  return `{${partes.join(",")}}`;
}
