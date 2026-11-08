// ===========================================
// DetailHeader — cabecera común de las páginas de detalle del panel
// ===========================================
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DetailHeaderProps {
  title: string;
  /** Estado de la entidad (Badge); va pegado al título. */
  status?: ReactNode;
  /** Línea de contexto bajo el título: DNI, fecha de envío, disciplina... */
  meta?: ReactNode;
  /** Etiqueta accesible del botón de volver (nombra el destino). */
  backLabel: string;
  onBack: () => void;
  /** Acción principal: a la derecha desde `sm`, a todo el ancho debajo en celular. */
  actions?: ReactNode;
}

/**
 * Patrón único de cabecera: volver + título (el único `<h1>` de la página) +
 * estado + acción principal. En celular la acción baja a todo el ancho para
 * quedar al alcance del pulgar.
 */
export function DetailHeader({ title, status, meta, backLabel, onBack, actions }: DetailHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
        <Button variant="outline" size="icon" onClick={onBack} aria-label={backLabel} className="mt-0.5 shrink-0">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="type-h1 text-primary-800 break-words">{title}</h1>
            {status}
          </div>
          {meta && <div className="mt-1.5 text-sm text-primary-600">{meta}</div>}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center [&>*]:w-full sm:[&>*]:w-auto">
          {actions}
        </div>
      )}
    </header>
  );
}
