// ===========================================
// KpiEditorDialog — crear o editar un indicador sin tocar código
// ===========================================
//
// Un KPI se arma eligiendo opciones de respuesta: "de quienes eligieron X,
// cuántos eligieron Y". Se guarda por el `valor` de las opciones, no por su
// id, así el mismo indicador sigue funcionando la próxima edición aunque el
// texto de las preguntas cambie.
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { KpiDefinicion, MetricsPregunta, SurveyKpi } from '@/types';
import { useCreateKpi, useUpdateKpi } from '@/hooks/useMetrics';
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

type ModoDenominador = 'todas' | 'contestaron' | 'condicion';

interface KpiEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  preguntas: MetricsPregunta[];
  /** Si viene, se edita; si no, se crea. */
  kpi?: SurveyKpi | null;
}

/** Selector de opciones: una pregunta y las opciones que cuentan. */
function SelectorOpciones({
  id,
  preguntas,
  valores,
  onChange,
}: {
  id: string;
  preguntas: MetricsPregunta[];
  valores: string[];
  onChange: (valores: string[]) => void;
}) {
  // La pregunta se deduce de los valores ya elegidos (al editar).
  const preguntaInicial =
    preguntas.find((p) => p.opciones.some((o) => valores.includes(o.valor)))?.questionId ?? '';
  const [preguntaId, setPreguntaId] = useState(preguntaInicial);
  const pregunta = preguntas.find((p) => p.questionId === preguntaId);

  const alternar = (valor: string) =>
    onChange(valores.includes(valor) ? valores.filter((v) => v !== valor) : [...valores, valor]);

  return (
    <div className="space-y-2">
      <SelectField
        id={`${id}-pregunta`}
        aria-label="Pregunta"
        value={preguntaId}
        onValueChange={(v) => {
          setPreguntaId(v);
          onChange([]);
        }}
        placeholder="Elegí una pregunta"
        options={preguntas.map((p) => ({ value: p.questionId, label: `${p.orden}. ${p.texto}` }))}
      />
      {pregunta && (
        <fieldset className="grid gap-1.5 rounded-lg border border-primary-100 p-3 sm:grid-cols-2">
          <legend className="px-1 text-xs font-semibold text-primary-700">Cuentan las respuestas…</legend>
          {pregunta.opciones.map((o) => (
            <label key={o.optionId} className="flex items-center gap-2 text-sm text-primary-800">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary-600"
                checked={valores.includes(o.valor)}
                onChange={() => alternar(o.valor)}
              />
              {o.texto}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}

export function KpiEditorDialog({ open, onOpenChange, campaignId, preguntas, kpi }: KpiEditorDialogProps) {
  const crear = useCreateKpi();
  const actualizar = useUpdateKpi();
  const guardando = crear.isPending || actualizar.isPending;

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [numerador, setNumerador] = useState<string[]>([]);
  const [modo, setModo] = useState<ModoDenominador>('contestaron');
  const [denominador, setDenominador] = useState<string[]>([]);
  const [formato, setFormato] = useState<KpiDefinicion['formato']>('porcentaje');
  const [reutilizable, setReutilizable] = useState(true);

  // Cargar el KPI al abrir (o limpiar el formulario para uno nuevo).
  useEffect(() => {
    if (!open) return;
    const def = kpi?.definicion;
    setNombre(kpi?.nombre ?? '');
    setDescripcion(kpi?.descripcion ?? '');
    setNumerador(def?.numerador[0]?.valores ?? []);
    if (!def || def.denominador === 'contestaron') setModo('contestaron');
    else if (def.denominador === 'todas') setModo('todas');
    else setModo('condicion');
    setDenominador(Array.isArray(def?.denominador) ? (def.denominador[0]?.valores ?? []) : []);
    setFormato(def?.formato ?? 'porcentaje');
    setReutilizable(kpi ? kpi.campaignId === null : true);
  }, [open, kpi]);

  const error = useMemo(() => {
    if (nombre.trim().length < 3) return 'Poné un nombre de al menos 3 letras.';
    if (numerador.length === 0) return 'Elegí al menos una respuesta que cuente.';
    if (modo === 'condicion' && denominador.length === 0) return 'Elegí las respuestas de la base.';
    return null;
  }, [nombre, numerador, modo, denominador]);

  const guardar = async () => {
    if (error) return;
    const definicion: KpiDefinicion = {
      numerador: [{ valores: numerador }],
      denominador: modo === 'condicion' ? [{ valores: denominador }] : modo,
      formato,
    };
    const payload = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      campaignId: reutilizable ? null : campaignId,
      definicion,
    };
    try {
      if (kpi) await actualizar.mutateAsync({ id: kpi.id, payload });
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
          <DialogTitle>{kpi ? 'Editar indicador' : 'Nuevo indicador'}</DialogTitle>
          <DialogDescription>
            Un indicador cuenta cuántas personas eligieron ciertas respuestas sobre una base. Se
            recalcula solo con cada respuesta nueva y respeta el anonimato.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <label htmlFor="kpi-nombre" className="text-sm font-semibold text-primary-800">Nombre</label>
            <Input
              id="kpi-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej.: Lesionados sin atención"
              maxLength={120}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="kpi-descripcion" className="text-sm font-semibold text-primary-800">
              Descripción <span className="font-normal text-primary-500">(opcional)</span>
            </label>
            <Textarea
              id="kpi-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={500}
              rows={2}
              className="mt-1"
            />
          </div>

          <div>
            <p className="text-sm font-semibold text-primary-800">¿Qué se cuenta?</p>
            <div className="mt-1">
              <SelectorOpciones id="kpi-numerador" preguntas={preguntas} valores={numerador} onChange={setNumerador} />
            </div>
          </div>

          <div>
            <label htmlFor="kpi-base" className="text-sm font-semibold text-primary-800">¿Sobre qué base?</label>
            <SelectField
              id="kpi-base"
              value={modo}
              onValueChange={(v) => setModo(v as ModoDenominador)}
              options={[
                { value: 'contestaron', label: 'Quienes contestaron esa pregunta' },
                { value: 'todas', label: 'Todas las respuestas del corte' },
                { value: 'condicion', label: 'Quienes eligieron otras respuestas…' },
              ]}
              className="mt-1"
            />
            {modo === 'condicion' && (
              <div className="mt-2">
                <SelectorOpciones id="kpi-base-opciones" preguntas={preguntas} valores={denominador} onChange={setDenominador} />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="kpi-formato" className="text-sm font-semibold text-primary-800">Mostrar como</label>
              <SelectField
                id="kpi-formato"
                value={formato}
                onValueChange={(v) => setFormato(v as KpiDefinicion['formato'])}
                options={[
                  { value: 'porcentaje', label: 'Porcentaje' },
                  { value: 'conteo', label: 'Cantidad de personas' },
                ]}
                className="mt-1"
              />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-primary-800">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary-600"
                checked={reutilizable}
                onChange={(e) => setReutilizable(e.target.checked)}
              />
              Usarlo también en las próximas ediciones
            </label>
          </div>

          {error && <p className="text-sm font-medium text-destructive-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={guardar} disabled={!!error || guardando} className="gap-2">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {kpi ? 'Guardar cambios' : 'Crear indicador'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
