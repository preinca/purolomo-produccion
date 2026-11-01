"use client";

export function CampoFiltro({
  etiqueta,
  placeholder,
  valor,
  alCambiar,
  mono = false,
}: {
  etiqueta: string;
  placeholder: string;
  valor: string;
  alCambiar: (valor: string) => void;
  mono?: boolean;
}) {
  return (
    <label className="grid min-w-0 flex-1 gap-1.5 text-sm font-medium">
      {etiqueta}
      <input
        value={valor}
        placeholder={placeholder}
        onChange={(evento) => alCambiar(evento.target.value)}
        className={`h-8 rounded-lg border border-input bg-card px-2.5 text-sm font-normal ${mono ? "font-mono" : ""}`}
      />
    </label>
  );
}
