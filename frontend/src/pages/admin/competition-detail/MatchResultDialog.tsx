// ===========================================
// MatchResultDialog — carga o corrección del resultado de un partido (F-32)
// ===========================================
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Match, ResultType } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSubmitMatchResult } from '@/hooks/useResults';
import { logError } from '@/lib/logger';
import { armarResultado, reglaDe, valorInicial } from './matchResultForm';
import { nombreDelLado, ordenarLados, rotuloPorDefecto } from './matchSides';

interface MatchResultDialogProps {
  match: Match;
  resultType: ResultType | undefined;
  /** `true` cuando el partido ya está FINALIZADO y esto es una corrección. */
  esCorreccion: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MatchResultDialog({
  match,
  resultType,
  esCorreccion,
  open,
  onOpenChange,
}: MatchResultDialogProps) {
  const { izquierda, derecha, hayLocalia } = ordenarLados(match.results);
  // Un partido de posiciones puede tener más de dos competidores; en el resto
  // se respeta el orden local/visitante de la tarjeta.
  const todos = match.results ?? [];
  const lados =
    todos.length > 2 ? todos : [izquierda, derecha].filter((r) => r !== undefined);
  const regla = reglaDe(resultType);
  const submit = useSubmitMatchResult();

  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(lados.map((r) => [r.id, valorInicial(r, resultType)])),
  );
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const armado = armarResultado(lados, valores, resultType);
    if (!armado.ok) {
      setError(armado.error);
      return;
    }
    try {
      await submit.mutateAsync({ matchId: match.id, results: armado.payload });
      onOpenChange(false);
    } catch (err) {
      // El toast de error lo muestra el hook; acá sólo se deja abierto.
      logError('MatchResultDialog.handleSubmit', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submit.isPending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {esCorreccion ? 'Corregir resultado' : 'Cargar resultado'} — Partido #{match.matchNumber}
            </DialogTitle>
            <DialogDescription>
              {regla.mayorGana
                ? 'Gana quien tenga el número más alto. Con el mismo valor queda empatado.'
                : 'Gana quien tenga el valor más bajo. Con el mismo valor queda empatado.'}
            </DialogDescription>
          </DialogHeader>

          {lados.map((r, i) => {
            const nombre = nombreDelLado(r, rotuloPorDefecto(i, hayLocalia));
            const inputId = `resultado-${r.id}`;
            return (
              <div key={r.id} className="space-y-1.5">
                <Label htmlFor={inputId}>
                  {regla.etiqueta} de {nombre}
                </Label>
                <Input
                  id={inputId}
                  inputMode={regla.entero ? 'numeric' : 'decimal'}
                  autoComplete="off"
                  value={valores[r.id] ?? ''}
                  onChange={(e) => setValores((v) => ({ ...v, [r.id]: e.target.value }))}
                  disabled={submit.isPending}
                />
              </div>
            );
          })}

          {error && (
            <p role="alert" className="text-sm text-destructive-600">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submit.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submit.isPending} className="gap-2">
              {submit.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar resultado
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
