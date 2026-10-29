"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col justify-center gap-4 px-6 py-16">
      <p className="text-xs font-medium tracking-wide text-primary uppercase">Purolomo</p>
      <h1 className="text-2xl font-semibold">No se pudo abrir la base</h1>
      <p className="text-sm text-muted-foreground">
        SQLite no respondió. Revisa que la carpeta del proyecto se pueda escribir y
        vuelve a intentar.
      </p>
      <p className="text-sm text-destructive">{error.message}</p>
      <Button type="button" onClick={reset} className="w-fit">
        Reintentar
      </Button>
    </main>
  );
}
