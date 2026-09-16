// ===========================================
// useSurveyCampaignForm — alta y edición de una campaña (S20)
// ===========================================
import { useEffect } from 'react';
import {
  useForm,
  type Resolver,
  type SubmitHandler,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  surveyCampaignSchema,
  SURVEY_ETAPA_CUALQUIERA,
  type SurveyCampaignFormValues,
} from '@/schemas';
import { CompetitionStage, SurveyWindow, type SurveyCampaign } from '@/types';
import {
  useCreateSurveyCampaign,
  useUpdateSurveyCampaign,
} from '@/hooks/useSurvey';

/** ISO del backend → `YYYY-MM-DD` para el `<input type="date">`. */
function isoAFecha(iso?: string | null): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}

/**
 * `YYYY-MM-DD` → ISO completo.
 *
 * La apertura arranca a las 00:00 y el cierre termina a las 23:59: quien pone
 * "cierra el 30/09" espera que el 30 todavía se pueda contestar. Con
 * `T00:00` en los dos extremos, la encuesta se cerraría la noche del 29.
 */
function fechaAIso(fecha: string | undefined, borde: 'inicio' | 'fin'): string | undefined {
  if (!fecha) return undefined;
  const hora = borde === 'inicio' ? '00:00:00' : '23:59:59';
  const instante = new Date(`${fecha}T${hora}`);
  return Number.isNaN(instante.getTime()) ? undefined : instante.toISOString();
}

function valoresIniciales(campaign?: SurveyCampaign): SurveyCampaignFormValues {
  return {
    titulo: campaign?.titulo ?? '',
    descripcion: campaign?.descripcion ?? '',
    anio: campaign?.anio ?? new Date().getFullYear(),
    ventana: campaign?.ventana ?? SurveyWindow.DURANTE,
    etapa: campaign?.etapa ?? SURVEY_ETAPA_CUALQUIERA,
    abreEn: isoAFecha(campaign?.abreEn),
    cierraEn: isoAFecha(campaign?.cierraEn),
  };
}

interface Opciones {
  initialData?: SurveyCampaign;
  /**
   * Recibe la campaña que devolvió el backend. El listado la usa para llevar a
   * Laura directo al editor: una campaña recién creada está vacía, y dejarla en
   * la tabla la obliga a buscar la fila que acaba de crear para entrar a
   * escribir las preguntas, que es lo que en realidad venía a hacer.
   */
  onSuccess?: (campaign: SurveyCampaign) => void;
}

export function useSurveyCampaignForm({ initialData, onSuccess }: Opciones) {
  const createMutation = useCreateSurveyCampaign();
  const updateMutation = useUpdateSurveyCampaign();

  const form = useForm<SurveyCampaignFormValues>({
    // Mismo cast acotado que `useCalendarEventForm`: el schema tiene `.default()`,
    // así que los tipos de entrada y salida de Zod difieren y RHF sólo expone dos.
    resolver: zodResolver(surveyCampaignSchema) as Resolver<SurveyCampaignFormValues>,
    defaultValues: valoresIniciales(initialData),
  });

  useEffect(() => {
    form.reset(valoresIniciales(initialData));
  }, [initialData, form]);

  const submit: SubmitHandler<SurveyCampaignFormValues> = async (values) => {
    // `status` no está y no puede estar: publicar y cerrar son endpoints
    // propios que validan las transiciones. Ver `UpdateSurveyCampaignPayload`.
    const payload = {
      titulo: values.titulo.trim(),
      descripcion: values.descripcion?.trim() || undefined,
      anio: values.anio,
      ventana: values.ventana,
      etapa:
        values.etapa === SURVEY_ETAPA_CUALQUIERA
          ? undefined
          : (values.etapa as CompetitionStage),
      abreEn: fechaAIso(values.abreEn, 'inicio'),
      cierraEn: fechaAIso(values.cierraEn, 'fin'),
    };

    try {
      const campania = initialData?.id
        ? await updateMutation.mutateAsync({ id: initialData.id, payload })
        : await createMutation.mutateAsync(payload);
      onSuccess?.(campania);
    } catch {
      // El toast ya lo emite el `onError` del hook de React Query.
    }
  };

  return {
    form,
    submit,
    isPending: createMutation.isPending || updateMutation.isPending,
    isEditing: Boolean(initialData?.id),
  };
}
