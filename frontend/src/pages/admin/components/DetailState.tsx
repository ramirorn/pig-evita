// ===========================================
// DetailState — carga y "no encontrado" de las páginas de detalle
// ===========================================
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DetailLoading({ label }: { label: string }) {
  return (
    <div role="status" className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-primary-600">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

interface DetailNotFoundProps {
  title: string;
  /** Qué pasó y qué hacer: el registro pudo borrarse o el enlace estar mal copiado. */
  hint: string;
  backLabel: string;
  onBack: () => void;
}

export function DetailNotFound({ title, hint, backLabel, onBack }: DetailNotFoundProps) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="type-h2 text-primary-800">{title}</h1>
      <p className="mt-2 text-sm text-primary-600">{hint}</p>
      <Button variant="outline" className="mt-5" onClick={onBack}>
        {backLabel}
      </Button>
    </div>
  );
}
