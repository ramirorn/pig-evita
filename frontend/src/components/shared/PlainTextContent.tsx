// ===========================================
// PlainTextContent — Texto largo cargado por el back-office
// ===========================================
import { cn } from '@/lib/utils';

interface PlainTextContentProps {
  /** Texto plano proveniente del backend (reglamentos, cuerpo de noticias, ...). */
  text?: string | null;
  /** Qué mostrar cuando no hay contenido cargado. */
  fallback?: string;
  className?: string;
}

/**
 * Renderiza texto plano de varias líneas respetando los saltos de línea.
 *
 * ⚠️ NO usar `dangerouslySetInnerHTML` para estos campos (hallazgos F1/F2 de la
 * auditoría). `discipline.rules` y `news.content` son columnas `Text` que se
 * cargan desde un `<textarea>` del panel admin: son texto plano, no HTML rico.
 * Renderizarlos como HTML permitía que una cuenta admin comprometida inyectara
 * `<script>` o `<img onerror>` que se ejecutaba en el navegador de cualquier
 * visitante anónimo.
 *
 * Al pasar el texto como *children*, React lo escapa y el vector desaparece por
 * completo — sin depender de que un sanitizador esté bien configurado ni al día.
 * `whitespace-pre-wrap` conserva los saltos de línea y los párrafos, que es lo
 * único que aportaba el reemplazo `\n → <br/>` anterior.
 *
 * Si en el futuro se necesita formato real (negritas, listas, links), la vía
 * correcta es un editor de texto enriquecido en el admin + sanitización con
 * DOMPurify acá, con una allowlist de tags explícita.
 */
export function PlainTextContent({
  text,
  fallback = 'Contenido no disponible.',
  className,
}: PlainTextContentProps) {
  const content = text?.trim();

  if (!content) {
    return <p className="italic text-primary-400">{fallback}</p>;
  }

  return (
    <div className={cn('whitespace-pre-wrap break-words', className)}>
      {content}
    </div>
  );
}
