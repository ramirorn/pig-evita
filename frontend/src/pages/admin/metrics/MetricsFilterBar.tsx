// ===========================================
// MetricsFilterBar — el corte que se está mirando
// ===========================================
import { FilterX } from 'lucide-react';
import {
  CompetitionStage,
  DisciplineType,
  Sex,
  SurveyWindow,
  type MetricsCatalog,
  type MetricsFiltros,
} from '@/types';
import {
  DISCIPLINE_TYPE_LABELS,
  SEX_LABELS,
  STAGE_LABELS,
  SURVEY_WINDOW_LABELS,
} from '@/lib/constants';
import {
  aplicarCambioDeFiltro,
  filtrosEnUso,
  hayFiltrosActivos,
  MAXIMO_FILTROS,
  puedeSumarFiltro,
  TEXTO_TOPE_FILTROS,
  type GrupoFiltro,
} from '@/lib/metrics/metricsRules';
import { SelectField } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';

interface MetricsFilterBarProps {
  filtros: MetricsFiltros;
  onChange: (filtros: MetricsFiltros) => void;
  catalogo: MetricsCatalog;
  /** Versión compacta para el modo comparar. */
  compacto?: boolean;
  /** Prefijo de ids, para que dos barras en la misma pantalla no choquen. */
  idPrefijo?: string;
}

const opcionesDe = <T extends string>(valores: T[], etiquetas: Record<T, string>) =>
  valores.map((v) => ({ value: v, label: etiquetas[v] }));

const ZONAS = [
  { value: 'CAPITAL', label: 'Capital (Formosa)' },
  { value: 'INTERIOR', label: 'Interior' },
];

