import { PageFrame } from "@/components/page-frame";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUCTOS_MPC } from "@/lib/mpc";

export default function Page() {
  return (
    <PageFrame
      titulo="Leyenda MPC"
      descripcion="Nomenclatura de materia prima cárnica usada en el control de recepción. Es la misma leyenda de las planillas de planta."
    >
      <Card>
        <CardHeader>
          <CardTitle>Control de recepción de materia prima cárnica</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCTOS_MPC.map((producto) => (
              <li
                key={producto.codigo}
                className="rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <p className="font-semibold">
                  {producto.tipo}
                  <span className="ml-2 font-normal text-muted-foreground">{producto.descripcion}</span>
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {producto.nombre} · {producto.codigo}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </PageFrame>
  );
}
