import { cn } from "@/lib/utils";

export function EstadoBadge({ estado }: { estado: string }) {
  const tono =
    estado === "TRANSFIRIO"
        ? "bg-sky-100 text-sky-800"
        : estado === "LOGISTICA"
          ? "bg-orange-500 text-white"
          : estado === "RECIBIDO"
          ? "bg-primary/10 text-primary"
          : estado === "CONSUMIDOS"
            ? "bg-neutral-200 text-neutral-700"
            : estado.startsWith("DEVUELTO")
              ? "bg-rose-100 text-rose-800"
              : "bg-muted text-muted-foreground";

  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", tono)}>
      {estado}
    </span>
  );
}