export function MetricsFilterBar({
  filtros,
  onChange,
  catalogo,
  compacto = false,
  idPrefijo = 'metricas',
}: MetricsFilterBarProps) {
  const cambiar = (cambio: Partial<MetricsFiltros>) =>
    onChange(aplicarCambioDeFiltro(filtros, cambio, {
      departamentos: catalogo.departamentos,
      categorias: catalogo.categorias,
    }));
  const texto = (valor: string) => valor || undefined;
  // Con el tope alcanzado, sólo se pueden cambiar o quitar los filtros en uso.
  const bloqueado = (grupo: GrupoFiltro) => !puedeSumarFiltro(filtros, grupo);
  const enTope = filtrosEnUso(filtros).length >= MAXIMO_FILTROS;

  const localidades = filtros.departmentId
    ? (catalogo.departamentos.find((d) => d.id === filtros.departmentId)?.localidades ?? [])
    : catalogo.departamentos.flatMap((d) => d.localidades);
  const categorias = filtros.disciplineId
    ? catalogo.categorias.filter((c) => c.disciplineId === filtros.disciplineId)
    : catalogo.categorias;

  const campo = (id: string, etiqueta: string, control: React.ReactNode) => (
    <div className="min-w-0">
      <label htmlFor={`${idPrefijo}-${id}`} className="text-xs font-semibold text-primary-700">
        {etiqueta}
      </label>
      <div className="mt-1">{control}</div>
    </div>
  );

  return (
    <div
      className={`grid gap-3 ${compacto ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6'}`}
    >
      {campo(
        'zona',
        'Zona',
        <SelectField
          id={`${idPrefijo}-zona`}
          disabled={bloqueado('zona')}
          value={filtros.zona ?? ''}
          onValueChange={(v) => cambiar({ zona: (texto(v) as MetricsFiltros['zona']) })}
          emptyOptionLabel="Capital e interior"
          options={ZONAS}
        />,
      )}
      {campo(
        'departamento',
        'Departamento',
        <SelectField
          id={`${idPrefijo}-departamento`}
          disabled={bloqueado('departmentId')}
          value={filtros.departmentId ?? ''}
          onValueChange={(v) => cambiar({ departmentId: texto(v) })}
          emptyOptionLabel="Todos"
          options={catalogo.departamentos.map((d) => ({ value: d.id, label: d.nombre }))}
        />,
      )}
      {campo(
        'localidad',
        'Localidad',
        <SelectField
          id={`${idPrefijo}-localidad`}
          disabled={bloqueado('localityId')}
          value={filtros.localityId ?? ''}
          onValueChange={(v) => cambiar({ localityId: texto(v) })}
          emptyOptionLabel="Todas"
          options={localidades.map((l) => ({ value: l.id, label: l.nombre }))}
        />,
      )}
      {campo(
        'disciplina',
        'Disciplina',
        <SelectField
          id={`${idPrefijo}-disciplina`}
          disabled={bloqueado('disciplineId')}
          value={filtros.disciplineId ?? ''}
          onValueChange={(v) => cambiar({ disciplineId: texto(v) })}
          emptyOptionLabel="Todas"
          options={catalogo.disciplinas.map((d) => ({ value: d.id, label: d.nombre }))}
        />,
      )}
      {campo(
        'categoria',
        'Categoría',
        <SelectField
          id={`${idPrefijo}-categoria`}
          disabled={bloqueado('categoryId')}
          value={filtros.categoryId ?? ''}
          onValueChange={(v) => cambiar({ categoryId: texto(v) })}
          emptyOptionLabel="Todas"
          options={categorias.map((c) => ({ value: c.id, label: c.nombre }))}
        />,
      )}
      {campo(
        'sexo',
        'Rama',
        <SelectField
          id={`${idPrefijo}-sexo`}
          disabled={bloqueado('sexo')}
          value={filtros.sexo ?? ''}
          onValueChange={(v) => cambiar({ sexo: texto(v) as Sex | undefined })}
          emptyOptionLabel="Todas"
          options={opcionesDe(Object.values(Sex), SEX_LABELS)}
        />,
      )}
      {!compacto && (
        <>
          {campo(
            'tipo',
            'Tipo de disciplina',
            <SelectField
              id={`${idPrefijo}-tipo`}
              disabled={bloqueado('disciplineType')}
              value={filtros.disciplineType ?? ''}
              onValueChange={(v) => cambiar({ disciplineType: texto(v) as DisciplineType | undefined })}
              emptyOptionLabel="Individual y equipo"
              options={opcionesDe(Object.values(DisciplineType), DISCIPLINE_TYPE_LABELS)}
            />,
          )}
          {campo(
            'etapa',
            'Etapa',
            <SelectField
              id={`${idPrefijo}-etapa`}
              disabled={bloqueado('etapa')}
              value={filtros.etapa ?? ''}
              onValueChange={(v) => cambiar({ etapa: texto(v) as CompetitionStage | undefined })}
              emptyOptionLabel="Todas"
              options={opcionesDe(Object.values(CompetitionStage), STAGE_LABELS)}
            />,
          )}
          {campo(
            'ventana',
            'Momento',
            <SelectField
              id={`${idPrefijo}-ventana`}
              disabled={bloqueado('ventana')}
              value={filtros.ventana ?? ''}
              onValueChange={(v) => cambiar({ ventana: texto(v) as SurveyWindow | undefined })}
              emptyOptionLabel="Todos"
              options={opcionesDe(Object.values(SurveyWindow), SURVEY_WINDOW_LABELS)}
            />,
          )}
          {campo(
            'desde',
            'Desde',
            <DatePicker
              id={`${idPrefijo}-desde`}
              disabled={bloqueado('fecha')}
              value={filtros.desde ?? ''}
              max={filtros.hasta}
              onChange={(v) => cambiar({ desde: texto(v) })}
            />,
          )}
          {campo(
            'hasta',
            'Hasta',
            <DatePicker
              id={`${idPrefijo}-hasta`}
              disabled={bloqueado('fecha')}
              value={filtros.hasta ?? ''}
              min={filtros.desde}
              onChange={(v) => cambiar({ hasta: texto(v) })}
            />,
          )}
        </>
      )}
      {enTope && (
        <p className="col-span-full text-xs text-primary-700" role="note">
          {TEXTO_TOPE_FILTROS}
        </p>
      )}
      {hayFiltrosActivos(filtros) && (
        <div className="flex items-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({})} className="gap-1.5">
            <FilterX className="h-4 w-4" aria-hidden="true" />
            Limpiar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
