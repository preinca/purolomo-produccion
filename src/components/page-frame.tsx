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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-purolomo-red uppercase">
            Panel de administración · Base de datos SQLite
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{titulo}</h1>
          {descripcion ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{descripcion}</p>
          ) : null}
        </div>
        {acciones ? <div className="flex flex-wrap gap-2 print:hidden">{acciones}</div> : null}
      </div>
      {children}
    </div>
  );
}
