// ===========================================
// Validación de archivos por magic bytes (R14)
// ===========================================
//
// El pipe anterior era `.addFileTypeValidator({ fileType: /(jpeg|jpg|png|pdf)$/i })`,
// que en Nest compara contra `file.mimetype`. Ese valor **lo escribe el
// cliente**: viaja en el `Content-Type` de la parte multipart y multer lo copia
// tal cual, sin mirar un solo byte del archivo. Subir un `.exe` declarándolo
// `application/pdf` pasaba la validación, se guardaba en MinIO con
// `Content-Type: application/pdf` y quedaba disponible por URL pre-firmada.
//
// Acá se hace al revés: se mira el contenido y de ahí sale el tipo. Lo que el
// cliente diga sirve nada más que para detectar la inconsistencia.
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/** Tipos aceptados y su mimetype canónico. */
export const TIPOS_PERMITIDOS = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpeg: 'image/jpeg',
} as const;

export type TipoArchivo = keyof typeof TIPOS_PERMITIDOS;

/** Extensión declarada → tipo canónico esperado. */
const EXTENSION_A_TIPO: Record<string, TipoArchivo> = {
  '.pdf': 'pdf',
  '.png': 'png',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
};

const empiezaCon = (buffer: Buffer, bytes: number[]): boolean =>
  buffer.length >= bytes.length &&
  bytes.every((byte, indice) => buffer[indice] === byte);

/**
 * Devuelve el tipo real del archivo mirando su firma, o `null` si no es
 * ninguno de los tres permitidos.
 *
 * Las firmas se exigen en el **offset 0**. Aceptarlas más adelante (como
 * permite la spec de PDF, que tolera basura antes del `%PDF-`) habilita
 * archivos poliglota: un HTML con XSS que además es un PDF válido.
 */
export function detectarTipoPorContenido(
  buffer: Buffer | undefined,
): TipoArchivo | null {
  if (!buffer || buffer.length < 4) return null;

  // %PDF-
  if (empiezaCon(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf';
  // \x89PNG\r\n\x1a\n
  if (empiezaCon(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'png';
  }
  // JPEG: SOI + primer marcador
  if (empiezaCon(buffer, [0xff, 0xd8, 0xff])) return 'jpeg';

  return null;
}

/** Extensión en minúsculas del nombre original, o `''`. */
function extensionDe(nombre: string): string {
  const base = (nombre ?? '').split(/[\\/]/).pop() ?? '';
  const punto = base.lastIndexOf('.');
  return punto > 0 ? base.slice(punto).toLowerCase() : '';
}

/**
 * Valida el archivo subido contra su propio contenido.
 *
 * Tres cortes, todos con **400**:
 *   1. el contenido no es PDF/PNG/JPEG;
 *   2. la extensión declarada no está permitida;
 *   3. la extensión no se corresponde con el contenido (un `.pdf` que por
 *      dentro es PNG entra acá — no es peligroso en sí, pero la clave que
 *      `MinioService` arma sale de la extensión, así que el objeto quedaría
 *      guardado con una extensión que miente sobre su contenido).
 *
 * Efecto lateral deliberado: se **reescribe** `file.mimetype` con el mimetype
 * canónico del tipo detectado. De ahí en más nadie aguas abajo consume el valor
 * que mandó el cliente: ni la columna `mimeType` de la tabla, ni el
 * `Content-Type` con el que el objeto se guarda en MinIO.
 */
@Injectable()
export class FileSignaturePipe implements PipeTransform<
  Express.Multer.File,
  Express.Multer.File
> {
  transform(file: Express.Multer.File): Express.Multer.File {
    if (!file) {
      throw new BadRequestException('No se adjuntó ningún archivo');
    }

    const tipoReal = detectarTipoPorContenido(file.buffer);
    if (!tipoReal) {
      throw new BadRequestException(
        'El contenido del archivo no corresponde a un PDF, PNG o JPEG',
      );
    }

    const extension = extensionDe(file.originalname);
    const tipoDeclarado = EXTENSION_A_TIPO[extension];
    if (!tipoDeclarado) {
      throw new BadRequestException(
        'Extensión de archivo no permitida (se aceptan .pdf, .png, .jpg y .jpeg)',
      );
    }

    if (tipoDeclarado !== tipoReal) {
      throw new BadRequestException(
        `El contenido del archivo (${tipoReal}) no coincide con su extensión (${extension})`,
      );
    }

    file.mimetype = TIPOS_PERMITIDOS[tipoReal];
    return file;
  }
}
