import Image from "next/image";

export function LogoPurolomo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-md bg-white px-2 py-1.5">
      <Image
        src="/logo-purolomo.png"
        alt="Purolomo"
        width={509}
        height={149}
        className={compact ? "h-7 w-auto max-w-[140px] object-contain" : "h-9 w-auto max-w-[196px] object-contain"}
        priority
      />
    </div>
  );
}
