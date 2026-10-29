import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col justify-center gap-3 px-6">
      <p className="text-xs font-semibold tracking-wide text-primary uppercase">Purolomo</p>
      <h1 className="text-2xl font-semibold">No está esa paleta</h1>
      <p className="text-sm text-muted-foreground">
        El TAG no aparece en SQLite. Revisa el número o registra la entrada.
      </p>
      <Link href="/entradas" className="text-sm font-medium text-primary hover:underline">
        Registrar entrada
      </Link>
    </main>
  );
}
