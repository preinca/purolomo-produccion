import { createCipheriv, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";
import type { EtiquetaCava } from "./etiqueta-cava";

const CLAVE = ",^_A5Fus&!?j='Epiq*e";
const ESCALA_BASE = 151.409306798409;

export function nlblDeEtiqueta(etiqueta: EtiquetaCava, textoDelQr: string) {
  const formato = fs
    .readFileSync(rutaPlantilla("formato-qr.xml"), "utf8")
    .replace(/<Items>[\s\S]*<\/Items>/, `<Items>\n${objetos(etiqueta, textoDelQr)}\n      </Items>`);
  const solucion = fs.readFileSync(rutaPlantilla("solucion.slnx"));
  return empaquetar([
    { nombre: "Formats/QR", datos: Buffer.from(formato, "utf8") },
    { nombre: "QR.slnx", datos: solucion },
  ]);
}

export function xmlDeEtiqueta(archivo: Buffer) {
  return leer(archivo).get("Formats/QR")?.toString("utf8") ?? "";
}

function objetos(etiqueta: EtiquetaCava, textoDelQr: string) {
  const lineas = [
    { texto: etiqueta.tag, escala: 118 },
    { texto: etiqueta.producto, escala: 72 },
    ...partir(etiqueta.descripcion).map((texto) => ({ texto, escala: 58 })),
    { texto: etiqueta.codigo, escala: 72 },
    { texto: etiqueta.kgRecibidos, escala: 68 },
    { texto: etiqueta.fecha, escala: 64 },
    { texto: etiqueta.hora, escala: 64 },
  ];
  const paso = 47000 / lineas.length;
  const textos = lineas.map((linea, indice) =>
    texto(linea.texto, 2800, Math.round(1800 + indice * paso), linea.escala, 10010 + indice),
  );
  return [...textos, qr(textoDelQr)].join("\n");
}

function partir(texto: string) {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  if (palabras.length <= 1) return palabras;
  const corte = Math.ceil(palabras.length / 2);
  return [palabras.slice(0, corte).join(" "), palabras.slice(corte).join(" ")];
}

function texto(valor: string, x: number, y: number, escala: number, orden: number) {
  const proporcion = escala / ESCALA_BASE;
  const alto = Math.round(-111 * proporcion);
  const ancho = Math.round(66 * proporcion);
  const codificado = Buffer.from(`${valor}\r\n`, "utf8").toString("base64");
  return `        <Item Type="TextDocumentItem">
          <Id>${id(valor, orden)}</Id>
          <Name>${escapar(valor)}</Name>
          <FontDescriptor Type="FontDescriptor">
            <Name>ZEBRA 0</Name>
            <Height>${(39.3 * proporcion).toFixed(1)}</Height>
            <Width>${(23.4471602083124 * proporcion).toFixed(4)}</Width>
            <HorizontalSpacing>125.12315270936</HorizontalSpacing>
            <Color>FF000000</Color>
            <LogFontWrapper Type="LogFontWrapper">
              <Height>${alto}</Height>
              <Width>${ancho}</Width>
              <Weight>700</Weight>
              <Quality>1</Quality>
              <PitchAndFamily>0</PitchAndFamily>
              <FaceName>ZEBRA 0</FaceName>
            </LogFontWrapper>
          </FontDescriptor>
          <Color>FF000000</Color>
          <SampleValue Type="StringContents" />
          <PrintAsGraphics>False</PrintAsGraphics>
          <Geometry Type="PositionGeometry">
            <X>${x}</X>
            <Y>${y}</Y>
          </Geometry>
          <FixedContents Base64Encoded="true">${codificado}</FixedContents>
          <Contents Type="ExtendedDataValue">
            <FixedValue Type="StringContents">
              <StringValue Base64Encoded="true">${codificado}</StringValue>
            </FixedValue>
          </Contents>
          <ScaleFactor>${escala}</ScaleFactor>
          <BestFitMinimumFontSize>4</BestFitMinimumFontSize>
          <BestFitMaximumFontSize>72</BestFitMaximumFontSize>
          <TextBoxAlignment>0</TextBoxAlignment>
          <ZOrder>${orden}</ZOrder>
          <MergeName>${escapar(valor)}</MergeName>
        </Item>`;
}

function qr(valor: string) {
  const codificado = Buffer.from(valor, "utf8").toString("base64");
  return `        <Item Type="BarcodeDocumentItem">
          <Id>b7c1a4e2-6d58-4a1e-9c33-0a1b2c3d4e5f</Id>
          <Name>QR</Name>
          <Color>FF000000</Color>
          <SampleValue Type="StringContents" />
          <PrintAsGraphics>False</PrintAsGraphics>
          <Geometry Type="RectGeometry">
            <Width>40000</Width>
            <Height>40000</Height>
            <Left>61000</Left>
            <Top>5400</Top>
            <AnchoringPoint>0</AnchoringPoint>
          </Geometry>
          <FixedContents Base64Encoded="true">${codificado}</FixedContents>
          <Contents Type="ExtendedDataValue">
            <FixedValue Type="StringContents">
              <StringValue Base64Encoded="true">${codificado}</StringValue>
            </FixedValue>
          </Contents>
          <BarcodeData Type="QrBarcodeData">
            <BarcodeId>QR</BarcodeId>
            <ErrorCorrectionLevel>1</ErrorCorrectionLevel>
            <SymbolVersion>0</SymbolVersion>
            <Encoding>0</Encoding>
          </BarcodeData>
          <HumanInterpretationEnabled>False</HumanInterpretationEnabled>
          <ZOrder>10001</ZOrder>
          <MergeName>QR</MergeName>
        </Item>`;
}

function id(valor: string, orden: number) {
  const hueco = Buffer.from(`${orden}:${valor}`).toString("hex").slice(0, 12).padEnd(12, "0");
  return `00000000-0000-4000-8000-${hueco}`;
}

function escapar(valor: string) {
  return valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function rutaPlantilla(nombre: string) {
  return path.join(process.cwd(), "src", "lib", "zebra", nombre);
}

function empaquetar(archivos: { nombre: string; datos: Buffer }[]) {
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let desplazamiento = 0;
  for (const archivo of archivos) {
    const comprimido = deflateRawSync(archivo.datos);
    const cifrado = cifrar(comprimido);
    const nombre = Buffer.from(archivo.nombre, "utf8");
    const extra = extraAes();
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(1, 6);
    local.writeUInt16LE(99, 8);
    local.writeUInt32LE(crc32(archivo.datos) >>> 0, 14);
    local.writeUInt32LE(cifrado.length, 18);
    local.writeUInt32LE(archivo.datos.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    local.writeUInt16LE(extra.length, 28);
    const bloque = Buffer.concat([local, nombre, extra, cifrado]);
    locales.push(bloque);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(45, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(1, 8);
    central.writeUInt16LE(99, 10);
    central.writeUInt32LE(crc32(archivo.datos) >>> 0, 16);
    central.writeUInt32LE(cifrado.length, 20);
    central.writeUInt32LE(archivo.datos.length, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt16LE(extra.length, 30);
    central.writeUInt32LE(desplazamiento, 42);
    centrales.push(Buffer.concat([central, nombre, extra]));
    desplazamiento += bloque.length;
  }
  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat([...locales, directorio, fin]);
}

function extraAes() {
  const extra = Buffer.alloc(11);
  extra.writeUInt16LE(0x9901, 0);
  extra.writeUInt16LE(7, 2);
  extra.writeUInt16LE(1, 4);
  extra.write("AE", 6, "ascii");
  extra.writeUInt8(3, 8);
  extra.writeUInt16LE(8, 9);
  return extra;
}

function cifrar(datos: Buffer) {
  const sal = randomBytes(16);
  const material = pbkdf2Sync(CLAVE, sal, 1000, 66, "sha1");
  const cifrado = ctr(material.subarray(0, 32), datos);
  const mac = createHmac("sha1", material.subarray(32, 64)).update(cifrado).digest().subarray(0, 10);
  return Buffer.concat([sal, material.subarray(64, 66), cifrado, mac]);
}

function ctr(clave: Buffer, datos: Buffer) {
  const salida = Buffer.alloc(datos.length);
  let contador = BigInt(1);
  for (let inicio = 0; inicio < datos.length; inicio += 16) {
    const bloque = Buffer.alloc(16);
    bloque.writeBigUInt64LE(contador, 0);
    const cifrador = createCipheriv("aes-256-ecb", clave, null);
    cifrador.setAutoPadding(false);
    const flujo = Buffer.concat([cifrador.update(bloque), cifrador.final()]);
    const largo = Math.min(16, datos.length - inicio);
    for (let i = 0; i < largo; i += 1) salida[inicio + i] = datos[inicio + i] ^ flujo[i];
    contador += BigInt(1);
  }
  return salida;
}

function leer(archivo: Buffer) {
  const entradas = new Map<string, Buffer>();
  let cursor = 0;
  while (cursor + 30 < archivo.length && archivo.readUInt32LE(cursor) === 0x04034b50) {
    const metodo = archivo.readUInt16LE(cursor + 8);
    const comprimido = archivo.readUInt32LE(cursor + 18);
    const nombreLargo = archivo.readUInt16LE(cursor + 26);
    const extraLargo = archivo.readUInt16LE(cursor + 28);
    const inicio = cursor + 30 + nombreLargo + extraLargo;
    const nombre = archivo.subarray(cursor + 30, cursor + 30 + nombreLargo).toString("utf8");
    const cuerpo = archivo.subarray(inicio, inicio + comprimido);
    entradas.set(nombre, metodo === 99 ? descifrar(cuerpo) : cuerpo);
    cursor = inicio + comprimido;
  }
  return entradas;
}

function descifrar(cuerpo: Buffer) {
  const sal = cuerpo.subarray(0, 16);
  const material = pbkdf2Sync(CLAVE, sal, 1000, 66, "sha1");
  const cifrado = cuerpo.subarray(18, cuerpo.length - 10);
  const plano = inflateRawSync(ctr(material.subarray(0, 32), cifrado));
  return plano;
}
