import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Hello World",
  description: "Página de Hello World hecha con Next.js.",
};

export default function HelloPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <section className="w-full max-w-xl rounded-xl bg-card px-6 py-10 text-center ring-1 ring-foreground/10 sm:px-10">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Next.js</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Hello World</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Esta página está hecha con Next.js y se publica en Vercel. El código queda
          en el repositorio de GitHub.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          Ir a producción
        </Link>
      </section>
    </main>
  );
}
