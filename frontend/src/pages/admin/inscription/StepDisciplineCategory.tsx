// ===========================================
// Paso 1: Disciplina y categoría (y el plantel que exigen)
// ===========================================
import { Link } from 'react-router';
import { Trophy, ArrowRight, AlertTriangle, Users, User, Settings2 } from 'lucide-react';
import { DisciplineType, type Category, type Discipline } from '@/types';
import { DISCIPLINE_TYPE_LABELS, ROUTES, SEX_LABELS } from '@/lib/constants';
import type { PlantelRequerido } from './rosterModel';

interface StepDisciplineCategoryProps {
  disciplineId: string;
  categoryId: string;
  disciplines?: Discipline[];
  availableCategories: Category[];
  selectedDiscipline?: Discipline;
  selectedCategory?: Category;
  plantelRequerido: PlantelRequerido | null;
  faltaConfigurarPlantel: boolean;
  loadingDisciplines: boolean;
  loadingCategories: boolean;
  onSelectDiscipline: (id: string) => void;
  onSelectCategory: (id: string) => void;
  onNext: () => void;
}

export function StepDisciplineCategory({
  disciplineId,
  categoryId,
  disciplines,
  availableCategories,
  selectedDiscipline,
  selectedCategory,
  plantelRequerido,
  faltaConfigurarPlantel,
  loadingDisciplines,
  loadingCategories,
  onSelectDiscipline,
  onSelectCategory,
  onNext,
}: StepDisciplineCategoryProps) {
  const esEquipo = selectedDiscipline?.type === DisciplineType.EQUIPO;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
      className="card p-6 md:p-8 space-y-6 animate-fade-in shadow-md"
    >
      <div className="flex items-center gap-2.5 pb-4 border-b border-primary-100 text-primary-800 font-bold text-lg">
        <Trophy className="w-5 h-5 text-accent-600" />
        <span>Paso 1: Disciplina y Categoría</span>
      </div>

      <div>
        <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-2">
          1. Seleccioná la Disciplina Deportiva *
        </label>
        {loadingDisciplines ? (
          <div className="p-8 text-center text-primary-400 text-sm">
            Cargando disciplinas deportivas...
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
            {disciplines?.map((discipline) => {
              const isSelected = disciplineId === discipline.id;
              return (
                <button
                  key={discipline.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectDiscipline(discipline.id)}
                  className={`p-3 rounded-xl text-left border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-primary-800 bg-primary-50 text-primary-900 ring-2 ring-primary-700 shadow-xs'
                      : 'border-primary-200 bg-white hover:border-primary-300 text-primary-700'
                  }`}
                >
                  <span className="font-bold text-xs line-clamp-1">{discipline.name}</span>
                  <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-white border border-primary-100 text-primary-600 w-fit">
                    {discipline.type === DisciplineType.EQUIPO ? (
                      <Users className="w-3 h-3" aria-hidden="true" />
                    ) : (
                      <User className="w-3 h-3" aria-hidden="true" />
                    )}
                    {DISCIPLINE_TYPE_LABELS[discipline.type]}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {disciplineId && (
        <div className="pt-4 border-t border-primary-100 animate-fade-in">
          <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-2">
            2. Seleccioná la Categoría Oficial *
          </label>

          {loadingCategories ? (
            <div className="p-4 text-center text-primary-400 text-sm">Cargando categorías...</div>
          ) : availableCategories.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              No hay categorías activas para esta disciplina en este momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableCategories.map((category) => {
                const isSelected = categoryId === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelectCategory(category.id)}
                    className={`p-4 rounded-xl text-left border transition-all ${
                      isSelected
                        ? 'border-secondary-600 bg-secondary-50 text-secondary-900 ring-2 ring-secondary-500 shadow-sm'
                        : 'border-primary-200 bg-white hover:border-primary-300 text-primary-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{category.name}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border border-primary-100 text-primary-700">
                        {category.minAge} - {category.maxAge} años
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-medium text-primary-600">
                      Rama: {SEX_LABELS[category.sex]}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/*
        El aviso de plantel requerido y el de disciplina sin configurar son la
        razón de ser de este paso: los dos tienen que aparecer ACÁ, con el
        plantel todavía vacío. Descubrir después de cargar 16 chicos que la
        disciplina no tiene `titulares` es trabajo perdido que nadie rehace.
      */}
      {esEquipo && selectedCategory && plantelRequerido && (
        <div className="p-4 rounded-xl bg-primary-50 border border-primary-200 flex items-start gap-3 animate-fade-in">
          <Users className="w-5 h-5 text-primary-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-primary-800">
            <p className="font-bold">
              {selectedDiscipline?.name} {selectedCategory.name} necesita{' '}
              {plantelRequerido.titulares} titulares
              {plantelRequerido.maxSuplentes > 0
                ? ` y hasta ${plantelRequerido.maxSuplentes} suplentes`
                : ' y no admite suplentes'}
              .
            </p>
            <p className="text-xs text-primary-600 mt-1">
              En el próximo paso vas a cargar a los integrantes uno por uno. Lo que cargues se
              guarda solo: si se cierra la pantalla, lo recuperás al volver.
            </p>
          </div>
        </div>
      )}

      {esEquipo && faltaConfigurarPlantel && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 animate-fade-in"
        >
          <AlertTriangle
            className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="text-sm text-amber-900">
            <p className="font-bold">
              Todavía no se definió el plantel de {selectedDiscipline?.name}.
            </p>
            <p className="text-xs mt-1 leading-relaxed">
              Para inscribir un equipo hace falta saber cuántos titulares lleva la disciplina y
              cuántos suplentes admite. Esos dos datos se cargan una sola vez, desde el ABM de
              Disciplinas, y después sirven para todas las categorías.
            </p>
            <Link
              to={ROUTES.DISCIPLINES_ADMIN}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
              Configurar {selectedDiscipline?.name} en Disciplinas
            </Link>
          </div>
        </div>
      )}

      {selectedDiscipline?.type === DisciplineType.INDIVIDUAL && categoryId && (
        <div className="p-4 rounded-xl bg-surface border border-primary-100 flex items-start gap-3 text-sm text-primary-700 animate-fade-in">
          <User className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            <span className="font-bold text-primary-900">{selectedDiscipline.name}</span> es una
            disciplina individual: en el próximo paso cargás los datos de un solo participante.
          </p>
        </div>
      )}

      <div className="pt-4 flex justify-end border-t border-primary-100">
        <button
          type="submit"
          disabled={!categoryId || faltaConfigurarPlantel}
          className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-white bg-primary-800 hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all"
        >
          {esEquipo ? 'Siguiente: Cargar Plantel' : 'Siguiente: Datos del Participante'}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
