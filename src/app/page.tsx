import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { quitarRegistro } from "@/app/actions";
import { RegistroForm } from "@/components/registro-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb, rutaBaseDatos } from "@/lib/db";
import { fechaHoy, formatoFecha, formatoHora, formatoKg } from "@/lib/formato";
import { listarRegistros, resumir } from "@/lib/produccion";
import { etiquetaTurno } from "@/lib/turnos";

export default function Page({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">
              Purolomo
            </p>
            <Link href="/hello" className="text-sm font-medium text-primary">
              Hello World
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Producción</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Anota los kilos de cada línea. SQLite los guarda en un archivo de este
            proyecto, sin instalar un servidor de base de datos.
          </p>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        <Suspense fallback={<Cargando />}>
          <Contenido searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function Contenido({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const parametros = await searchParams;
  const hoy = fechaHoy();
  const pedido = primerTexto(parametros.fecha);
  const verTodas = pedido === "todas";
  const fecha = !pedido || verTodas ? (verTodas ? null : hoy) : pedido;
  const registros = fecha === null || /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ? listarRegistros(getDb(), fecha)
    : [];
  const resumen = resumir(registros);
  const archivo = rutaBaseDatos().replace(`${process.cwd()}/`, "");

  return (
    <>
      <form action="/" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="grid gap-1.5 text-sm font-medium" htmlFor="filtro-fecha">
          Día
          <input
            id="filtro-fecha"
            name="fecha"
            type="date"
            defaultValue={fecha ?? ""}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm font-normal"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline">
            Ver día
          </Button>
          <Link href="/" className="inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium hover:bg-muted">
            Hoy
          </Link>
          <Link
            href="/?fecha=todas"
            className="inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium hover:bg-muted"
          >
            Todos los días
          </Link>
        </div>
      </form>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumen">
        <TarjetaResumen titulo="Registros" valor={String(resumen.cantidad)} />
        <TarjetaResumen titulo="Total" valor={formatoKg(resumen.totalKg)} />
        <TarjetaResumen
          titulo="Por turno"
          valor={`${formatoKg(resumen.porTurno.manana)} · ${formatoKg(resumen.porTurno.tarde)} · ${formatoKg(resumen.porTurno.noche)}`}
          detalle="Mañana, tarde y noche"
        />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Nuevo registro</CardTitle>
            <CardDescription>
              La cantidad acepta coma o punto decimal. El turno se guarda como
              mañana, tarde o noche.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegistroForm hoy={hoy} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {fecha ? formatoFecha(fecha) : "Todos los registros"}
            </CardTitle>
            <CardDescription>
              {registros.length === 0
                ? "Cuando guardes el primero, aparece en esta lista."
                : `${resumen.cantidad} en esta vista, ordenados del más reciente al más antiguo.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {registros.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {fecha
                  ? "No hay producción registrada para este día."
                  : "La base todavía no tiene registros."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    {fecha ? null : <TableHead>Fecha</TableHead>}
                    <TableHead>Turno</TableHead>
                    <TableHead>Línea</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Kg</TableHead>
                    <TableHead>
                      <span className="sr-only">Quitar</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registros.map((registro) => (
                    <TableRow key={registro.id}>
                      <TableCell>{formatoHora(registro.creadoEn)}</TableCell>
                      {fecha ? null : <TableCell>{formatoFecha(registro.fecha)}</TableCell>}
                      <TableCell>{etiquetaTurno(registro.turno)}</TableCell>
                      <TableCell className="whitespace-normal">{registro.linea}</TableCell>
                      <TableCell className="whitespace-normal">
                        <div>{registro.producto}</div>
                        {registro.observaciones ? (
                          <div className="text-xs text-muted-foreground">
                            {registro.observaciones}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatoKg(registro.cantidadKg)}
                      </TableCell>
                      <TableCell className="text-right">
                        <form action={quitarRegistro}>
                          <input type="hidden" name="id" value={registro.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            Quitar
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">
        Archivo SQLite: <code className="font-mono">{archivo}</code>
      </p>
    </>
  );
}

function TarjetaResumen({
  titulo,
  valor,
  detalle,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className="text-lg">{valor}</CardTitle>
        {detalle ? <CardDescription>{detalle}</CardDescription> : null}
      </CardHeader>
    </Card>
  );
}

function Cargando() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="h-80 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

function primerTexto(valor: string | string[] | undefined) {
  if (Array.isArray(valor)) return valor[0]?.trim() ?? "";
  return valor?.trim() ?? "";
}
