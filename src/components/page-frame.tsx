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
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-8 px-5 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1>
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
