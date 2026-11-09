export function PageFrame({
  titulo,
  descripcion,
  acciones,
  children,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[90rem] flex-col gap-5 px-3 py-5 sm:gap-8 sm:px-8 sm:py-8">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{titulo}</h1>
          {descripcion ? (
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted-foreground">{descripcion}</p>
          ) : null}
        </div>
        {acciones ? <div className="flex flex-wrap gap-2 print:hidden">{acciones}</div> : null}
      </div>
      {children}
    </div>
  );
}
