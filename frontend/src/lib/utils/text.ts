// ===========================================
// Clases CSS y texto
// ===========================================
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Fecha corta (dd/mm/aaaa). Ausente o inválida → "—", nunca "Invalid Date".
 */

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

/** Generate initials from first and last name */
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/**
 * Tamaño legible con coma decimal: "850 KB", "1,4 MB".
 *
 * La versión anterior daba "1.4 MB" (punto) y `undefined` para tamaños
 * negativos o no finitos; la usa el uploader de documentos, que muestra el
 * peso del archivo junto al límite de 5 MB.
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`;
}
