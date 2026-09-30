// ===========================================
// Validación por magic bytes de la FOTO de sede
// ===========================================
//
// Mismo criterio que los documentos (R14: el tipo sale del contenido, no del
// `Content-Type` que declara el cliente), con OTRA lista: JPEG, PNG y WebP; sin
// PDF. Reusa el validador genérico de `documents/file-signature.pipe.ts` con
// su propia regla, así los tipos de documentos no cambian en nada.
import { Injectable } from '@nestjs/common';
import {
  ReglaDeFirma,
  crearPipeDeFirma,
  detectarTipoPorContenido,
} from '../documents/file-signature.pipe';

/** Tipos de imagen aceptados y su mimetype canónico. */
export const TIPOS_IMAGEN = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

export type TipoImagen = keyof typeof TIPOS_IMAGEN;

/** Extensión declarada → tipo esperado. */
const EXTENSION_A_TIPO_IMAGEN: Record<string, TipoImagen> = {
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.png': 'png',
  '.webp': 'webp',
};

/** Extensión con la que se guarda cada tipo (la del tipo DETECTADO). */
export const EXTENSION_CANONICA_IMAGEN: Record<TipoImagen, string> = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
};

const ascii = (buffer: Buffer, offset: number, texto: string): boolean =>
  buffer.length >= offset + texto.length &&
  buffer.toString('latin1', offset, offset + texto.length) === texto;

/**
 * WebP: contenedor RIFF (`RIFF` + tamaño de 4 bytes) con forma `WEBP` en el
 * offset 8 y un chunk `VP8 ` / `VP8L` / `VP8X` en el 12. Pedir el chunk, y no
 * sólo `RIFF....WEBP`, descarta un WAV/AVI con los bytes retocados.
 */
function esWebp(buffer: Buffer): boolean {
  return (
    ascii(buffer, 0, 'RIFF') &&
    ascii(buffer, 8, 'WEBP') &&
    (ascii(buffer, 12, 'VP8 ') ||
      ascii(buffer, 12, 'VP8L') ||
      ascii(buffer, 12, 'VP8X'))
  );
}

/** Tipo real de la imagen por su firma (offset 0), o `null`. PDF no cuenta. */
export function detectarTipoDeImagen(
  buffer: Buffer | undefined,
): TipoImagen | null {
  if (!buffer) return null;
  const tipo = detectarTipoPorContenido(buffer);
  if (tipo === 'jpeg' || tipo === 'png') return tipo;
  return esWebp(buffer) ? 'webp' : null;
}

export const REGLA_IMAGENES: ReglaDeFirma<TipoImagen> = {
  detectar: detectarTipoDeImagen,
  mimes: TIPOS_IMAGEN,
  extensiones: EXTENSION_A_TIPO_IMAGEN,
  nombreTipos: 'JPEG, PNG o WebP',
  nombreExtensiones: '.jpg, .jpeg, .png y .webp',
};

/** Pipe de la foto de sede: JPEG, PNG o WebP por contenido; 400 si no. */
@Injectable()
export class ImageSignaturePipe extends crearPipeDeFirma(REGLA_IMAGENES) {}
