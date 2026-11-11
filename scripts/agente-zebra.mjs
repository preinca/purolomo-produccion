import net from "node:net";
import { spawn } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const url = (process.env.PUROLOMO_URL || "").replace(/\/$/, "");
const clave = process.env.IMPRESION_CLAVE || "";
const host = process.env.ZEBRA_HOST || "";
const puerto = Number(process.env.ZEBRA_PUERTO || 9100);
const impresora = process.env.ZEBRA_IMPRESORA || "";

if (!url || !clave || (!host && !impresora)) {
  console.error("Faltan PUROLOMO_URL, IMPRESION_CLAVE y ZEBRA_HOST o ZEBRA_IMPRESORA.");
  process.exit(1);
}

async function ciclo() {
  const respuesta = await fetch(`${url}/api/impresion`, {
    headers: { "x-impresion-clave": clave },
    cache: "no-store",
  });
  if (!respuesta.ok) throw new Error(`La aplicación respondió ${respuesta.status}`);
  const trabajo = await respuesta.json();
  if (!trabajo?.id || !trabajo.zpl) return;
  try {
    await enviar(trabajo.zpl);
    await avisar(trabajo.id, true);
    console.log(`Impresas las etiquetas del trabajo ${trabajo.id}`);
  } catch (error) {
    await avisar(trabajo.id, false);
    console.error(error instanceof Error ? error.message : error);
  }
}

async function avisar(id, ok) {
  await fetch(`${url}/api/impresion`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-impresion-clave": clave },
    body: JSON.stringify({ id, ok }),
  });
}

function enviar(zpl) {
  if (host) return enviarPorRed(zpl);
  return enviarPorWindows(zpl);
}

function enviarPorRed(zpl) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(puerto, host);
    socket.setTimeout(10000);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("La impresora no respondió."));
    });
    socket.on("error", reject);
    socket.on("connect", () => socket.end(zpl, "utf8", () => resolve()));
  });
}

async function enviarPorWindows(zpl) {
  const archivo = path.join(tmpdir(), `purolomo-${Date.now()}.zpl`);
  await writeFile(archivo, zpl, "utf8");
  const comando = `
$printer = ${JSON.stringify(impresora)}
$bytes = [System.IO.File]::ReadAllBytes(${JSON.stringify(archivo)})
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, DOCINFOA di);
  [DllImport("winspool.Drv", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  public static bool Send(string name, byte[] bytes) {
    IntPtr printer;
    if (!OpenPrinter(name, out printer, IntPtr.Zero)) return false;
    var info = new DOCINFOA();
    info.pDocName = "Purolomo";
    info.pDataType = "RAW";
    if (!StartDocPrinter(printer, 1, info)) { ClosePrinter(printer); return false; }
    StartPagePrinter(printer);
    var ptr = Marshal.AllocCoTaskMem(bytes.Length);
    Marshal.Copy(bytes, 0, ptr, bytes.Length);
    int written;
    var ok = WritePrinter(printer, ptr, bytes.Length, out written);
    Marshal.FreeCoTaskMem(ptr);
    EndPagePrinter(printer);
    EndDocPrinter(printer);
    ClosePrinter(printer);
    return ok;
  }
}
'@
if (-not [RawPrinter]::Send($printer, $bytes)) { exit 1 }
`;
  try {
    await new Promise((resolve, reject) => {
      const proceso = spawn("powershell", ["-NoProfile", "-Command", comando], { stdio: "inherit" });
      proceso.on("error", reject);
      proceso.on("exit", (codigo) => (codigo === 0 ? resolve() : reject(new Error("Windows no pudo enviar el trabajo a la impresora."))));
    });
  } finally {
    await unlink(archivo).catch(() => undefined);
  }
}

console.log("Esperando etiquetas. Deja esta ventana abierta.");
setInterval(() => {
  ciclo().catch((error) => console.error(error instanceof Error ? error.message : error));
}, 4000);
ciclo().catch((error) => console.error(error instanceof Error ? error.message : error));
