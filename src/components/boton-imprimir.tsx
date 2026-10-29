"use client";

import { Button } from "@/components/ui/button";

export function BotonImprimir({ etiqueta = "Imprimir etiquetas" }: { etiqueta?: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      {etiqueta}
    </Button>
  );
}
