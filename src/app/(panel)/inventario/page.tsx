import { PageFrame } from "@/components/page-frame";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PRODUCTOS_MPC } from "@/lib/mpc";

export default function Page() {
  return (
    <PageFrame
      titulo="Catálogo CDM"
      descripcion="Leyenda MPC y códigos del CDM de octubre 2026. Es la misma nomenclatura de las planillas de planta."
    >
      <Card>
        <CardHeader>
          <CardTitle>Materia prima cárnica</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          <div className="grid gap-3 md:hidden">
            {PRODUCTOS_MPC.map((producto) => (
              <article key={producto.codigo} className="grid gap-1 rounded-xl border p-4 text-sm">
                <p className="text-lg font-semibold">{producto.tipo}</p>
                <p>{producto.nombre}</p>
                <p className="font-mono text-xs">{producto.codigo}</p>
                <p className="text-muted-foreground">{producto.descripcion}</p>
              </article>
            ))}
          </div>
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Descripción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PRODUCTOS_MPC.map((producto) => (
                <TableRow key={producto.codigo}>
                  <TableCell className="font-semibold">{producto.tipo}</TableCell>
                  <TableCell>{producto.nombre}</TableCell>
                  <TableCell className="font-mono text-xs">{producto.codigo}</TableCell>
                  <TableCell>{producto.descripcion}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </PageFrame>
  );
}
