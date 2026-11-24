// ===========================================
// HighlightEditorDialog — crear o editar un destacado sin tocar código
// ===========================================
//
// Un destacado es un ranking de opciones con un título en lenguaje simple:
// se elige la pregunta, qué opciones compiten y cuántas se muestran. Se
// guarda por el `valor` de las opciones, así sigue funcionando la próxima
// edición aunque el texto de las preguntas cambie.
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { MetricsPregunta, SurveyHighlight } from '@/types';
import { useCreateHighlight, useUpdateHighlight } from '@/hooks/useMetrics';
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
import { Textarea } from '@/components/ui/textarea';
import { SelectField } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface HighlightEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  preguntas: MetricsPregunta[];
  /** Si viene, se edita; si no, se crea. */
  destacado?: SurveyHighlight | null;
}

const OPCIONES_TOP = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({
  value: String(n),
  label: n === 1 ? 'Sólo la primera' : `Las ${n} primeras`,
}));

export function HighlightEditorDialog({
  open,
  onOpenChange,
  campaignId,
  preguntas,
  destacado,
}: HighlightEditorDialogProps) {
  const crear = useCreateHighlight();
  const actualizar = useUpdateHighlight();
  const guardando = crear.isPending || actualizar.isPending;

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [preguntaId, setPreguntaId] = useState('');
  const [valores, setValores] = useState<string[]>([]);
  const [top, setTop] = useState('3');
  const [reutilizable, setReutilizable] = useState(true);

  // Cargar el destacado al abrir (o limpiar el formulario para uno nuevo).
  useEffect(() => {
    if (!open) return;
    const elegidos = destacado?.definicion.opciones ?? [];
    setTitulo(destacado?.titulo ?? '');
    setDescripcion(destacado?.descripcion ?? '');
    setValores(elegidos);
    setTop(String(destacado?.definicion.top ?? 3));
    setReutilizable(destacado ? destacado.campaignId === null : true);
    setPreguntaId(
      preguntas.find((p) => p.opciones.some((o) => elegidos.includes(o.valor)))?.questionId ?? '',
    );
  }, [open, destacado, preguntas]);

  const pregunta = preguntas.find((p) => p.questionId === preguntaId);

  const error = useMemo(() => {
    if (titulo.trim().length < 3) return 'Poné un título de al menos 3 letras.';
    if (valores.length === 0) return 'Elegí al menos una opción para el ranking.';
    return null;
  }, [titulo, valores]);

  const alternar = (valor: string) =>
    setValores((actuales) =>
      actuales.includes(valor) ? actuales.filter((v) => v !== valor) : [...actuales, valor],
    );

  const guardar = async () => {
    if (error) return;
    const payload = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      campaignId: reutilizable ? null : campaignId,
      definicion: { opciones: valores, top: Number(top) },
    };
    try {
      if (destacado) await actualizar.mutateAsync({ id: destacado.id, payload });
      else await crear.mutateAsync(payload);
      onOpenChange(false);
    } catch {
      // El toast lo muestra el hook.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{destacado ? 'Editar destacado' : 'Nuevo destacado'}</DialogTitle>
          <DialogDescription>
            Un destacado ordena las opciones más elegidas de una pregunta y las presenta como un titular. Se
            recalcula solo con cada respuesta y nunca muestra grupos de menos de 5 personas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <label htmlFor="destacado-titulo" className="text-sm font-semibold text-primary-800">Título</label>
            <Input
              id="destacado-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej.: Lo que más necesitan los deportistas es:"
              maxLength={160}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="destacado-descripcion" className="text-sm font-semibold text-primary-800">
              Descripción <span className="font-normal text-primary-500">(opcional)</span>
            </label>
            <Textarea
              id="destacado-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={500}
              rows={2}
              className="mt-1"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="destacado-pregunta" className="text-sm font-semibold text-primary-800">
              ¿De qué pregunta?
            </label>
            <SelectField
              id="destacado-pregunta"
              value={preguntaId}
              onValueChange={(v) => {
                setPreguntaId(v);
                setValores(preguntas.find((p) => p.questionId === v)?.opciones.map((o) => o.valor) ?? []);
              }}
              placeholder="Elegí una pregunta"
              options={preguntas.map((p) => ({ value: p.questionId, label: `${p.orden}. ${p.texto}` }))}
            />
            {pregunta && (
              <fieldset className="grid gap-1.5 rounded-lg border border-primary-100 p-3 sm:grid-cols-2">
                <legend className="px-1 text-xs font-semibold text-primary-700">Compiten en el ranking…</legend>
                {pregunta.opciones.map((o) => (
                  <Checkbox
                    key={o.optionId}
                    checked={valores.includes(o.valor)}
                    onCheckedChange={() => alternar(o.valor)}
                    label={o.texto}
                  />
                ))}
              </fieldset>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="destacado-top" className="text-sm font-semibold text-primary-800">Mostrar</label>
              <SelectField id="destacado-top" value={top} onValueChange={setTop} options={OPCIONES_TOP} className="mt-1" />
            </div>
            <Checkbox
              checked={reutilizable}
              onCheckedChange={setReutilizable}
              label="Usarlo también en las próximas ediciones"
              wrapperClassName="self-end pb-2"
            />
          </div>

          {error && <p className="text-sm font-medium text-destructive-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={guardar} disabled={!!error || guardando} className="gap-2">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {destacado ? 'Guardar cambios' : 'Crear destacado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
