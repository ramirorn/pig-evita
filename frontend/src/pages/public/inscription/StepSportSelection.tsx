// ===========================================
// Step 2: Sport & Category Selection Sub-component
// ===========================================
import React from 'react';
import { Trophy, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { Sex, type Discipline, type Category } from '@/types';
import type { InscriptionFormData } from './StepPersonalData';

interface StepSportSelectionProps {
  formData: InscriptionFormData;
  setFormData: React.Dispatch<React.SetStateAction<InscriptionFormData>>;
  disciplines?: Discipline[];
  availableCategories: Category[];
  selectedCategory?: Category;
  categoryCompatibility: { valid: boolean; message: string };
  calculatedAge: number | null;
  loadingDisciplines: boolean;
  loadingCategories: boolean;
  onBack: () => void;
  onNext: (e: React.FormEvent) => void;
}

export function StepSportSelection({
  formData,
  setFormData,
  disciplines,
  availableCategories,
  selectedCategory,
  categoryCompatibility,
  calculatedAge,
  loadingDisciplines,
  loadingCategories,
  onBack,
  onNext,
}: StepSportSelectionProps) {
  return (
    <form onSubmit={onNext} className="card p-6 md:p-8 space-y-6 animate-fade-in shadow-md">
      <div className="flex items-center justify-between pb-4 border-b border-primary-100">
        <div className="flex items-center gap-2.5 text-primary-800 font-bold text-lg">
          <Trophy className="w-5 h-5 text-accent-600" />
          <span>Paso 2: Disciplina y Categoría</span>
        </div>
        <span className="text-xs font-bold text-primary-700 bg-primary-50 px-3 py-1 rounded-full border border-primary-200">
          Atleta: {formData.firstName} {formData.lastName} ({calculatedAge} años)
        </span>
      </div>

      {/* Disciplines Selection */}
      <div>
        <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-2">
          1. Seleccioná la Disciplina Deportiva *
        </label>
        {loadingDisciplines ? (
          <div className="p-8 text-center text-primary-400 text-sm">Cargando disciplinas deportivas...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
            {disciplines?.map((discipline) => {
              const isSelected = formData.disciplineId === discipline.id;
              return (
                <button
                  key={discipline.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, disciplineId: discipline.id, categoryId: '' })}
                  className={`p-3 rounded-xl text-left border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-primary-800 bg-primary-50 text-primary-900 ring-2 ring-primary-700 shadow-xs'
                      : 'border-primary-200 bg-white hover:border-primary-300 text-primary-700'
                  }`}
                >
                  <span className="font-bold text-xs line-clamp-1">{discipline.name}</span>
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-white border border-primary-100 text-primary-600">
                      {discipline.type}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Categories Selection */}
      {formData.disciplineId && (
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
                const isSelected = formData.categoryId === category.id;
                const isAgeValid =
                  calculatedAge !== null &&
                  calculatedAge >= category.minAge &&
                  calculatedAge <= category.maxAge;
                const isSexValid =
                  category.sex === Sex.MIXTO || category.sex === formData.sex;
                const isValid = isAgeValid && isSexValid;

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, categoryId: category.id })}
                    className={`p-4 rounded-xl text-left border transition-all ${
                      isSelected
                        ? 'border-secondary-600 bg-secondary-50 text-secondary-900 ring-2 ring-secondary-500 shadow-sm'
                        : isValid
                        ? 'border-primary-200 bg-white hover:border-primary-300 text-primary-800'
                        : 'border-primary-100 bg-primary-50/50 text-primary-400 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{category.name}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border border-primary-100 text-primary-700">
                        {category.minAge} - {category.maxAge} años
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <span className="font-medium text-primary-600">
                        Rama: {category.sex}
                      </span>
                      {isValid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-secondary-600">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Compatible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                          <AlertCircle className="w-3.5 h-3.5" /> Fuera de rango
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Compatibility Warning Box */}
          {selectedCategory && (
            <div className="mt-4">
              {categoryCompatibility.valid ? (
                <div className="p-3.5 rounded-xl bg-secondary-50 border border-secondary-200 text-secondary-800 text-xs flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-secondary-600 flex-shrink-0" />
                  <span>{categoryCompatibility.message}</span>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-destructive-50 border border-red-200 text-destructive-700 text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-destructive-500 flex-shrink-0" />
                  <span>{categoryCompatibility.message}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="pt-4 flex items-center justify-between border-t border-primary-100">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-600 hover:text-primary-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Datos Personales
        </button>

        <button
          type="submit"
          disabled={!formData.categoryId || !categoryCompatibility.valid}
          className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-white bg-primary-800 hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all"
        >
          Revisar Inscripción
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
